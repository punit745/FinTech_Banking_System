"""
FastAPI Banking Application — Database Connection Pool
=======================================================
Provides a MySQL connection pool and a FastAPI dependency for routes.
"""

import mysql.connector
from mysql.connector import pooling
from config import DB_CONFIG

# ── Connection Pool ────────────────────────────────────────
_pool = None


def init_pool(pool_size: int = 10):
    """Initialize the MySQL connection pool. Called once at app startup."""
    global _pool
    _pool = pooling.MySQLConnectionPool(
        pool_name="fintech_pool",
        pool_size=pool_size,
        pool_reset_session=True,
        **DB_CONFIG,
    )
    print(f"[DB] Connection pool created ({pool_size} connections) → {DB_CONFIG['database']}@{DB_CONFIG['host']}")


def get_connection():
    """Get a connection from the pool."""
    if _pool is None:
        init_pool()
    return _pool.get_connection()


def get_db():
    """
    FastAPI dependency that yields a database connection.
    Automatically returns it to the pool after the request.
    """
    conn = get_connection()
    try:
        yield conn
    finally:
        if conn.is_connected():
            conn.close()  # Returns to pool, does not destroy


def execute_query(query: str, params: tuple = None, fetch_one: bool = False, dictionary: bool = True):
    """
    Utility: Execute a SELECT query and return results.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=dictionary)
        cursor.execute(query, params)
        result = cursor.fetchone() if fetch_one else cursor.fetchall()
        cursor.close()
        return result
    finally:
        if conn.is_connected():
            conn.close()


def execute_procedure(proc_name: str, args: tuple):
    """
    Utility: Call a stored procedure and return the OUT parameters.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        result_args = cursor.callproc(proc_name, args)
        conn.commit()
        cursor.close()
        return result_args
    finally:
        if conn.is_connected():
            conn.close()
