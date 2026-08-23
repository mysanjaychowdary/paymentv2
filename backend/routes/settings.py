from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response

from models import CompanySettings, CompanySettingsUpdate
from auth import get_current_user
from utils import get_or_create_settings
from storage import put_object, get_object

router = APIRouter(prefix="/api/settings", tags=["settings"])

LOGO_MIME = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}


@router.get("")
async def get_settings(request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    doc = await get_or_create_settings(db)
    return CompanySettings.from_mongo(doc)


@router.put("")
async def update_settings(payload: CompanySettingsUpdate, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    doc = await get_or_create_settings(db)
    update_doc = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    update_doc["updated_at"] = datetime.now(timezone.utc)
    await db.settings.update_one({"_id": doc["_id"]}, {"$set": update_doc})
    doc = await db.settings.find_one({"_id": doc["_id"]})
    return CompanySettings.from_mongo(doc)


@router.post("/logo")
async def upload_logo(request: Request, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    filename = file.filename or "logo"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in LOGO_MIME:
        raise HTTPException(status_code=400, detail="Unsupported logo format. Use PNG, JPG or WEBP (SVG can't be embedded in PDFs).")
    data = await file.read()
    doc = await get_or_create_settings(db)
    storage_path = f"sanju-animations-biz-manager/settings/logo.{ext}"
    put_object(storage_path, data, LOGO_MIME[ext])
    await db.settings.update_one(
        {"_id": doc["_id"]},
        {"$set": {"logo_path": storage_path, "logo_content_type": LOGO_MIME[ext], "updated_at": datetime.now(timezone.utc)}},
    )
    doc = await db.settings.find_one({"_id": doc["_id"]})
    return CompanySettings.from_mongo(doc)


@router.get("/logo")
async def get_logo(request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    doc = await get_or_create_settings(db)
    logo_path = doc.get("logo_path")
    if not logo_path:
        raise HTTPException(status_code=404, detail="No logo uploaded")
    data, content_type = get_object(logo_path)
    return Response(content=data, media_type=content_type)


@router.delete("/logo")
async def delete_logo(request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    doc = await get_or_create_settings(db)
    await db.settings.update_one({"_id": doc["_id"]}, {"$set": {"logo_path": None, "logo_content_type": None}})
    return {"message": "Logo removed"}
