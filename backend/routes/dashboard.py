from fastapi import APIRouter, Request, Depends
from datetime import datetime, timezone, timedelta

from models import Invoice, Payment, CreditPurchase
from auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary(request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    invoices = await db.invoices.find({"status": {"$ne": "cancelled"}}).to_list(20000)
    payments = await db.payments.find({}).to_list(20000)
    credit_purchases = await db.credit_purchases.find({}).to_list(20000)

    total_sales = round(sum(i.get("total", 0) for i in invoices), 2)
    total_invoiced = total_sales
    total_paid = round(sum(p.get("amount", 0) for p in payments), 2)
    total_due = round(sum(i.get("due_amount", 0) for i in invoices), 2)
    total_credit_purchase_count = len(credit_purchases)
    total_credit_spend = round(sum(c.get("amount_paid", 0) for c in credit_purchases), 2)

    month_sales = round(sum(i.get("total", 0) for i in invoices if i.get("invoice_date") and i["invoice_date"] >= month_start), 2)
    month_payments = round(sum(p.get("amount", 0) for p in payments if p.get("payment_date") and p["payment_date"] >= month_start), 2)
    month_credit_purchases = [c for c in credit_purchases if c.get("date") and c["date"] >= month_start]
    month_credit_spend = round(sum(c.get("amount_paid", 0) for c in month_credit_purchases), 2)
    month_credit_count = len(month_credit_purchases)

    recent_invoices = await db.invoices.find({}).sort("created_at", -1).limit(5).to_list(5)
    recent_payments = await db.payments.find({}).sort("created_at", -1).limit(5).to_list(5)
    recent_credit_purchases = await db.credit_purchases.find({}).sort("created_at", -1).limit(5).to_list(5)

    return {
        "total_sales": total_sales,
        "total_invoiced": total_invoiced,
        "total_paid": total_paid,
        "total_due": total_due,
        "total_credit_purchase_count": total_credit_purchase_count,
        "total_credit_spend": total_credit_spend,
        "month_sales": month_sales,
        "month_payments": month_payments,
        "month_credit_spend": month_credit_spend,
        "month_credit_count": month_credit_count,
        "recent_invoices": [Invoice.from_mongo(d) for d in recent_invoices],
        "recent_payments": [Payment.from_mongo(d) for d in recent_payments],
        "recent_credit_purchases": [CreditPurchase.from_mongo(d) for d in recent_credit_purchases],
    }


@router.get("/trend")
async def dashboard_trend(request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    months = []
    cursor = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    for _ in range(6):
        months.append(cursor)
        cursor = (cursor - timedelta(days=1)).replace(day=1)
    months.reverse()

    invoices = await db.invoices.find({"status": {"$ne": "cancelled"}}).to_list(20000)
    payments = await db.payments.find({}).to_list(20000)

    result = []
    for idx, month_start in enumerate(months):
        month_end = months[idx + 1] if idx + 1 < len(months) else (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        sales = round(sum(i.get("total", 0) for i in invoices if i.get("invoice_date") and month_start <= i["invoice_date"] < month_end), 2)
        paid = round(sum(p.get("amount", 0) for p in payments if p.get("payment_date") and month_start <= p["payment_date"] < month_end), 2)
        result.append({"month": month_start.strftime("%b %Y"), "sales": sales, "payments": paid})
    return result
