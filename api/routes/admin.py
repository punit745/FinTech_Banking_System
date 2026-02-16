"""
Admin Management Routes
========================
Employee-only endpoints for managing users, accounts, transactions, and audit logs.
All endpoints require 'employee' role JWT token.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from auth import get_current_user, require_role
from database import get_connection
from schemas import MessageResponse
from typing import List, Optional

router = APIRouter(prefix="/admin", tags=["Admin"])


def _require_employee():
    return require_role("employee")


# ── Dashboard KPIs ────────────────────────────────────────

@router.get("/dashboard", dependencies=[Depends(_require_employee())])
def admin_dashboard():
    """Get system-wide KPIs for admin dashboard."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        # Total users
        cursor.execute("SELECT COUNT(*) AS total_users FROM users")
        total_users = cursor.fetchone()["total_users"]

        # Active users
        cursor.execute("SELECT COUNT(*) AS active_users FROM users WHERE is_active = TRUE")
        active_users = cursor.fetchone()["active_users"]

        # Total accounts
        cursor.execute("SELECT COUNT(*) AS total_accounts FROM accounts")
        total_accounts = cursor.fetchone()["total_accounts"]

        # System-wide balance
        cursor.execute("SELECT COALESCE(SUM(current_balance), 0) AS system_balance FROM accounts WHERE status = 'active'")
        system_balance = float(cursor.fetchone()["system_balance"])

        # Total transactions
        cursor.execute("SELECT COUNT(*) AS total_transactions FROM transactions")
        total_transactions = cursor.fetchone()["total_transactions"]

        # Pending KYC
        cursor.execute("SELECT COUNT(*) AS pending_kyc FROM users WHERE kyc_status = 'pending'")
        pending_kyc = cursor.fetchone()["pending_kyc"]

        # Frozen accounts
        cursor.execute("SELECT COUNT(*) AS frozen_accounts FROM accounts WHERE status = 'frozen'")
        frozen_accounts = cursor.fetchone()["frozen_accounts"]

        # Recent transactions (last 24h)
        cursor.execute("""
            SELECT COUNT(*) AS recent_txns FROM transactions 
            WHERE created_at >= NOW() - INTERVAL 1 DAY
        """)
        recent_txns = cursor.fetchone()["recent_txns"]

        cursor.close()

        return {
            "total_users": total_users,
            "active_users": active_users,
            "total_accounts": total_accounts,
            "system_balance": system_balance,
            "total_transactions": total_transactions,
            "pending_kyc": pending_kyc,
            "frozen_accounts": frozen_accounts,
            "recent_transactions_24h": recent_txns,
        }
    finally:
        if conn.is_connected():
            conn.close()


# ── User Management ──────────────────────────────────────

@router.get("/users", dependencies=[Depends(_require_employee())])
def list_all_users(
    search: Optional[str] = Query(None),
    kyc_filter: Optional[str] = Query(None, alias="kyc"),
    limit: int = Query(100, ge=1, le=500),
):
    """List all users with optional search and filter."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT u.user_id, u.username, u.email, u.full_name, u.phone_number,
                   u.date_of_birth, u.kyc_status, u.role, u.is_active, u.created_at,
                   COUNT(a.account_id) AS account_count,
                   COALESCE(SUM(a.current_balance), 0) AS total_balance
            FROM users u
            LEFT JOIN accounts a ON u.user_id = a.user_id AND a.status != 'closed'
        """
        conditions = []
        params = []

        if search:
            conditions.append("(u.username LIKE %s OR u.full_name LIKE %s OR u.email LIKE %s)")
            s = f"%{search}%"
            params.extend([s, s, s])

        if kyc_filter:
            conditions.append("u.kyc_status = %s")
            params.append(kyc_filter)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " GROUP BY u.user_id ORDER BY u.created_at DESC LIMIT %s"
        params.append(limit)

        cursor.execute(query, tuple(params))
        users = cursor.fetchall()
        cursor.close()

        for u in users:
            u["total_balance"] = float(u["total_balance"])
            if u.get("date_of_birth"):
                u["date_of_birth"] = str(u["date_of_birth"])
            if u.get("created_at"):
                u["created_at"] = str(u["created_at"])

        return users
    finally:
        if conn.is_connected():
            conn.close()


@router.get("/users/{user_id}", dependencies=[Depends(_require_employee())])
def get_user_detail(user_id: int):
    """Get detailed user info including their accounts."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        # User info
        cursor.execute("""
            SELECT user_id, username, email, full_name, phone_number,
                   date_of_birth, kyc_status, role, is_active, created_at
            FROM users WHERE user_id = %s
        """, (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user.get("date_of_birth"):
            user["date_of_birth"] = str(user["date_of_birth"])
        if user.get("created_at"):
            user["created_at"] = str(user["created_at"])

        # User's accounts
        cursor.execute("""
            SELECT account_id, account_number, account_type, currency,
                   current_balance, status, created_at
            FROM accounts WHERE user_id = %s ORDER BY created_at DESC
        """, (user_id,))
        accounts = cursor.fetchall()
        for a in accounts:
            a["current_balance"] = float(a["current_balance"])
            if a.get("created_at"):
                a["created_at"] = str(a["created_at"])

        # Recent transactions
        cursor.execute("""
            SELECT t.transaction_id, t.created_at AS transaction_date,
                   tt.type_code AS type, t.description AS narrative,
                   te.amount, te.balance_after, t.status
            FROM transaction_entries te
            JOIN transactions t ON te.transaction_id = t.transaction_id
            JOIN transaction_types tt ON t.type_id = tt.type_id
            JOIN accounts a ON te.account_id = a.account_id
            WHERE a.user_id = %s
            ORDER BY t.created_at DESC LIMIT 20
        """, (user_id,))
        transactions = cursor.fetchall()
        for txn in transactions:
            txn["amount"] = float(txn["amount"])
            txn["balance_after"] = float(txn["balance_after"])
            if txn.get("transaction_date"):
                txn["transaction_date"] = str(txn["transaction_date"])

        cursor.close()

        user["accounts"] = accounts
        user["recent_transactions"] = transactions
        return user
    finally:
        if conn.is_connected():
            conn.close()


@router.patch("/users/{user_id}/toggle-active", dependencies=[Depends(_require_employee())])
def toggle_user_active(user_id: int):
    """Activate or deactivate a user account."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT user_id, is_active, username FROM users WHERE user_id = %s", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        new_status = not user["is_active"]
        cursor.execute("UPDATE users SET is_active = %s WHERE user_id = %s", (new_status, user_id))
        conn.commit()
        cursor.close()

        action = "activated" if new_status else "deactivated"
        return MessageResponse(
            message=f"User '{user['username']}' has been {action}",
            data={"user_id": user_id, "is_active": new_status},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn.is_connected():
            conn.close()


@router.patch("/users/{user_id}/kyc", dependencies=[Depends(_require_employee())])
def update_kyc_status(user_id: int, status: str = Query(..., pattern="^(pending|verified|rejected)$")):
    """Update a user's KYC verification status."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT user_id, username FROM users WHERE user_id = %s", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        cursor.execute("UPDATE users SET kyc_status = %s WHERE user_id = %s", (status, user_id))
        conn.commit()
        cursor.close()

        return MessageResponse(
            message=f"KYC status for '{user['username']}' updated to '{status}'",
            data={"user_id": user_id, "kyc_status": status},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn.is_connected():
            conn.close()


# ── Account Management ───────────────────────────────────

@router.get("/accounts", dependencies=[Depends(_require_employee())])
def list_all_accounts(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
):
    """List all accounts system-wide."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT a.account_id, a.account_number, a.account_type, a.currency,
                   a.current_balance, a.status, a.created_at,
                   u.user_id, u.username, u.full_name
            FROM accounts a
            JOIN users u ON a.user_id = u.user_id
        """
        conditions = []
        params = []

        if search:
            conditions.append("(a.account_number LIKE %s OR u.username LIKE %s OR u.full_name LIKE %s)")
            s = f"%{search}%"
            params.extend([s, s, s])

        if status_filter:
            conditions.append("a.status = %s")
            params.append(status_filter)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY a.created_at DESC LIMIT %s"
        params.append(limit)

        cursor.execute(query, tuple(params))
        accounts = cursor.fetchall()
        cursor.close()

        for a in accounts:
            a["current_balance"] = float(a["current_balance"])
            if a.get("created_at"):
                a["created_at"] = str(a["created_at"])

        return accounts
    finally:
        if conn.is_connected():
            conn.close()


@router.patch("/accounts/{account_id}/freeze", dependencies=[Depends(_require_employee())])
def admin_freeze_account(account_id: int):
    """Admin freeze/unfreeze any account."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT a.account_id, a.status, a.account_number, u.username
            FROM accounts a JOIN users u ON a.user_id = u.user_id
            WHERE a.account_id = %s
        """, (account_id,))
        account = cursor.fetchone()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        if account["status"] == "closed":
            raise HTTPException(status_code=400, detail="Cannot freeze/unfreeze a closed account")

        new_status = "frozen" if account["status"] == "active" else "active"
        cursor.execute("UPDATE accounts SET status = %s WHERE account_id = %s", (new_status, account_id))
        conn.commit()
        cursor.close()

        action = "frozen" if new_status == "frozen" else "unfrozen"
        return MessageResponse(
            message=f"Account {account['account_number']} ({account['username']}) has been {action}",
            data={"account_id": account_id, "status": new_status},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn.is_connected():
            conn.close()


@router.patch("/accounts/{account_id}/close", dependencies=[Depends(_require_employee())])
def admin_close_account(account_id: int):
    """Admin close any account (must have zero balance)."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT a.account_id, a.current_balance, a.status, a.account_number, u.username
            FROM accounts a JOIN users u ON a.user_id = u.user_id
            WHERE a.account_id = %s
        """, (account_id,))
        account = cursor.fetchone()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        if account["status"] == "closed":
            raise HTTPException(status_code=400, detail="Account is already closed")

        balance = float(account["current_balance"])
        if balance != 0:
            raise HTTPException(
                status_code=400,
                detail=f"Account must have zero balance to close. Current: ₹{balance:,.2f}",
            )

        cursor.execute("UPDATE accounts SET status = 'closed' WHERE account_id = %s", (account_id,))
        conn.commit()
        cursor.close()

        return MessageResponse(
            message=f"Account {account['account_number']} ({account['username']}) has been closed",
            data={"account_id": account_id, "status": "closed"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn.is_connected():
            conn.close()


# ── Transaction Management ───────────────────────────────

@router.get("/transactions", dependencies=[Depends(_require_employee())])
def list_all_transactions(
    search: Optional[str] = Query(None),
    type_filter: Optional[str] = Query(None, alias="type"),
    limit: int = Query(200, ge=1, le=1000),
):
    """List all transactions system-wide."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT t.transaction_id, t.reference_id, t.created_at AS transaction_date,
                   tt.type_code AS type, t.description AS narrative,
                   te.amount, te.balance_after, t.status,
                   a.account_number, u.username, u.full_name
            FROM transaction_entries te
            JOIN transactions t ON te.transaction_id = t.transaction_id
            JOIN transaction_types tt ON t.type_id = tt.type_id
            JOIN accounts a ON te.account_id = a.account_id
            JOIN users u ON a.user_id = u.user_id
        """
        conditions = []
        params = []

        if search:
            conditions.append("(t.reference_id LIKE %s OR u.username LIKE %s OR a.account_number LIKE %s OR t.description LIKE %s)")
            s = f"%{search}%"
            params.extend([s, s, s, s])

        if type_filter:
            conditions.append("tt.type_code = %s")
            params.append(type_filter)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY t.created_at DESC LIMIT %s"
        params.append(limit)

        cursor.execute(query, tuple(params))
        transactions = cursor.fetchall()
        cursor.close()

        for txn in transactions:
            txn["amount"] = float(txn["amount"])
            txn["balance_after"] = float(txn["balance_after"])
            if txn.get("transaction_date"):
                txn["transaction_date"] = str(txn["transaction_date"])

        return transactions
    finally:
        if conn.is_connected():
            conn.close()


# ── Audit Logs ───────────────────────────────────────────

@router.get("/audit-logs", dependencies=[Depends(_require_employee())])
def get_audit_logs(
    entity_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """View system audit logs."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT log_id, entity_type, entity_id, action_type,
                   old_value, new_value, performed_by, ip_address, created_at
            FROM system_audit_logs
        """
        params = []

        if entity_type:
            query += " WHERE entity_type = %s"
            params.append(entity_type)

        query += " ORDER BY created_at DESC LIMIT %s"
        params.append(limit)

        cursor.execute(query, tuple(params))
        logs = cursor.fetchall()
        cursor.close()

        for log in logs:
            if log.get("created_at"):
                log["created_at"] = str(log["created_at"])
            # Convert JSON fields to strings if needed
            if log.get("old_value"):
                log["old_value"] = str(log["old_value"])
            if log.get("new_value"):
                log["new_value"] = str(log["new_value"])

        return logs
    finally:
        if conn.is_connected():
            conn.close()
