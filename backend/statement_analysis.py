import io
import json
import os
import re
import pandas as pd
import fitz  # pymupdf
from openai import AsyncOpenAI

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")

CATEGORY_TAXONOMY = [
    "Client Payment", "Vendor Payment", "Credit Purchase (WhatsApp/SMS)", "Salary/Wages",
    "Rent", "Utilities", "Software/Subscriptions", "Marketing/Ads Spend", "Bank Charges",
    "Taxes/GST", "Loan/EMI", "Transfer", "Cash Withdrawal", "Refund", "Income - Other", "Other Expense",
]

MAX_TRANSACTIONS_FOR_LLM = 400
MAX_PDF_TEXT_CHARS = 16000


def _clean_json_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text.strip(), flags=re.IGNORECASE).strip()
    text = re.sub(r"```$", "", text.strip()).strip()
    return text


async def _call_llm(system_message: str, user_text: str, api_key: str) -> dict:
    client = AsyncOpenAI(base_url=OPENROUTER_BASE_URL, api_key=api_key)
    completion = await client.chat.completions.create(
        model=OPENROUTER_MODEL,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_text},
        ],
        temperature=0.3,
    )
    response = completion.choices[0].message.content or ""
    cleaned = _clean_json_text(response)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def extract_transactions_from_tabular(file_bytes: bytes, ext: str) -> list:
    if ext == "csv":
        df = pd.read_csv(io.BytesIO(file_bytes))
    else:
        df = pd.read_excel(io.BytesIO(file_bytes))
    df.columns = [str(c).strip().lower() for c in df.columns]

    def find_col(*keywords):
        for col in df.columns:
            if any(kw in col for kw in keywords):
                return col
        return None

    date_col = find_col("date")
    desc_col = find_col("description", "narration", "particular", "details", "remarks")
    debit_col = find_col("debit", "withdrawal")
    credit_col = find_col("credit", "deposit")
    amount_col = find_col("amount")
    balance_col = find_col("balance")

    transactions = []
    for _, row in df.iterrows():
        amount = None
        txn_type = None
        if debit_col or credit_col:
            debit = pd.to_numeric(row.get(debit_col), errors="coerce") if debit_col else None
            credit = pd.to_numeric(row.get(credit_col), errors="coerce") if credit_col else None
            debit = 0 if pd.isna(debit) else debit
            credit = 0 if pd.isna(credit) else credit
            if credit and credit != 0:
                amount, txn_type = float(credit), "credit"
            elif debit and debit != 0:
                amount, txn_type = float(debit), "debit"
        elif amount_col:
            val = pd.to_numeric(row.get(amount_col), errors="coerce")
            if not pd.isna(val):
                amount = abs(float(val))
                txn_type = "credit" if val >= 0 else "debit"
        if amount is None or amount == 0:
            continue
        date_val = row.get(date_col) if date_col else None
        parsed_date = pd.to_datetime(date_val, errors="coerce", dayfirst=True) if date_val is not None else None
        transactions.append({
            "date": parsed_date.strftime("%Y-%m-%d") if parsed_date is not None and not pd.isna(parsed_date) else str(date_val or ""),
            "description": str(row.get(desc_col, "")) if desc_col else "",
            "amount": round(amount, 2),
            "type": txn_type,
            "balance": float(row.get(balance_col)) if balance_col and not pd.isna(row.get(balance_col)) else None,
        })
    return transactions[:MAX_TRANSACTIONS_FOR_LLM]


def extract_text_from_pdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    parts = []
    for page in doc:
        parts.append(page.get_text())
    doc.close()
    text = "\n".join(parts)
    return text[:MAX_PDF_TEXT_CHARS]


async def analyze_tabular_transactions(transactions: list, api_key: str) -> dict:
    system_message = (
        "You are a financial analyst assistant for a freelancer running a digital marketing & messaging "
        "services business. You categorize bank transactions and give concise, practical recommendations. "
        f"Use ONLY these categories: {', '.join(CATEGORY_TAXONOMY)}. "
        "Respond with STRICT JSON only, no markdown, matching this schema: "
        '{"categories": [{"index": <int>, "category": "<one of the categories>"}], '
        '"summary": "<2-3 sentence overview of the financial period>", '
        '"recommendations": ["<actionable recommendation>", ...4-6 items]}'
    )
    payload = [{"index": i, "date": t["date"], "description": t["description"], "amount": t["amount"], "type": t["type"]} for i, t in enumerate(transactions)]
    user_text = f"Categorize these {len(payload)} bank transactions and give recommendations:\n{json.dumps(payload)}"
    result = await _call_llm(system_message, user_text, api_key)
    category_map = {c["index"]: c["category"] for c in result.get("categories", [])}
    for i, t in enumerate(transactions):
        t["category"] = category_map.get(i, "Other Expense" if t["type"] == "debit" else "Income - Other")
    return {
        "transactions": transactions,
        "summary": result.get("summary", ""),
        "recommendations": result.get("recommendations", []),
    }


async def analyze_pdf_text(text: str, api_key: str) -> dict:
    system_message = (
        "You are a financial analyst assistant for a freelancer running a digital marketing & messaging "
        "services business. You extract transactions from raw bank statement text, categorize them, and give "
        f"concise practical recommendations. Use ONLY these categories: {', '.join(CATEGORY_TAXONOMY)}. "
        "Respond with STRICT JSON only, no markdown, matching this schema: "
        '{"transactions": [{"date": "YYYY-MM-DD", "description": "<text>", "amount": <positive number>, '
        '"type": "credit"|"debit", "category": "<one of the categories>"}], '
        '"summary": "<2-3 sentence overview of the financial period>", '
        '"recommendations": ["<actionable recommendation>", ...4-6 items]}'
    )
    user_text = f"Extract, categorize and analyze all transactions from this bank statement text:\n\n{text}"
    result = await _call_llm(system_message, user_text, api_key)
    return {
        "transactions": result.get("transactions", []),
        "summary": result.get("summary", ""),
        "recommendations": result.get("recommendations", []),
    }


def build_category_breakdown(transactions: list) -> list:
    totals = {}
    for t in transactions:
        cat = t.get("category", "Other Expense")
        entry = totals.setdefault(cat, {"category": cat, "amount": 0.0, "count": 0})
        entry["amount"] += t.get("amount", 0) or 0
        entry["count"] += 1
    breakdown = list(totals.values())
    for b in breakdown:
        b["amount"] = round(b["amount"], 2)
    breakdown.sort(key=lambda x: x["amount"], reverse=True)
    return breakdown
