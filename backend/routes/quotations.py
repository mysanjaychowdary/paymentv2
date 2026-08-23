from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import StreamingResponse
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional

from models import Quotation, QuotationCreate
from auth import get_current_user
from utils import get_next_number, compute_items_and_totals, get_or_create_settings
from pdf_utils import generate_quotation_pdf
from storage import get_object

router = APIRouter(prefix="/api/quotations", tags=["quotations"])


@router.get("")
async def list_quotations(
    request: Request,
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = request.app.state.db
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"quotation_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
        ]
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = datetime.fromisoformat(date_from)
        if date_to:
            date_query["$lte"] = datetime.fromisoformat(date_to)
        query["date"] = date_query
    docs = await db.quotations.find(query).sort("date", -1).to_list(5000)
    return [Quotation.from_mongo(d) for d in docs]


@router.post("")
async def create_quotation(payload: QuotationCreate, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    customer = await db.customers.find_one({"_id": ObjectId(payload.customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    quotation_number = await get_next_number(db, "QT")
    totals = compute_items_and_totals([i.model_dump() for i in payload.items])
    quotation = Quotation(
        quotation_number=quotation_number,
        customer_id=payload.customer_id,
        customer_name=customer["name"],
        date=payload.date,
        valid_until=payload.valid_until,
        notes=payload.notes,
        terms=payload.terms,
        status=payload.status or "draft",
        **totals,
    )
    result = await db.quotations.insert_one(quotation.to_mongo())
    doc = await db.quotations.find_one({"_id": result.inserted_id})
    return Quotation.from_mongo(doc)


@router.get("/{quotation_id}")
async def get_quotation(quotation_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    doc = await db.quotations.find_one({"_id": ObjectId(quotation_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return Quotation.from_mongo(doc)


@router.put("/{quotation_id}")
async def update_quotation(quotation_id: str, payload: QuotationCreate, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    customer = await db.customers.find_one({"_id": ObjectId(payload.customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    totals = compute_items_and_totals([i.model_dump() for i in payload.items])
    update_doc = {
        "customer_id": payload.customer_id,
        "customer_name": customer["name"],
        "date": payload.date,
        "valid_until": payload.valid_until,
        "notes": payload.notes,
        "terms": payload.terms,
        "status": payload.status or "draft",
        "updated_at": datetime.now(timezone.utc),
        **totals,
    }
    result = await db.quotations.update_one({"_id": ObjectId(quotation_id)}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quotation not found")
    doc = await db.quotations.find_one({"_id": ObjectId(quotation_id)})
    return Quotation.from_mongo(doc)


@router.delete("/{quotation_id}")
async def delete_quotation(quotation_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    result = await db.quotations.delete_one({"_id": ObjectId(quotation_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return {"message": "Quotation deleted"}


@router.post("/{quotation_id}/convert-to-invoice")
async def convert_to_invoice(quotation_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    quotation = await db.quotations.find_one({"_id": ObjectId(quotation_id)})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if quotation.get("invoice_id"):
        raise HTTPException(status_code=400, detail="Quotation already converted to an invoice")
    invoice_number = await get_next_number(db, "INV")
    from models import Invoice
    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=quotation["customer_id"],
        customer_name=quotation["customer_name"],
        quotation_id=quotation_id,
        invoice_date=datetime.now(timezone.utc),
        due_date=None,
        items=quotation.get("items", []),
        subtotal=quotation.get("subtotal", 0),
        discount_total=quotation.get("discount_total", 0),
        tax_total=quotation.get("tax_total", 0),
        total=quotation.get("total", 0),
        paid_amount=0,
        due_amount=quotation.get("total", 0),
        notes=quotation.get("notes", ""),
        payment_terms="",
        status="draft",
    )
    result = await db.invoices.insert_one(invoice.to_mongo())
    await db.quotations.update_one(
        {"_id": ObjectId(quotation_id)},
        {"$set": {"invoice_id": str(result.inserted_id), "status": "accepted", "updated_at": datetime.now(timezone.utc)}},
    )
    doc = await db.invoices.find_one({"_id": result.inserted_id})
    return Invoice.from_mongo(doc)


@router.get("/{quotation_id}/pdf")
async def quotation_pdf(quotation_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    quotation = await db.quotations.find_one({"_id": ObjectId(quotation_id)})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    customer = await db.customers.find_one({"_id": ObjectId(quotation["customer_id"])}) or {}
    settings = dict(await get_or_create_settings(db))
    if settings.get("logo_path"):
        try:
            settings["_logo_bytes"], _ = get_object(settings["logo_path"])
        except Exception:
            pass
    buf = generate_quotation_pdf(quotation, customer, settings)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={quotation['quotation_number']}.pdf"},
    )
