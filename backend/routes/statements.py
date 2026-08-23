import uuid
import os
from fastapi import APIRouter, Request, HTTPException, Depends, UploadFile, File

from models import BankStatement
from auth import get_current_user
from storage import put_object
from statement_analysis import (
    extract_transactions_from_tabular,
    extract_text_from_pdf,
    analyze_tabular_transactions,
    analyze_pdf_text,
    build_category_breakdown,
)

router = APIRouter(prefix="/api/statements", tags=["statements"])

ALLOWED_EXT = {"csv", "xlsx", "xls", "pdf"}
MIME_TYPES = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xls": "application/vnd.ms-excel",
    "pdf": "application/pdf",
}


@router.get("")
async def list_statements(request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    docs = await db.bank_statements.find({}, {"transactions": 0}).sort("created_at", -1).to_list(500)
    return [BankStatement.from_mongo({**d, "transactions": []}) for d in docs]


@router.post("/upload")
async def upload_statement(request: Request, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    filename = file.filename or "statement"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a PDF, CSV or Excel file.")

    data = await file.read()
    storage_path = f"sanju-animations-biz-manager/statements/{uuid.uuid4()}.{ext}"
    try:
        put_object(storage_path, data, MIME_TYPES.get(ext, "application/octet-stream"))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to store file: {e}")

    statement = BankStatement(filename=filename, storage_path=storage_path, content_type=MIME_TYPES.get(ext, ""), status="processing")
    result = await db.bank_statements.insert_one(statement.to_mongo())
    statement_id = result.inserted_id

    api_key = os.environ.get("OPENROUTER_API_KEY")
    try:
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured. Get a free key at https://openrouter.ai/keys and add it to backend/.env")
        if ext in ("csv", "xlsx", "xls"):
            transactions = extract_transactions_from_tabular(data, ext)
            if not transactions:
                raise ValueError("No transactions could be detected in this file.")
            analysis = await analyze_tabular_transactions(transactions, api_key)
        else:
            text = extract_text_from_pdf(data)
            if not text.strip():
                raise ValueError("No readable text found in this PDF. It may be a scanned image.")
            analysis = await analyze_pdf_text(text, api_key)

        txns = analysis["transactions"]
        total_income = round(sum(t["amount"] for t in txns if t.get("type") == "credit"), 2)
        total_expense = round(sum(t["amount"] for t in txns if t.get("type") == "debit"), 2)
        dates = sorted([t["date"] for t in txns if t.get("date")])
        update_doc = {
            "status": "completed",
            "transactions": txns,
            "transaction_count": len(txns),
            "total_income": total_income,
            "total_expense": total_expense,
            "net": round(total_income - total_expense, 2),
            "category_breakdown": build_category_breakdown(txns),
            "recommendations": analysis.get("recommendations", []),
            "summary": analysis.get("summary", ""),
            "period_start": dates[0] if dates else None,
            "period_end": dates[-1] if dates else None,
        }
    except Exception as e:
        update_doc = {"status": "failed", "error_message": str(e)}

    await db.bank_statements.update_one({"_id": statement_id}, {"$set": update_doc})
    doc = await db.bank_statements.find_one({"_id": statement_id})
    return BankStatement.from_mongo(doc)


@router.get("/{statement_id}")
async def get_statement(statement_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    from bson import ObjectId
    db = request.app.state.db
    doc = await db.bank_statements.find_one({"_id": ObjectId(statement_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Statement not found")
    return BankStatement.from_mongo(doc)


@router.delete("/{statement_id}")
async def delete_statement(statement_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    from bson import ObjectId
    db = request.app.state.db
    result = await db.bank_statements.delete_one({"_id": ObjectId(statement_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Statement not found")
    return {"message": "Statement deleted"}
