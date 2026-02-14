"""
Database helper functions for the Streamlit Dashboard.
Returns DataFrames ready for visualization.
"""

import os
import mysql.connector
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "password"),
    "database": os.getenv("DB_NAME", "fintech_banking"),
}


def _query(sql: str) -> pd.DataFrame:
    """Execute a query and return a DataFrame."""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        df = pd.read_sql(sql, conn)
        conn.close()
        return df
    except Exception as e:
        return pd.DataFrame({"error": [str(e)]})


# ---- Dashboard Stats ----

def get_total_users() -> int:
    df = _query("SELECT COUNT(*) AS cnt FROM users")
    return int(df["cnt"][0]) if "cnt" in df.columns else 0


def get_total_accounts() -> int:
    df = _query("SELECT COUNT(*) AS cnt FROM accounts WHERE status = 'active'")
    return int(df["cnt"][0]) if "cnt" in df.columns else 0


def get_total_volume() -> float:
    df = _query("SELECT COALESCE(SUM(ABS(amount)), 0) AS vol FROM transaction_entries WHERE amount < 0")
    return float(df["vol"][0]) if "vol" in df.columns else 0.0


def get_total_transactions() -> int:
    df = _query("SELECT COUNT(*) AS cnt FROM transactions")
    return int(df["cnt"][0]) if "cnt" in df.columns else 0


def get_flagged_count() -> int:
    df = _query("SELECT COUNT(*) AS cnt FROM transaction_risk_scores WHERE verdict != 'SAFE'")
    return int(df["cnt"][0]) if "cnt" in df.columns else 0


# ---- Data Tables ----

def get_all_users() -> pd.DataFrame:
    return _query("""
        SELECT user_id, username, full_name, email, kyc_status, role, is_active, created_at
        FROM users ORDER BY user_id
    """)


def get_all_accounts() -> pd.DataFrame:
    return _query("""
        SELECT a.account_id, u.username, a.account_number, a.account_type,
               a.currency, a.current_balance, a.status
        FROM accounts a
        JOIN users u ON a.user_id = u.user_id
        ORDER BY a.current_balance DESC
    """)


def get_recent_transactions(limit=50) -> pd.DataFrame:
    return _query(f"""
        SELECT t.transaction_id, tt.type_code AS type, t.description,
               t.status, t.created_at,
               u.username AS initiated_by
        FROM transactions t
        JOIN transaction_types tt ON t.type_id = tt.type_id
        LEFT JOIN users u ON t.initiated_by_user_id = u.user_id
        ORDER BY t.created_at DESC
        LIMIT {limit}
    """)


def get_customer_statement(username: str) -> pd.DataFrame:
    return _query(f"""
        SELECT transaction_date, type, narrative, amount, balance_after, status
        FROM vw_customer_statement
        WHERE username = '{username}'
        ORDER BY transaction_date DESC
    """)


def get_risk_scores() -> pd.DataFrame:
    return _query("""
        SELECT rs.transaction_id, t.description, rs.risk_score, rs.verdict,
               rs.features_used, rs.scored_at, u.username AS initiated_by
        FROM transaction_risk_scores rs
        JOIN transactions t ON rs.transaction_id = t.transaction_id
        LEFT JOIN users u ON t.initiated_by_user_id = u.user_id
        ORDER BY rs.risk_score DESC
    """)


def get_balance_sheet() -> pd.DataFrame:
    return _query("SELECT category, total_amount, currency FROM vw_balance_sheet")


def get_ledger_integrity() -> pd.DataFrame:
    return _query("SELECT transaction_id, reference_id, net_sum, entries_count FROM vw_ledger_integrity_check")


def get_balance_by_user() -> pd.DataFrame:
    return _query("""
        SELECT u.username, SUM(a.current_balance) AS total_balance
        FROM accounts a
        JOIN users u ON a.user_id = u.user_id
        WHERE a.status = 'active'
        GROUP BY u.username
        ORDER BY total_balance DESC
    """)


def get_transaction_volume_by_type() -> pd.DataFrame:
    return _query("""
        SELECT tt.type_code, COUNT(*) AS count,
               COALESCE(SUM(ABS(te.amount)), 0) AS volume
        FROM transactions t
        JOIN transaction_types tt ON t.type_id = tt.type_id
        JOIN transaction_entries te ON t.transaction_id = te.transaction_id
        WHERE te.amount < 0
        GROUP BY tt.type_code
    """)


def get_usernames() -> list:
    df = _query("SELECT username FROM users ORDER BY username")
    return df["username"].tolist() if "username" in df.columns else []
