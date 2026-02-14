"""
Database configuration for the AI Worker.
Reads from environment variables or uses defaults for local development.
"""

import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "password"),
    "database": os.getenv("DB_NAME", "fintech_banking"),
}

# How often the worker polls for new transactions (seconds)
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", 5))

# Risk thresholds
THRESHOLD_SUSPICIOUS = 0.5
THRESHOLD_CRITICAL = 0.8
