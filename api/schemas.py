"""
FastAPI Banking Application — Pydantic Schemas
================================================
Request/Response models for API validation.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


# ── Enums ──────────────────────────────────────────────────

class AccountType(str, Enum):
    savings = "savings"
    checking = "checking"
    wallet = "wallet"
    loan = "loan"


class TransactionType(str, Enum):
    deposit = "DEPOSIT"
    withdrawal = "WITHDRAWAL"
    transfer = "TRANSFER"
    payment = "PAYMENT"


# ── Auth Schemas ───────────────────────────────────────────

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)
    email: str = Field(..., max_length=100)
    full_name: str = Field(..., min_length=2, max_length=100)
    date_of_birth: date
    phone_number: Optional[str] = Field(None, max_length=20)


class UserLogin(BaseModel):
    username: str
    password: str


class EmployeeLogin(BaseModel):
    employee_id: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=6, max_length=128)


class AdminAccountCreate(BaseModel):
    user_id: int
    account_type: str = Field(..., pattern="^(savings|checking|wallet)$")
    currency: str = Field(default="INR", max_length=3)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    role: str


# ── User Schemas ───────────────────────────────────────────

class UserProfile(BaseModel):
    user_id: int
    username: str
    email: str
    full_name: str
    phone_number: Optional[str]
    date_of_birth: Optional[str]
    kyc_status: str
    role: str
    is_active: bool
    created_at: Optional[str]


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None


class PinUpdate(BaseModel):
    new_pin: str = Field(..., min_length=4, max_length=6, pattern=r"^\d{4,6}$")


class PasswordChange(BaseModel):
    old_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6, max_length=128)


# ── Account Schemas ────────────────────────────────────────

class AccountCreate(BaseModel):
    account_type: AccountType
    currency: str = Field(default="USD", max_length=3)


class AccountResponse(BaseModel):
    account_id: int
    account_number: str
    account_type: str
    currency: str
    current_balance: float
    status: str
    created_at: Optional[str]


class BalanceResponse(BaseModel):
    account_number: str
    account_type: str
    currency: str
    current_balance: float
    status: str


# ── Transaction Schemas ────────────────────────────────────

class DepositRequest(BaseModel):
    account_id: int
    amount: float = Field(..., gt=0, description="Amount to deposit (must be positive)")
    description: Optional[str] = "Cash Deposit"
    password: str


class WithdrawRequest(BaseModel):
    account_id: int
    amount: float = Field(..., gt=0, description="Amount to withdraw (must be positive)")
    description: Optional[str] = "Cash Withdrawal"
    password: str


class TransferRequest(BaseModel):
    sender_account_id: int
    receiver_account_id: int
    amount: float = Field(..., gt=0, description="Amount to transfer (must be positive)")
    description: Optional[str] = "Fund Transfer"
    password: str


class BalanceCheckRequest(BaseModel):
    account_id: int
    password: str


class TransactionResponse(BaseModel):
    transaction_id: int
    reference_id: str
    type: str
    description: Optional[str]
    amount: float
    status: str
    created_at: Optional[str]


class TransactionHistoryItem(BaseModel):
    transaction_id: int
    transaction_date: Optional[str]
    type: str
    narrative: Optional[str]
    amount: float
    balance_after: float
    status: str


# ── Analytics Schemas ──────────────────────────────────────

class RiskScoreResponse(BaseModel):
    transaction_id: int
    risk_score: float
    verdict: str
    features_used: Optional[str]
    scored_at: Optional[str]


class SpendingPrediction(BaseModel):
    predicted_next_month: float
    average_monthly: float
    trend: str  # "increasing", "decreasing", "stable"
    monthly_data: List[dict]


class SpendingSummary(BaseModel):
    total_income: float
    total_expenses: float
    net_flow: float
    transaction_count: int


# ── Generic ────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    success: bool = True
    data: Optional[dict] = None
