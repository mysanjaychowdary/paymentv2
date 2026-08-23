from fastapi import APIRouter, Request, Depends, Query
from datetime import datetime, timezone
from typing import Optional
import calendar

from auth import get_current_user

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _date_range(date_from: Optional[str], date_to: Optional[str], field_query: dict):
    if date_from:
        field_query["$gte"] = datetime.fromisoformat(date_from)
    if date_to:
        field_query["$lte"] = datetime.fromisoformat(date_to)
    return field_query


@router.get("/sales")
async def sales_report(request: Request, date_from: Optional[str] = None, date_to: Optional[str] = None, customer_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    query = {"status": {"$ne": "cancelled"}}
    if customer_id:
        query["customer_id"] = customer_id
    if date_from or date_to:
        query["invoice_date"] = _date_range(date_from, date_to, {})
    docs = await db.invoices.find(query).sort("invoice_date", -1).to_list(10000)
    rows = [{"customer": d["customer_name"], "invoice_number": d["invoice_number"], "date": d["invoice_date"], "amount": d["total"]} for d in docs]
    return {"rows": rows, "total": round(sum(r["amount"] for r in rows), 2)}


@router.get("/payments")
async def payments_report(request: Request, date_from: Optional[str] = None, date_to: Optional[str] = None, customer_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    if date_from or date_to:
        query["payment_date"] = _date_range(date_from, date_to, {})
    docs = await db.payments.find(query).sort("payment_date", -1).to_list(10000)
    rows = [{"customer": d["customer_name"], "invoice_number": d["invoice_number"], "date": d["payment_date"], "amount": d["amount"], "method": d["method"]} for d in docs]
    return {"rows": rows, "total": round(sum(r["amount"] for r in rows), 2)}


@router.get("/outstanding")
async def outstanding_report(request: Request, customer_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    query = {"due_amount": {"$gt": 0}, "status": {"$ne": "cancelled"}}
    if customer_id:
        query["customer_id"] = customer_id
    docs = await db.invoices.find(query).sort("due_date", 1).to_list(10000)
    rows = [{
        "customer": d["customer_name"], "invoice_number": d["invoice_number"], "total": d["total"],
        "paid": d["paid_amount"], "due": d["due_amount"], "due_date": d.get("due_date"), "status": d["status"],
    } for d in docs]
    return {"rows": rows, "total_due": round(sum(r["due"] for r in rows), 2)}


@router.get("/credit-purchases")
async def credit_purchases_report(request: Request, date_from: Optional[str] = None, date_to: Optional[str] = None, customer_id: Optional[str] = None, provider: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    if provider:
        query["provider"] = {"$regex": provider, "$options": "i"}
    if date_from or date_to:
        query["date"] = _date_range(date_from, date_to, {})
    docs = await db.credit_purchases.find(query).sort("date", -1).to_list(10000)
    rows = [{"customer": d["customer_name"], "date": d["date"], "credits": d["credits_purchased"], "amount": d["amount_paid"], "provider": d["provider"]} for d in docs]
    return {"rows": rows, "total_credits": round(sum(r["credits"] for r in rows), 2), "total_amount": round(sum(r["amount"] for r in rows), 2)}


@router.get("/monthly")
async def monthly_report(request: Request, month: int = Query(...), year: int = Query(...), current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    last_day = calendar.monthrange(year, month)[1]
    end = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)

    invoices = await db.invoices.find({"invoice_date": {"$gte": start, "$lte": end}, "status": {"$ne": "cancelled"}}).to_list(10000)
    payments = await db.payments.find({"payment_date": {"$gte": start, "$lte": end}}).to_list(10000)
    credit_purchases = await db.credit_purchases.find({"date": {"$gte": start, "$lte": end}}).to_list(10000)
    outstanding_invoices = await db.invoices.find({"invoice_date": {"$gte": start, "$lte": end}, "status": {"$ne": "cancelled"}}).to_list(10000)

    sales = round(sum(i.get("total", 0) for i in invoices), 2)
    payments_received = round(sum(p.get("amount", 0) for p in payments), 2)
    outstanding = round(sum(i.get("due_amount", 0) for i in outstanding_invoices), 2)
    credit_purchase_amount = round(sum(c.get("amount_paid", 0) for c in credit_purchases), 2)

    return {
        "month": month, "year": year,
        "sales": sales,
        "payments_received": payments_received,
        "outstanding": outstanding,
        "credit_purchase_amount": credit_purchase_amount,
        "credit_purchase_count": len(credit_purchases),
    }


@router.get("/profit")
async def profit_report(request: Request, date_from: Optional[str] = None, date_to: Optional[str] = None, customer_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    invoice_query = {"status": {"$ne": "cancelled"}}
    credit_query = {}
    if customer_id:
        invoice_query["customer_id"] = customer_id
        credit_query["customer_id"] = customer_id
    if date_from or date_to:
        invoice_query["invoice_date"] = _date_range(date_from, date_to, {})
        credit_query["date"] = _date_range(date_from, date_to, {})
    invoices = await db.invoices.find(invoice_query).to_list(10000)
    credit_purchases = await db.credit_purchases.find(credit_query).to_list(10000)
    sales = round(sum(i.get("total", 0) for i in invoices), 2)
    cost = round(sum(c.get("amount_paid", 0) for c in credit_purchases), 2)
    profit = round(sales - cost, 2)
    return {"sales": sales, "credit_purchase_cost": cost, "gross_profit": profit}
