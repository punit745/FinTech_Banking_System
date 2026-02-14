"""
LedgerGPT Configuration
========================
Database connection settings and OpenAI API key for LLM-powered SQL generation.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# --- Database ---
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "password"),
    "database": os.getenv("DB_NAME", "fintech_banking"),
}

# --- OpenAI ---
# Set your API key here or via environment variable
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# --- Safety ---
# Only allow READ queries. Blocks any writes.
BLOCKED_KEYWORDS = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE"]
MAX_ROWS = 50  # Limit output to prevent huge dumps
