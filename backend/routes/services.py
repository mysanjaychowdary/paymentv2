from fastapi import APIRouter, Request, HTTPException, Depends
from bson import ObjectId

from models import Service, ServiceCreate
from auth import get_current_user

router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("")
async def list_services(request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    docs = await db.services.find({}).sort("name", 1).to_list(1000)
    return [Service.from_mongo(d) for d in docs]


@router.post("")
async def create_service(payload: ServiceCreate, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    service = Service(**payload.model_dump())
    result = await db.services.insert_one(service.to_mongo())
    doc = await db.services.find_one({"_id": result.inserted_id})
    return Service.from_mongo(doc)


@router.put("/{service_id}")
async def update_service(service_id: str, payload: ServiceCreate, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    result = await db.services.update_one({"_id": ObjectId(service_id)}, {"$set": payload.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    doc = await db.services.find_one({"_id": ObjectId(service_id)})
    return Service.from_mongo(doc)


@router.delete("/{service_id}")
async def delete_service(service_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db
    result = await db.services.delete_one({"_id": ObjectId(service_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "Service deleted"}
