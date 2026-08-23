from fastapi import APIRouter, Request, HTTPException, Depends
from bson import ObjectId
from datetime import datetime
from typing import Optional

from models import CreditPurchase, CreditPurchaseCreate
from auth import get_current_user

router = APIRouter(prefix="/api/credit-purchases", tags=["credit-purchases"])


@router.get("")
async def list_credit_purchases(
    request: Request,
    customer_id: Optional[str] = None,
    provider: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = request.app.state.db
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    if provider:
        query["provider"] = {"$regex": provider, "$options": "i"}
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = datetime.fromisoformat(date_from)
        if date_to:
            date_query["$lte"] = datetime.fromisoformat(date_to)
        query["date"] = date_query
    docs = await db.credit_purchases.find(query).sort("date", -1).to_list(10000)
    return [CreditPurchase.from_mongo(d) for d in docs]


@router.post("")
async def create_credit_purchase(payload: CreditPurchaseCreate, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    customer = await db.customers.find_one({"_id": ObjectId(payload.customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    credit_purchase = CreditPurchase(customer_name=customer["name"], **payload.model_dump())
    result = await db.credit_purchases.insert_one(credit_purchase.to_mongo())
    doc = await db.credit_purchases.find_one({"_id": result.inserted_id})
    return CreditPurchase.from_mongo(doc)


@router.get("/{credit_purchase_id}")
async def get_credit_purchase(credit_purchase_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    doc = await db.credit_purchases.find_one({"_id": ObjectId(credit_purchase_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Credit purchase not found")
    return CreditPurchase.from_mongo(doc)


@router.put("/{credit_purchase_id}")
async def update_credit_purchase(credit_purchase_id: str, payload: CreditPurchaseCreate, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    customer = await db.customers.find_one({"_id": ObjectId(payload.customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    update_doc = {"customer_name": customer["name"], **payload.model_dump()}
    result = await db.credit_purchases.update_one({"_id": ObjectId(credit_purchase_id)}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Credit purchase not found")
    doc = await db.credit_purchases.find_one({"_id": ObjectId(credit_purchase_id)})
    return CreditPurchase.from_mongo(doc)


@router.delete("/{credit_purchase_id}")
async def delete_credit_purchase(credit_purchase_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    result = await db.credit_purchases.delete_one({"_id": ObjectId(credit_purchase_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Credit purchase not found")
    return {"message": "Credit purchase deleted"}
