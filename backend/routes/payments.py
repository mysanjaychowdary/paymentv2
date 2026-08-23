from fastapi import APIRouter, Request, HTTPException, Depends
from bson import ObjectId
from datetime import datetime
from typing import Optional

from models import Payment, PaymentCreate
from auth import get_current_user
from utils import recalc_invoice

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.get("")
async def list_payments(
    request: Request,
    customer_id: Optional[str] = None,
    invoice_id: Optional[str] = None,
    method: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = request.app.state.db
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    if invoice_id:
        query["invoice_id"] = invoice_id
    if method:
        query["method"] = method
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = datetime.fromisoformat(date_from)
        if date_to:
            date_query["$lte"] = datetime.fromisoformat(date_to)
        query["payment_date"] = date_query
    docs = await db.payments.find(query).sort("payment_date", -1).to_list(10000)
    return [Payment.from_mongo(d) for d in docs]


@router.post("")
async def create_payment(payload: PaymentCreate, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    customer = await db.customers.find_one({"_id": ObjectId(payload.customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    invoice = await db.invoices.find_one({"_id": ObjectId(payload.invoice_id)})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    payment = Payment(
        customer_id=payload.customer_id,
        customer_name=customer["name"],
        invoice_id=payload.invoice_id,
        invoice_number=invoice["invoice_number"],
        payment_date=payload.payment_date,
        amount=payload.amount,
        method=payload.method,
        reference_number=payload.reference_number,
        notes=payload.notes,
    )
    result = await db.payments.insert_one(payment.to_mongo())
    await recalc_invoice(db, payload.invoice_id)
    doc = await db.payments.find_one({"_id": result.inserted_id})
    return Payment.from_mongo(doc)


@router.get("/{payment_id}")
async def get_payment(payment_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    doc = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Payment not found")
    return Payment.from_mongo(doc)


@router.put("/{payment_id}")
async def update_payment(payment_id: str, payload: PaymentCreate, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    existing = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")
    customer = await db.customers.find_one({"_id": ObjectId(payload.customer_id)})
    invoice = await db.invoices.find_one({"_id": ObjectId(payload.invoice_id)})
    if not customer or not invoice:
        raise HTTPException(status_code=404, detail="Customer or invoice not found")
    update_doc = {
        "customer_id": payload.customer_id,
        "customer_name": customer["name"],
        "invoice_id": payload.invoice_id,
        "invoice_number": invoice["invoice_number"],
        "payment_date": payload.payment_date,
        "amount": payload.amount,
        "method": payload.method,
        "reference_number": payload.reference_number,
        "notes": payload.notes,
    }
    await db.payments.update_one({"_id": ObjectId(payment_id)}, {"$set": update_doc})
    await recalc_invoice(db, existing["invoice_id"])
    if existing["invoice_id"] != payload.invoice_id:
        await recalc_invoice(db, payload.invoice_id)
    doc = await db.payments.find_one({"_id": ObjectId(payment_id)})
    return Payment.from_mongo(doc)


@router.delete("/{payment_id}")
async def delete_payment(payment_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    existing = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")
    await db.payments.delete_one({"_id": ObjectId(payment_id)})
    await recalc_invoice(db, existing["invoice_id"])
    return {"message": "Payment deleted"}
