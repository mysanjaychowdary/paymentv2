from fastapi import APIRouter, Request, HTTPException, Depends, Query
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional

from models import Customer, CustomerCreate, Quotation, Invoice, Payment, CreditPurchase
from auth import get_current_user

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("")
async def list_customers(request: Request, search: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"company_name": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.customers.find(query).sort("name", 1).to_list(5000)
    return [Customer.from_mongo(d) for d in docs]


@router.post("")
async def create_customer(payload: CustomerCreate, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    customer = Customer(**payload.model_dump())
    result = await db.customers.insert_one(customer.to_mongo())
    doc = await db.customers.find_one({"_id": result.inserted_id})
    return Customer.from_mongo(doc)


@router.get("/{customer_id}")
async def get_customer(customer_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    doc = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Customer not found")
    return Customer.from_mongo(doc)


@router.put("/{customer_id}")
async def update_customer(customer_id: str, payload: CustomerCreate, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    result = await db.customers.update_one({"_id": ObjectId(customer_id)}, {"$set": payload.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    doc = await db.customers.find_one({"_id": ObjectId(customer_id)})
    return Customer.from_mongo(doc)


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    result = await db.customers.delete_one({"_id": ObjectId(customer_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted"}


@router.get("/{customer_id}/summary")
async def customer_summary(customer_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    invoices = await db.invoices.find({"customer_id": customer_id, "status": {"$ne": "cancelled"}}).to_list(10000)
    payments = await db.payments.find({"customer_id": customer_id}).to_list(10000)
    credit_purchases = await db.credit_purchases.find({"customer_id": customer_id}).to_list(10000)
    total_sales = round(sum(i.get("total", 0) for i in invoices), 2)
    total_paid = round(sum(p.get("amount", 0) for p in payments), 2)
    total_due = round(sum(i.get("due_amount", 0) for i in invoices), 2)
    credit_purchase_count = len(credit_purchases)
    credit_purchase_cost = round(sum(c.get("amount_paid", 0) for c in credit_purchases), 2)
    credit_purchase_credits = round(sum(c.get("credits_purchased", 0) for c in credit_purchases), 2)
    return {
        "total_sales": total_sales,
        "total_paid": total_paid,
        "total_due": total_due,
        "credit_purchase_count": credit_purchase_count,
        "credit_purchase_cost": credit_purchase_cost,
        "credit_purchase_credits": credit_purchase_credits,
    }


@router.get("/{customer_id}/history")
async def customer_history(customer_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    quotations = await db.quotations.find({"customer_id": customer_id}).sort("date", -1).to_list(10000)
    invoices = await db.invoices.find({"customer_id": customer_id}).sort("invoice_date", -1).to_list(10000)
    payments = await db.payments.find({"customer_id": customer_id}).sort("payment_date", -1).to_list(10000)
    credit_purchases = await db.credit_purchases.find({"customer_id": customer_id}).sort("date", -1).to_list(10000)
    return {
        "quotations": [Quotation.from_mongo(d) for d in quotations],
        "invoices": [Invoice.from_mongo(d) for d in invoices],
        "payments": [Payment.from_mongo(d) for d in payments],
        "credit_purchases": [CreditPurchase.from_mongo(d) for d in credit_purchases],
    }
