from typing import Annotated, Optional, List
from pydantic import BaseModel, BeforeValidator, Field, ConfigDict, EmailStr
from datetime import datetime, timezone
from bson import ObjectId


def validate_object_id(v):
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str) and ObjectId.is_valid(v):
        return v
    raise ValueError("Invalid ObjectId")


PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    id: Optional[PyObjectId] = Field(default=None, validation_alias="_id", serialization_alias="id")

    @classmethod
    def from_mongo(cls, doc):
        if doc is None:
            return None
        doc = dict(doc)
        doc["_id"] = str(doc["_id"])
        return cls(**doc)

    def to_mongo(self):
        data = self.model_dump(by_alias=True, exclude={"id"})
        return data


def now_utc():
    return datetime.now(timezone.utc)


# ---------- User ----------
class User(BaseDocument):
    email: EmailStr
    password_hash: str
    name: str
    role: str = "admin"
    created_at: datetime = Field(default_factory=now_utc)


# ---------- Customer ----------
class Customer(BaseDocument):
    name: str
    company_name: Optional[str] = ""
    mobile: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    gst_number: Optional[str] = ""
    notes: Optional[str] = ""
    created_at: datetime = Field(default_factory=now_utc)


class CustomerCreate(BaseModel):
    name: str
    company_name: Optional[str] = ""
    mobile: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    gst_number: Optional[str] = ""
    notes: Optional[str] = ""


# ---------- Service ----------
class Service(BaseDocument):
    name: str
    description: Optional[str] = ""
    default_price: float = 0
    created_at: datetime = Field(default_factory=now_utc)


class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    default_price: float = 0


# ---------- Line Item (embedded, shared by quotation/invoice) ----------
class LineItem(BaseModel):
    service_id: Optional[str] = None
    service_name: str
    description: Optional[str] = ""
    quantity: float = 1
    rate: float = 0
    discount_percent: float = 0
    tax_percent: float = 0
    amount: float = 0


# ---------- Quotation ----------
class Quotation(BaseDocument):
    quotation_number: str
    customer_id: str
    customer_name: str
    date: datetime
    valid_until: Optional[datetime] = None
    items: List[LineItem] = []
    subtotal: float = 0
    discount_total: float = 0
    tax_total: float = 0
    total: float = 0
    notes: Optional[str] = ""
    terms: Optional[str] = ""
    status: str = "draft"  # draft, sent, accepted, rejected, expired
    invoice_id: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class QuotationCreate(BaseModel):
    customer_id: str
    date: datetime
    valid_until: Optional[datetime] = None
    items: List[LineItem] = []
    notes: Optional[str] = ""
    terms: Optional[str] = ""
    status: Optional[str] = "draft"


# ---------- Invoice ----------
class Invoice(BaseDocument):
    invoice_number: str
    customer_id: str
    customer_name: str
    quotation_id: Optional[str] = None
    invoice_date: datetime
    due_date: Optional[datetime] = None
    items: List[LineItem] = []
    subtotal: float = 0
    discount_total: float = 0
    tax_total: float = 0
    total: float = 0
    paid_amount: float = 0
    due_amount: float = 0
    notes: Optional[str] = ""
    payment_terms: Optional[str] = ""
    status: str = "draft"  # draft, sent, partially_paid, paid, overdue, cancelled
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class InvoiceCreate(BaseModel):
    customer_id: str
    quotation_id: Optional[str] = None
    invoice_date: datetime
    due_date: Optional[datetime] = None
    items: List[LineItem] = []
    notes: Optional[str] = ""
    payment_terms: Optional[str] = ""
    status: Optional[str] = "draft"


# ---------- Payment ----------
class Payment(BaseDocument):
    customer_id: str
    customer_name: str
    invoice_id: str
    invoice_number: str
    payment_date: datetime
    amount: float
    method: str  # upi, bank_transfer, cash, card, other
    reference_number: Optional[str] = ""
    notes: Optional[str] = ""
    created_at: datetime = Field(default_factory=now_utc)


class PaymentCreate(BaseModel):
    customer_id: str
    invoice_id: str
    payment_date: datetime
    amount: float
    method: str
    reference_number: Optional[str] = ""
    notes: Optional[str] = ""


# ---------- Credit Purchase ----------
class CreditPurchase(BaseDocument):
    customer_id: str
    customer_name: str
    date: datetime
    provider: str
    credits_purchased: float
    amount_paid: float
    reference_number: Optional[str] = ""
    campaign_name: Optional[str] = ""
    notes: Optional[str] = ""
    created_at: datetime = Field(default_factory=now_utc)


class CreditPurchaseCreate(BaseModel):
    customer_id: str
    date: datetime
    provider: str
    credits_purchased: float
    amount_paid: float
    reference_number: Optional[str] = ""
    campaign_name: Optional[str] = ""
    notes: Optional[str] = ""


# ---------- Bank Statement Analyzer ----------
class BankStatement(BaseDocument):
    filename: str
    storage_path: str
    content_type: str
    status: str = "processing"  # processing, completed, failed
    error_message: Optional[str] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    total_income: float = 0
    total_expense: float = 0
    net: float = 0
    transaction_count: int = 0
    category_breakdown: List[dict] = []
    recommendations: List[str] = []
    summary: str = ""
    transactions: List[dict] = []
    created_at: datetime = Field(default_factory=now_utc)
