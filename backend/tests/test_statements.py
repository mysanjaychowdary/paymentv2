"""
Backend tests for the Bank Statement Analyzer module.
Covers: upload (CSV/XLSX/PDF), invalid file rejection, list/get/delete,
AI analysis fields present, no customer_id/invoice_id linkage (standalone).
"""
import io
import os
import time
import pytest
import requests
import pandas as pd
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.strip().split("=", 1)[1]
BASE = BASE.rstrip("/")

ADMIN_EMAIL = "admin@sanjuanimations.com"
ADMIN_PASSWORD = "Sanju@2026"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200
    return s


def _sample_rows():
    return [
        {"Date": "2025-11-01", "Narration": "NEFT-Client Payment Acme Corp", "Debit": 0, "Credit": 25000, "Balance": 125000},
        {"Date": "2025-11-03", "Narration": "GUPSHUP WhatsApp Credit Purchase", "Debit": 5900, "Credit": 0, "Balance": 119100},
        {"Date": "2025-11-05", "Narration": "Google Ads Payment", "Debit": 12000, "Credit": 0, "Balance": 107100},
        {"Date": "2025-11-07", "Narration": "Salary paid to Ramesh", "Debit": 25000, "Credit": 0, "Balance": 82100},
        {"Date": "2025-11-10", "Narration": "Office Rent Nov", "Debit": 15000, "Credit": 0, "Balance": 67100},
        {"Date": "2025-11-12", "Narration": "UPI-Client Payment Beta Studios", "Debit": 0, "Credit": 18000, "Balance": 85100},
        {"Date": "2025-11-15", "Narration": "GST Payment Q2", "Debit": 3500, "Credit": 0, "Balance": 81600},
        {"Date": "2025-11-18", "Narration": "Bank Service Charge", "Debit": 590, "Credit": 0, "Balance": 81010},
        {"Date": "2025-11-20", "Narration": "ATM Cash Withdrawal", "Debit": 5000, "Credit": 0, "Balance": 76010},
        {"Date": "2025-11-25", "Narration": "MSG91 SMS Credit Top-up", "Debit": 1200, "Credit": 0, "Balance": 74810},
    ]


def _csv_bytes():
    df = pd.DataFrame(_sample_rows())
    return df.to_csv(index=False).encode("utf-8")


def _xlsx_bytes():
    df = pd.DataFrame(_sample_rows())
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    return buf.getvalue()


def _pdf_bytes():
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 800, "TEST BANK STATEMENT")
    c.setFont("Helvetica", 9)
    y = 770
    c.drawString(50, y, "Date        Description                              Amount     Type")
    y -= 20
    for r in _sample_rows():
        typ = "credit" if r["Credit"] else "debit"
        amt = r["Credit"] or r["Debit"]
        c.drawString(50, y, f"{r['Date']}  {r['Narration'][:40]:<40} {amt:>8}  {typ}")
        y -= 15
    c.showPage()
    c.save()
    return buf.getvalue()


def _wait_completed(client, sid, timeout=90):
    """Upload is synchronous in this app but be defensive."""
    end = time.time() + timeout
    while time.time() < end:
        r = client.get(f"{BASE}/api/statements/{sid}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        if d["status"] in ("completed", "failed"):
            return d
        time.sleep(2)
    pytest.fail("Statement did not complete in time")


def _assert_analysis_shape(data):
    assert data["status"] == "completed", f"failed: {data.get('error_message')}"
    assert data["transaction_count"] > 0
    assert data["total_income"] > 0
    assert data["total_expense"] > 0
    assert isinstance(data["category_breakdown"], list) and len(data["category_breakdown"]) > 0
    assert isinstance(data["recommendations"], list) and len(data["recommendations"]) >= 1
    assert isinstance(data["summary"], str) and len(data["summary"]) > 5
    assert isinstance(data["transactions"], list) and len(data["transactions"]) > 0
    for t in data["transactions"]:
        assert "category" in t
        assert t["type"] in ("credit", "debit")
    # standalone: no customer/invoice linking fields
    forbidden = {"customer_id", "invoice_id", "customer_name", "invoice_number"}
    assert forbidden.isdisjoint(data.keys()), f"Forbidden linkage field found: {data.keys()}"


# ---------- list (initial) ----------
def test_list_statements_empty_or_prior(client):
    r = client.get(f"{BASE}/api/statements", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- unauthenticated ----------
def test_upload_requires_auth():
    r = requests.post(f"{BASE}/api/statements/upload", files={"file": ("x.csv", b"a,b\n1,2", "text/csv")}, timeout=15)
    assert r.status_code == 401


# ---------- unsupported ext ----------
def test_unsupported_extension_rejected(client):
    r = client.post(f"{BASE}/api/statements/upload",
                    files={"file": ("resume.docx", b"hello", "application/octet-stream")}, timeout=30)
    assert r.status_code == 400
    assert "Unsupported" in r.json().get("detail", "")


# ---------- CSV happy path ----------
@pytest.fixture(scope="module")
def csv_statement(client):
    r = client.post(f"{BASE}/api/statements/upload",
                    files={"file": ("TEST_statement.csv", _csv_bytes(), "text/csv")}, timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    sid = d["id"]
    data = _wait_completed(client, sid)
    yield data
    client.delete(f"{BASE}/api/statements/{sid}", timeout=15)


def test_csv_analysis(csv_statement):
    _assert_analysis_shape(csv_statement)
    # expected income = 25000 + 18000 = 43000
    assert csv_statement["total_income"] == pytest.approx(43000, rel=0.01)
    # expected expense sum
    expected_expense = 5900 + 12000 + 25000 + 15000 + 3500 + 590 + 5000 + 1200
    assert csv_statement["total_expense"] == pytest.approx(expected_expense, rel=0.01)


def test_csv_appears_in_list(client, csv_statement):
    r = client.get(f"{BASE}/api/statements", timeout=15)
    assert r.status_code == 200
    ids = [s["id"] for s in r.json()]
    assert csv_statement["id"] in ids


# ---------- XLSX happy path ----------
def test_xlsx_upload_analysis(client):
    r = client.post(f"{BASE}/api/statements/upload",
                    files={"file": ("TEST_statement.xlsx", _xlsx_bytes(),
                                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                    timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    sid = d["id"]
    try:
        data = _wait_completed(client, sid)
        _assert_analysis_shape(data)
        assert data["total_income"] == pytest.approx(43000, rel=0.01)
    finally:
        client.delete(f"{BASE}/api/statements/{sid}", timeout=15)


# ---------- PDF happy path ----------
def test_pdf_upload_analysis(client):
    r = client.post(f"{BASE}/api/statements/upload",
                    files={"file": ("TEST_statement.pdf", _pdf_bytes(), "application/pdf")}, timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    sid = d["id"]
    try:
        data = _wait_completed(client, sid)
        # PDF text extraction + LLM
        assert data["status"] == "completed", f"failed: {data.get('error_message')}"
        assert data["transaction_count"] > 0
        assert isinstance(data["recommendations"], list) and len(data["recommendations"]) >= 1
    finally:
        client.delete(f"{BASE}/api/statements/{sid}", timeout=15)


# ---------- Delete + 404 ----------
def test_delete_statement(client):
    r = client.post(f"{BASE}/api/statements/upload",
                    files={"file": ("TEST_del.csv", _csv_bytes(), "text/csv")}, timeout=180)
    assert r.status_code == 200
    sid = r.json()["id"]
    d = client.delete(f"{BASE}/api/statements/{sid}", timeout=15)
    assert d.status_code == 200
    g = client.get(f"{BASE}/api/statements/{sid}", timeout=15)
    assert g.status_code == 404
