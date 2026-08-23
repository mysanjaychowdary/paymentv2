from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging

from auth import auth_router, seed_admin
from routes.customers import router as customers_router
from routes.services import router as services_router
from routes.quotations import router as quotations_router
from routes.invoices import router as invoices_router
from routes.payments import router as payments_router
from routes.credit_purchases import router as credit_purchases_router
from routes.dashboard import router as dashboard_router
from routes.reports import router as reports_router
from routes.statements import router as statements_router
from routes.settings import router as settings_router
from storage import init_storage

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
app.state.db = db

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Sanju Animations IT Solutions - Business Manager API"}

app.include_router(api_router)
app.include_router(auth_router)
app.include_router(customers_router)
app.include_router(services_router)
app.include_router(quotations_router)
app.include_router(invoices_router)
app.include_router(payments_router)
app.include_router(credit_purchases_router)
app.include_router(dashboard_router)
app.include_router(reports_router)
app.include_router(statements_router)
app.include_router(settings_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    await seed_admin(db)
    await db.users.create_index("email", unique=True)
    await db.customers.create_index("name")
    await db.quotations.create_index("customer_id")
    await db.invoices.create_index("customer_id")
    await db.payments.create_index("invoice_id")
    await db.credit_purchases.create_index("customer_id")
    await db.login_attempts.create_index("identifier")
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    logger.info("Startup complete: admin seeded, indexes created")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
