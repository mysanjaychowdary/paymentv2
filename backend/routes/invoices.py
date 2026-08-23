from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import StreamingResponse
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional

from models import Invoice, InvoiceCreate
from auth import get_current_user
from utils import get_next_number, compute_items_and_totals, recalc_invoice, compute_invoice_status, get_or_create_settings
from pdf_utils import generate_invoice_pdf
from storage import get_object

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


@router.get("")
async def list_invoices(
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
            {"invoice_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
        ]
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = datetime.fromisoformat(date_from)
        if date_to:
            date_query["$lte"] = datetime.fromisoformat(date_to)
        query["invoice_date"] = date_query
    docs = await db.invoices.find(query).sort("invoice_date", -1).to_list(5000)
    # refresh overdue statuses lazily and persist the transition
    result = []
    for d in docs:
        status_val, due_amount = compute_invoice_status(d.get("status", "draft"), d.get("total", 0), d.get("paid_amount", 0), d.get("due_date"))
        if status_val != d.get("status"):
            d["status"] = status_val
            d["due_amount"] = due_amount
            await db.invoices.update_one({"_id": d["_id"]}, {"$set": {"status": status_val, "due_amount": due_amount}})
        result.append(Invoice.from_mongo(d))
    return result


@router.post("")
async def create_invoice(payload: InvoiceCreate, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    customer = await db.customers.find_one({"_id": ObjectId(payload.customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    invoice_number = await get_next_number(db, "INV")
    totals = compute_items_and_totals([i.model_dump() for i in payload.items])
    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=payload.customer_id,
        customer_name=customer["name"],
        quotation_id=payload.quotation_id,
        invoice_date=payload.invoice_date,
        due_date=payload.due_date,
        notes=payload.notes,
        payment_terms=payload.payment_terms,
        status=payload.status or "draft",
        paid_amount=0,
        due_amount=totals["total"],
        **totals,
    )
    result = await db.invoices.insert_one(invoice.to_mongo())
    doc = await db.invoices.find_one({"_id": result.inserted_id})
    return Invoice.from_mongo(doc)


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    doc = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    status_val, due_amount = compute_invoice_status(doc.get("status", "draft"), doc.get("total", 0), doc.get("paid_amount", 0), doc.get("due_date"))
    if status_val != doc.get("status"):
        await db.invoices.update_one({"_id": doc["_id"]}, {"$set": {"status": status_val, "due_amount": due_amount}})
        doc["status"] = status_val
        doc["due_amount"] = due_amount
    return Invoice.from_mongo(doc)


@router.put("/{invoice_id}")
async def update_invoice(invoice_id: str, payload: InvoiceCreate, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    customer = await db.customers.find_one({"_id": ObjectId(payload.customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    totals = compute_items_and_totals([i.model_dump() for i in payload.items])
    existing = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Invoice not found")
    paid_amount = existing.get("paid_amount", 0)
    update_doc = {
        "customer_id": payload.customer_id,
        "customer_name": customer["name"],
        "invoice_date": payload.invoice_date,
        "due_date": payload.due_date,
        "notes": payload.notes,
        "payment_terms": payload.payment_terms,
        "status": payload.status or existing.get("status", "draft"),
        "paid_amount": paid_amount,
        "due_amount": round(totals["total"] - paid_amount, 2),
        "updated_at": datetime.now(timezone.utc),
        **totals,
    }
    await db.invoices.update_one({"_id": ObjectId(invoice_id)}, {"$set": update_doc})
    await recalc_invoice(db, invoice_id)
    doc = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    return Invoice.from_mongo(doc)


@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    result = await db.invoices.delete_one({"_id": ObjectId(invoice_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    await db.payments.delete_many({"invoice_id": invoice_id})
    return {"message": "Invoice deleted"}


@router.post("/{invoice_id}/duplicate")
async def duplicate_invoice(invoice_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    source = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not source:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice_number = await get_next_number(db, "INV")
    new_invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=source["customer_id"],
        customer_name=source["customer_name"],
        quotation_id=None,
        invoice_date=datetime.now(timezone.utc),
        due_date=None,
        items=source.get("items", []),
        subtotal=source.get("subtotal", 0),
        discount_total=source.get("discount_total", 0),
        tax_total=source.get("tax_total", 0),
        total=source.get("total", 0),
        paid_amount=0,
        due_amount=source.get("total", 0),
        notes=source.get("notes", ""),
        payment_terms=source.get("payment_terms", ""),
        status="draft",
    )
    result = await db.invoices.insert_one(new_invoice.to_mongo())
    doc = await db.invoices.find_one({"_id": result.inserted_id})
    return Invoice.from_mongo(doc)


@router.get("/{invoice_id}/pdf")
async def invoice_pdf(invoice_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    invoice = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    customer = await db.customers.find_one({"_id": ObjectId(invoice["customer_id"])}) or {}
    settings = dict(await get_or_create_settings(db))
    if settings.get("logo_path"):
        try:
            settings["_logo_bytes"], _ = get_object(settings["logo_path"])
        except Exception:
            pass
    buf = generate_invoice_pdf(invoice, customer, settings)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={invoice['invoice_number']}.pdf"},
    )
