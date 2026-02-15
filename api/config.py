"""
FastAPI Banking Application — Configuration
=============================================
Central configuration loaded from environment variables / .env file.
"""

import os
from dotenv import load_dotenv

# Load .env from the api/ directory (or project root)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# ── Database ──────────────────────────────────────────────
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "fintech_banking"),
}

# ── JWT Authentication ────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "fintech-super-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", 24))

# ── AI Thresholds ─────────────────────────────────────────
THRESHOLD_SUSPICIOUS = float(os.getenv("THRESHOLD_SUSPICIOUS", 0.5))
THRESHOLD_CRITICAL = float(os.getenv("THRESHOLD_CRITICAL", 0.8))

# ── Server ────────────────────────────────────────────────
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 8000))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
