from datetime import datetime, timezone
from pymongo import ReturnDocument


async def get_next_number(db, prefix: str) -> str:
    counter = await db.counters.find_one_and_update(
        {"_id": prefix},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"{prefix}-{counter['seq']:04d}"


def compute_items_and_totals(items: list) -> dict:
    computed_items = []
    subtotal = 0.0
    discount_total = 0.0
    tax_total = 0.0
    total = 0.0
    for it in items:
        item = dict(it)
        quantity = float(item.get("quantity", 0) or 0)
        rate = float(item.get("rate", 0) or 0)
        discount_percent = float(item.get("discount_percent", 0) or 0)
        tax_percent = float(item.get("tax_percent", 0) or 0)
        line_subtotal = quantity * rate
        discount_amount = line_subtotal * (discount_percent / 100)
        taxable = line_subtotal - discount_amount
        tax_amount = taxable * (tax_percent / 100)
        amount = round(taxable + tax_amount, 2)
        item["amount"] = amount
        computed_items.append(item)
        subtotal += line_subtotal
        discount_total += discount_amount
        tax_total += tax_amount
        total += amount
    return {
        "items": computed_items,
        "subtotal": round(subtotal, 2),
        "discount_total": round(discount_total, 2),
        "tax_total": round(tax_total, 2),
        "total": round(total, 2),
    }


def compute_invoice_status(current_status: str, total: float, paid_amount: float, due_date):
    due_amount = round(total - paid_amount, 2)
    if current_status == "cancelled":
        return "cancelled", due_amount
    if due_amount <= 0.01:
        return "paid", max(due_amount, 0)
    if paid_amount > 0:
        return "partially_paid", due_amount
    if current_status == "draft":
        return "draft", due_amount
    if due_date and due_date.replace(tzinfo=None) < datetime.now(timezone.utc).replace(tzinfo=None):
        return "overdue", due_amount
    return "sent", due_amount


async def recalc_invoice(db, invoice_id):
    from bson import ObjectId
    invoice = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice:
        return
    payments = await db.payments.find({"invoice_id": invoice_id}).to_list(10000)
    paid_amount = round(sum(p["amount"] for p in payments), 2)
    due_date = invoice.get("due_date")
    status, due_amount = compute_invoice_status(invoice.get("status", "draft"), invoice.get("total", 0), paid_amount, due_date)
    await db.invoices.update_one(
        {"_id": ObjectId(invoice_id)},
        {"$set": {"paid_amount": paid_amount, "due_amount": due_amount, "status": status, "updated_at": datetime.now(timezone.utc)}},
    )
