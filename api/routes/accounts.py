"""
Account Management Routes
===========================
Endpoints for creating, managing, closing, and freezing bank accounts.
"""

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from database import get_connection
from schemas import AccountCreate, AccountResponse, BalanceResponse, MessageResponse
from typing import List

router = APIRouter(prefix="/accounts", tags=["Accounts"])


@router.post("/", response_model=MessageResponse)
def create_account(data: AccountCreate, current_user: dict = Depends(get_current_user)):
    """Create a new bank account for the logged-in user."""
    conn = get_connection()
    try:
        cursor = conn.cursor()

        # Call the stored procedure
        args = (current_user["user_id"], data.account_type.value, data.currency, 0, "")
        result = cursor.callproc("sp_create_account", args)
        conn.commit()

        account_id = result[3]   # OUT p_account_id
        account_num = result[4]  # OUT p_account_number
        cursor.close()

        return MessageResponse(
            message=f"Account created successfully",
            data={"account_id": account_id, "account_number": account_num},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn.is_connected():
            conn.close()


@router.get("/", response_model=List[AccountResponse])
def list_accounts(current_user: dict = Depends(get_current_user)):
    """List all accounts belonging to the logged-in user."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT account_id, account_number, account_type, currency,
                      current_balance, status, created_at
               FROM accounts WHERE user_id = %s ORDER BY created_at DESC""",
            (current_user["user_id"],),
        )
        accounts = cursor.fetchall()
        cursor.close()

        # Convert Decimal and datetime to serializable types
        for acct in accounts:
            acct["current_balance"] = float(acct["current_balance"])
            if acct.get("created_at"):
                acct["created_at"] = str(acct["created_at"])

        return accounts
    finally:
        if conn.is_connected():
            conn.close()


@router.get("/{account_id}", response_model=dict)
def get_account_detail(account_id: int, current_user: dict = Depends(get_current_user)):
    """Get detailed information for a single account including recent transactions."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        # Fetch account
        cursor.execute(
            """SELECT account_id, account_number, account_type, currency,
                      current_balance, status, created_at
               FROM accounts WHERE account_id = %s AND user_id = %s""",
            (account_id, current_user["user_id"]),
        )
        account = cursor.fetchone()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found or access denied")

        account["current_balance"] = float(account["current_balance"])
        if account.get("created_at"):
            account["created_at"] = str(account["created_at"])

        # Fetch recent 10 transactions for mini-statement
        cursor.execute(
            """SELECT t.transaction_id, t.created_at AS transaction_date,
                      tt.type_code AS type, t.description AS narrative,
                      te.amount, te.balance_after, t.status
               FROM transaction_entries te
               JOIN transactions t ON te.transaction_id = t.transaction_id
               JOIN transaction_types tt ON t.type_id = tt.type_id
               WHERE te.account_id = %s
               ORDER BY t.created_at DESC LIMIT 10""",
            (account_id,),
        )
        entries = cursor.fetchall()
        cursor.close()

        for entry in entries:
            entry["amount"] = float(entry["amount"])
            entry["balance_after"] = float(entry["balance_after"])
            if entry.get("transaction_date"):
                entry["transaction_date"] = str(entry["transaction_date"])

        account["recent_transactions"] = entries
        return account
    finally:
        if conn.is_connected():
            conn.close()


@router.get("/{account_id}/balance", response_model=BalanceResponse)
def get_balance(account_id: int, current_user: dict = Depends(get_current_user)):
    """Get balance for a specific account (must belong to the user)."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT account_number, account_type, currency, current_balance, status
               FROM accounts WHERE account_id = %s AND user_id = %s""",
            (account_id, current_user["user_id"]),
        )
        account = cursor.fetchone()
        cursor.close()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found or access denied")

        account["current_balance"] = float(account["current_balance"])
        return account
    finally:
        if conn.is_connected():
            conn.close()


@router.get("/{account_id}/statement", response_model=List[dict])
def get_statement(account_id: int, current_user: dict = Depends(get_current_user)):
    """Get full transaction statement for a specific account."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        # Verify ownership
        cursor.execute(
            "SELECT account_id FROM accounts WHERE account_id = %s AND user_id = %s",
            (account_id, current_user["user_id"]),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Account not found or access denied")

        # Fetch statement
        cursor.execute(
            """SELECT t.transaction_id, t.created_at AS transaction_date,
                      tt.description AS type, t.description AS narrative,
                      te.amount, te.balance_after, t.status
               FROM transaction_entries te
               JOIN transactions t ON te.transaction_id = t.transaction_id
               JOIN transaction_types tt ON t.type_id = tt.type_id
               WHERE te.account_id = %s
               ORDER BY t.created_at DESC
               LIMIT 100""",
            (account_id,),
        )
        entries = cursor.fetchall()
        cursor.close()

        for entry in entries:
            entry["amount"] = float(entry["amount"])
            entry["balance_after"] = float(entry["balance_after"])
            if entry.get("transaction_date"):
                entry["transaction_date"] = str(entry["transaction_date"])

        return entries
    finally:
        if conn.is_connected():
            conn.close()


@router.patch("/{account_id}/close", response_model=MessageResponse)
def close_account(account_id: int, current_user: dict = Depends(get_current_user)):
    """Close a bank account. Account must have zero balance."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        # Verify ownership and current status
        cursor.execute(
            """SELECT account_id, current_balance, status, account_number
               FROM accounts WHERE account_id = %s AND user_id = %s""",
            (account_id, current_user["user_id"]),
        )
        account = cursor.fetchone()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found or access denied")

        if account["status"] == "closed":
            raise HTTPException(status_code=400, detail="Account is already closed")

        balance = float(account["current_balance"])
        if balance != 0:
            raise HTTPException(
                status_code=400,
                detail=f"Account must have zero balance to close. Current balance: ₹{balance:,.2f}",
            )

        # Close the account
        cursor.execute(
            "UPDATE accounts SET status = 'closed' WHERE account_id = %s",
            (account_id,),
        )
        conn.commit()
        cursor.close()

        return MessageResponse(
            message=f"Account {account['account_number']} has been closed successfully",
            data={"account_id": account_id, "status": "closed"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn.is_connected():
            conn.close()


@router.patch("/{account_id}/freeze", response_model=MessageResponse)
def toggle_freeze_account(account_id: int, current_user: dict = Depends(get_current_user)):
    """Freeze or unfreeze a bank account. Toggles between 'active' and 'frozen'."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        # Verify ownership
        cursor.execute(
            """SELECT account_id, status, account_number
               FROM accounts WHERE account_id = %s AND user_id = %s""",
            (account_id, current_user["user_id"]),
        )
        account = cursor.fetchone()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found or access denied")

        if account["status"] == "closed":
            raise HTTPException(status_code=400, detail="Cannot freeze/unfreeze a closed account")

        new_status = "frozen" if account["status"] == "active" else "active"
        cursor.execute(
            "UPDATE accounts SET status = %s WHERE account_id = %s",
            (new_status, account_id),
        )
        conn.commit()
        cursor.close()

        action = "frozen" if new_status == "frozen" else "unfrozen"
        return MessageResponse(
            message=f"Account {account['account_number']} has been {action}",
            data={"account_id": account_id, "status": new_status},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn.is_connected():
            conn.close()
