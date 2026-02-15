"""
FinTech Banking Application — FastAPI Server
==============================================
Main entry point for the REST API.

Run:
    cd api
    python -m uvicorn main:app --reload --port 8000

Swagger Docs: http://localhost:8000/docs
"""

import os
import sys

# Add parent dir so we can import ai_worker modules if needed
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import CORS_ORIGINS, API_HOST, API_PORT
from database import init_pool
from auth import (
    register_user, authenticate_user, create_access_token,
    get_current_user, get_user_profile,
)
from schemas import UserRegister, UserLogin, TokenResponse, MessageResponse

from routes.users import router as users_router
from routes.accounts import router as accounts_router
from routes.transactions import router as transactions_router
from routes.analytics import router as analytics_router


# ── App Instance ───────────────────────────────────────────
app = FastAPI(
    title="FinTech Banking API",
    description="A professional-grade banking REST API with AI fraud detection and predictive analytics.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ───────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static Files (Frontend) ───────────────────────────────
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="frontend")


# ── Startup Event ─────────────────────────────────────────
@app.on_event("startup")
def startup():
    """Initialize the database connection pool on startup."""
    try:
        init_pool()
        print("[API] ✅ Database pool initialized")
    except Exception as e:
        print(f"[API] ⚠️  Database connection failed: {e}")
        print("[API]    The API will start but database operations will fail.")
        print("[API]    Make sure MySQL is running and the schema is loaded.")


# ── Auth Routes (inline for simplicity) ───────────────────

@app.post("/auth/register", response_model=MessageResponse, tags=["Auth"])
def register(data: UserRegister):
    """Register a new user account."""
    user = register_user(
        username=data.username,
        password=data.password,
        email=data.email,
        full_name=data.full_name,
        date_of_birth=str(data.date_of_birth),
        phone_number=data.phone_number,
    )
    return MessageResponse(
        message=f"User '{user['username']}' registered successfully",
        data={"user_id": user["user_id"]},
    )


@app.post("/auth/login", response_model=TokenResponse, tags=["Auth"])
def login(data: UserLogin):
    """Authenticate and receive a JWT access token."""
    user = authenticate_user(data.username, data.password)
    token = create_access_token(user["user_id"], user["username"], user["role"])
    return TokenResponse(
        access_token=token,
        user_id=user["user_id"],
        username=user["username"],
        role=user["role"],
    )


@app.get("/auth/me", tags=["Auth"])
def get_me(current_user: dict = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return get_user_profile(current_user["user_id"])


# ── Register Routers ──────────────────────────────────────
app.include_router(users_router)
app.include_router(accounts_router)
app.include_router(transactions_router)
app.include_router(analytics_router)


# ── Health Check ──────────────────────────────────────────
@app.get("/health", tags=["System"])
def health_check():
    """API health check."""
    return {"status": "healthy", "version": "2.0.0", "service": "FinTech Banking API"}


# ── Serve Frontend ────────────────────────────────────────
@app.get("/", tags=["Frontend"])
def serve_frontend():
    """Serve the main frontend page."""
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "FinTech Banking API is running. Visit /docs for API documentation."}


# ── Run ───────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=True)
