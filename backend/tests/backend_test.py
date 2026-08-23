"""
End-to-end backend API tests for Sanju Animations IT Solutions.
Covers: auth, customers, services, quotations, invoices, payments, credit purchases,
dashboard, reports, PDF generation.
"""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE:
    # Fallback read from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.strip().split("=", 1)[1]
BASE = BASE.rstrip("/")

ADMIN_EMAIL = "admin@sanjuanimations.com"
ADMIN_PASSWORD = "Sanju@2026"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s


# ---------- AUTH ----------
def test_login_ok():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["email"] == ADMIN_EMAIL
    assert "access_token" in r.cookies
    assert "refresh_token" in r.cookies


def test_login_bad():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
    assert r.status_code == 401


def test_me_unauth():
    r = requests.get(f"{BASE}/api/auth/me", timeout=15)
    assert r.status_code == 401


def test_me_auth(client):
    r = client.get(f"{BASE}/api/auth/me", timeout=15)
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


# ---------- CUSTOMERS ----------
@pytest.fixture(scope="session")
def customer(client):
    payload = {
        "name": "TEST_Customer_ACME",
        "company_name": "ACME Pvt Ltd",
        "mobile": "9999900000",
        "email": "acme@test.com",
        "address": "Bengaluru",
        "gst_number": "29ABCDE1234F1Z5",
        "notes": "seed",
    }
    r = client.post(f"{BASE}/api/customers", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["name"] == payload["name"]
    assert d["id"]
    yield d
    client.delete(f"{BASE}/api/customers/{d['id']}", timeout=15)


def test_customer_list_and_search(client, customer):
    r = client.get(f"{BASE}/api/customers", timeout=15)
    assert r.status_code == 200
    assert any(c["id"] == customer["id"] for c in r.json())
    r2 = client.get(f"{BASE}/api/customers", params={"search": "ACME"}, timeout=15)
    assert r2.status_code == 200
    assert any(c["id"] == customer["id"] for c in r2.json())


def test_customer_update(client, customer):
    payload = {"name": "TEST_Customer_ACME", "company_name": "ACME Updated"}
    r = client.put(f"{BASE}/api/customers/{customer['id']}", json=payload, timeout=15)
    assert r.status_code == 200
    assert r.json()["company_name"] == "ACME Updated"


# ---------- SERVICES ----------
def test_service_crud(client):
    r = client.post(f"{BASE}/api/services", json={"name": "TEST_Service_Anim", "description": "2D anim", "default_price": 5000}, timeout=15)
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    assert r.json()["default_price"] == 5000

    r2 = client.get(f"{BASE}/api/services", timeout=15)
    assert r2.status_code == 200
    assert any(s["id"] == sid for s in r2.json())

    r3 = client.put(f"{BASE}/api/services/{sid}", json={"name": "TEST_Service_Anim", "default_price": 6000}, timeout=15)
    assert r3.status_code == 200 and r3.json()["default_price"] == 6000

    r4 = client.delete(f"{BASE}/api/services/{sid}", timeout=15)
    assert r4.status_code == 200


# ---------- QUOTATIONS ----------
@pytest.fixture(scope="session")
def quotation(client, customer):
    today = datetime.now(timezone.utc).isoformat()
    valid = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    payload = {
        "customer_id": customer["id"],
        "date": today,
        "valid_until": valid,
        "items": [
            {"service_name": "Logo", "description": "", "quantity": 2, "rate": 1000, "discount_percent": 10, "tax_percent": 18}
        ],
        "notes": "test",
        "terms": "50% advance",
        "status": "accepted",
    }
    r = client.post(f"{BASE}/api/quotations", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    # 2*1000=2000; discount 10% = 200; taxable 1800; tax 18% = 324; total 2124
    assert d["subtotal"] == 2000
    assert d["discount_total"] == 200
    assert round(d["tax_total"], 2) == 324
    assert d["total"] == 2124
    assert d["status"] == "accepted"
    assert d["quotation_number"].startswith("QT-")
    yield d


def test_quotation_list_and_get(client, quotation):
    r = client.get(f"{BASE}/api/quotations", timeout=15)
    assert r.status_code == 200
    assert any(q["id"] == quotation["id"] for q in r.json())
    r2 = client.get(f"{BASE}/api/quotations/{quotation['id']}", timeout=15)
    assert r2.status_code == 200
    assert r2.json()["total"] == 2124


def test_quotation_pdf(client, quotation):
    r = client.get(f"{BASE}/api/quotations/{quotation['id']}/pdf", timeout=20)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert r.content.startswith(b"%PDF")
    assert len(r.content) > 500


# ---------- INVOICES via convert-to-invoice ----------
@pytest.fixture(scope="session")
def invoice(client, quotation):
    r = client.post(f"{BASE}/api/quotations/{quotation['id']}/convert-to-invoice", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["quotation_id"] == quotation["id"]
    assert d["total"] == 2124
    assert d["due_amount"] == 2124
    assert d["paid_amount"] == 0
    assert d["invoice_number"].startswith("INV-")
    yield d


def test_convert_twice_blocked(client, quotation, invoice):
    r = client.post(f"{BASE}/api/quotations/{quotation['id']}/convert-to-invoice", timeout=15)
    assert r.status_code == 400


def test_direct_invoice_create(client, customer):
    today = datetime.now(timezone.utc).isoformat()
    payload = {
        "customer_id": customer["id"],
        "invoice_date": today,
        "due_date": (datetime.now(timezone.utc) + timedelta(days=15)).isoformat(),
        "items": [{"service_name": "Direct", "quantity": 1, "rate": 5000, "discount_percent": 0, "tax_percent": 0}],
        "status": "sent",
    }
    r = client.post(f"{BASE}/api/invoices", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["total"] == 5000
    assert d["due_amount"] == 5000
    # cleanup
    client.delete(f"{BASE}/api/invoices/{d['id']}", timeout=15)


def test_invoice_pdf(client, invoice):
    r = client.get(f"{BASE}/api/invoices/{invoice['id']}/pdf", timeout=20)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert r.content.startswith(b"%PDF")


# ---------- PAYMENTS: partial + full ----------
def test_payments_flow(client, customer, invoice):
    today = datetime.now(timezone.utc).isoformat()
    # partial 1000
    r1 = client.post(f"{BASE}/api/payments", json={
        "customer_id": customer["id"], "invoice_id": invoice["id"], "payment_date": today,
        "amount": 1000, "method": "upi", "reference_number": "UPI1",
    }, timeout=15)
    assert r1.status_code == 200
    inv = client.get(f"{BASE}/api/invoices/{invoice['id']}", timeout=15).json()
    assert inv["paid_amount"] == 1000
    assert inv["due_amount"] == 1124
    assert inv["status"] == "partially_paid"

    # remaining 1124
    r2 = client.post(f"{BASE}/api/payments", json={
        "customer_id": customer["id"], "invoice_id": invoice["id"], "payment_date": today,
        "amount": 1124, "method": "bank_transfer",
    }, timeout=15)
    assert r2.status_code == 200
    inv2 = client.get(f"{BASE}/api/invoices/{invoice['id']}", timeout=15).json()
    assert inv2["paid_amount"] == 2124
    assert inv2["due_amount"] == 0
    assert inv2["status"] == "paid"


# ---------- CREDIT PURCHASES ----------
def test_credit_purchases_multiple(client, customer):
    ids = []
    for credits, amt in [(20000, 2300), (5000, 575)]:
        r = client.post(f"{BASE}/api/credit-purchases", json={
            "customer_id": customer["id"],
            "date": datetime.now(timezone.utc).isoformat(),
            "provider": "MSG91",
            "credits_purchased": credits,
            "amount_paid": amt,
            "campaign_name": "Diwali",
        }, timeout=15)
        assert r.status_code == 200, r.text
        ids.append(r.json()["id"])

    r2 = client.get(f"{BASE}/api/credit-purchases", params={"customer_id": customer["id"]}, timeout=15)
    assert r2.status_code == 200
    rows = r2.json()
    assert len(rows) >= 2
    # Confirm NO wallet/balance/remaining field on model
    for row in rows:
        forbidden = {"balance", "remaining", "remaining_credits", "wallet"}
        assert forbidden.isdisjoint(row.keys()), f"Wallet-like field found: {row.keys()}"

    # summary
    summary = client.get(f"{BASE}/api/customers/{customer['id']}/summary", timeout=15).json()
    assert summary["credit_purchase_count"] >= 2
    assert summary["credit_purchase_cost"] >= 2875

    for i in ids:
        client.delete(f"{BASE}/api/credit-purchases/{i}", timeout=15)


# ---------- DASHBOARD ----------
def test_dashboard(client):
    r = client.get(f"{BASE}/api/dashboard/summary", timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ["total_sales", "total_paid", "total_due", "total_credit_purchase_count",
              "total_credit_spend", "month_sales", "month_payments",
              "recent_invoices", "recent_payments", "recent_credit_purchases"]:
        assert k in d


# ---------- REPORTS ----------
def test_reports(client):
    now = datetime.now(timezone.utc)
    df = (now - timedelta(days=30)).isoformat()
    dt = (now + timedelta(days=1)).isoformat()
    for path in ["sales", "payments", "outstanding", "credit-purchases", "profit"]:
        r = client.get(f"{BASE}/api/reports/{path}", params={"date_from": df, "date_to": dt}, timeout=15)
        assert r.status_code == 200, f"{path}: {r.text}"

    r2 = client.get(f"{BASE}/api/reports/monthly", params={"month": now.month, "year": now.year}, timeout=15)
    assert r2.status_code == 200
    d = r2.json()
    for k in ["sales", "payments_received", "outstanding", "credit_purchase_amount"]:
        assert k in d


# ---------- Search/Filter ----------
def test_quotation_filters(client, customer):
    r = client.get(f"{BASE}/api/quotations", params={"status": "accepted"}, timeout=15)
    assert r.status_code == 200
    for q in r.json():
        assert q["status"] == "accepted"


def test_invoice_filters(client):
    r = client.get(f"{BASE}/api/invoices", params={"status": "paid"}, timeout=15)
    assert r.status_code == 200


# ---------- Deletion of quotation ----------
def test_delete_quotation_and_invoice(client, customer):
    # Create quick quotation
    today = datetime.now(timezone.utc).isoformat()
    r = client.post(f"{BASE}/api/quotations", json={
        "customer_id": customer["id"], "date": today,
        "items": [{"service_name": "TmpQ", "quantity": 1, "rate": 100}],
        "status": "draft",
    }, timeout=15)
    assert r.status_code == 200
    qid = r.json()["id"]
    r2 = client.delete(f"{BASE}/api/quotations/{qid}", timeout=15)
    assert r2.status_code == 200
    r3 = client.get(f"{BASE}/api/quotations/{qid}", timeout=15)
    assert r3.status_code == 404


# ---------- NEW: Overdue detection ----------
def test_overdue_invoice_status_persist(client, customer):
    """Invoice with due_date in past and no payments should be flagged as overdue on list/get and persisted."""
    today = datetime.now(timezone.utc)
    past = (today - timedelta(days=5)).isoformat()
    r = client.post(f"{BASE}/api/invoices", json={
        "customer_id": customer["id"],
        "invoice_date": (today - timedelta(days=20)).isoformat(),
        "due_date": past,
        "items": [{"service_name": "TEST_Overdue", "quantity": 1, "rate": 1000}],
        "status": "sent",
    }, timeout=15)
    assert r.status_code == 200, r.text
    inv = r.json()
    iid = inv["id"]
    # GET should return overdue
    g = client.get(f"{BASE}/api/invoices/{iid}", timeout=15)
    assert g.status_code == 200
    assert g.json()["status"] == "overdue", f"Expected overdue, got {g.json()['status']}"

    # LIST should also mark overdue
    lst = client.get(f"{BASE}/api/invoices", timeout=15).json()
    match = [x for x in lst if x["id"] == iid]
    assert match and match[0]["status"] == "overdue"

    # Non-overdue: future due date should NOT be overdue
    future = (today + timedelta(days=10)).isoformat()
    r2 = client.post(f"{BASE}/api/invoices", json={
        "customer_id": customer["id"],
        "invoice_date": today.isoformat(),
        "due_date": future,
        "items": [{"service_name": "TEST_Future", "quantity": 1, "rate": 500}],
        "status": "sent",
    }, timeout=15)
    assert r2.status_code == 200
    iid2 = r2.json()["id"]
    g2 = client.get(f"{BASE}/api/invoices/{iid2}", timeout=15)
    assert g2.json()["status"] != "overdue"

    # cleanup
    client.delete(f"{BASE}/api/invoices/{iid}", timeout=15)
    client.delete(f"{BASE}/api/invoices/{iid2}", timeout=15)


# ---------- NEW: Duplicate invoice ----------
def test_duplicate_invoice(client, customer):
    today = datetime.now(timezone.utc).isoformat()
    r = client.post(f"{BASE}/api/invoices", json={
        "customer_id": customer["id"],
        "invoice_date": today,
        "due_date": (datetime.now(timezone.utc) + timedelta(days=15)).isoformat(),
        "items": [
            {"service_name": "TEST_Dup_A", "quantity": 2, "rate": 500, "discount_percent": 0, "tax_percent": 18},
            {"service_name": "TEST_Dup_B", "quantity": 1, "rate": 1000},
        ],
        "status": "sent",
    }, timeout=15)
    assert r.status_code == 200, r.text
    orig = r.json()

    # Duplicate
    d = client.post(f"{BASE}/api/invoices/{orig['id']}/duplicate", timeout=15)
    assert d.status_code == 200, d.text
    dup = d.json()
    assert dup["id"] != orig["id"]
    assert dup["invoice_number"] != orig["invoice_number"]
    assert dup["status"] == "draft"
    assert dup["customer_id"] == orig["customer_id"]
    assert dup["total"] == orig["total"]
    assert dup["due_amount"] == dup["total"]
    assert dup["paid_amount"] == 0
    assert len(dup["items"]) == len(orig["items"])
    assert dup["items"][0]["service_name"] == orig["items"][0]["service_name"]

    # Verify persisted
    g = client.get(f"{BASE}/api/invoices/{dup['id']}", timeout=15)
    assert g.status_code == 200
    assert g.json()["invoice_number"] == dup["invoice_number"]

    client.delete(f"{BASE}/api/invoices/{orig['id']}", timeout=15)
    client.delete(f"{BASE}/api/invoices/{dup['id']}", timeout=15)


# ---------- NEW: Dashboard trend endpoint ----------
def test_dashboard_trend(client):
    r = client.get(f"{BASE}/api/dashboard/trend", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    # Expect list of 6 months or object with a list
    if isinstance(data, dict):
        # try common keys
        for k in ("trend", "months", "data"):
            if k in data and isinstance(data[k], list):
                data = data[k]
                break
    assert isinstance(data, list), f"Expected list, got {type(data)}: {data}"
    assert len(data) == 6, f"Expected 6 months, got {len(data)}"
    for item in data:
        assert "month" in item
        assert "sales" in item
        assert "payments" in item
        assert isinstance(item["sales"], (int, float))
        assert isinstance(item["payments"], (int, float))

