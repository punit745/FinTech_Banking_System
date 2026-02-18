"""
Transaction Routes
===================
Endpoints for deposits, withdrawals, transfers, and transaction history.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from auth import get_current_user, authenticate_user
from database import get_connection
from schemas import (
    DepositRequest, WithdrawRequest, TransferRequest,
    MessageResponse, TransactionHistoryItem,
)
from typing import List, Optional

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def _verify_account_ownership(cursor, account_id: int, user_id: int) -> dict:
    """Verify that an account belongs to the user. Returns account or raises 403."""
    cursor.execute(
        "SELECT account_id, current_balance, status FROM accounts WHERE account_id = %s AND user_id = %s",
        (account_id, user_id),
    )
    account = cursor.fetchone()
    if not account:
        raise HTTPException(status_code=403, detail="Account not found or access denied")
    if account["status"] != "active":
        raise HTTPException(status_code=400, detail="Account is not active")
    return account


@router.post("/deposit", response_model=MessageResponse)
def deposit(data: DepositRequest, current_user: dict = Depends(get_current_user)):
    """Deposit funds into an account."""
    conn = get_connection()
    try:
        # Verify Password
        authenticate_user(current_user["username"], data.password)

        cursor = conn.cursor(dictionary=True)
        _verify_account_ownership(cursor, data.account_id, current_user["user_id"])

        # Call stored procedure
        proc_cursor = conn.cursor()
        args = (data.account_id, data.amount, data.description or "Cash Deposit", 0)
        result = proc_cursor.callproc("sp_deposit_cash", args)
        conn.commit()

        txn_id = result[3]  # OUT p_transaction_id
        proc_cursor.close()
        cursor.close()

        return MessageResponse(
            message=f"Successfully deposited ${data.amount:,.2f}",
            data={"transaction_id": txn_id},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn.is_connected():
            conn.close()


@router.post("/withdraw", response_model=MessageResponse)
def withdraw(data: WithdrawRequest, current_user: dict = Depends(get_current_user)):
    """Withdraw funds from an account."""
    conn = get_connection()
    try:
        # Verify Password
        authenticate_user(current_user["username"], data.password)

        cursor = conn.cursor(dictionary=True)
        account = _verify_account_ownership(cursor, data.account_id, current_user["user_id"])

        # Check sufficient funds
        current_balance = float(account["current_balance"])
        if current_balance < data.amount:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient funds. Available: ${current_balance:,.2f}",
            )

        # Perform withdrawal: create transaction + debit entry + update balance
        proc_cursor = conn.cursor()

        # Get WITHDRAWAL type_id
        proc_cursor.execute("SELECT type_id FROM transaction_types WHERE type_code = 'WITHDRAWAL' LIMIT 1")
        type_row = proc_cursor.fetchone()
        type_id = type_row[0] if type_row else 2

        # Generate UUID reference
        proc_cursor.execute("SELECT UUID()")
        txn_ref = proc_cursor.fetchone()[0]

        # Insert transaction header
        proc_cursor.execute(
            """INSERT INTO transactions (reference_id, type_id, description, initiated_by_user_id, status)
               VALUES (%s, %s, %s, %s, 'completed')""",
            (txn_ref, type_id, data.description or "Cash Withdrawal", current_user["user_id"]),
        )
        txn_id = proc_cursor.lastrowid

        # Insert debit entry
        new_balance = current_balance - data.amount
        proc_cursor.execute(
            """INSERT INTO transaction_entries (transaction_id, account_id, amount, balance_after)
               VALUES (%s, %s, %s, %s)""",
            (txn_id, data.account_id, -data.amount, new_balance),
        )

        # Update account balance
        proc_cursor.execute(
            "UPDATE accounts SET current_balance = current_balance - %s WHERE account_id = %s",
            (data.amount, data.account_id),
        )

        conn.commit()
        proc_cursor.close()
        cursor.close()

        return MessageResponse(
            message=f"Successfully withdrew ${data.amount:,.2f}",
            data={"transaction_id": txn_id, "new_balance": new_balance},
        )
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn.is_connected():
            conn.close()


@router.post("/transfer", response_model=MessageResponse)
def transfer(data: TransferRequest, current_user: dict = Depends(get_current_user)):
    """Transfer funds between accounts."""
    conn = get_connection()
    try:
        # Verify Password
        authenticate_user(current_user["username"], data.password)

        cursor = conn.cursor(dictionary=True)
        _verify_account_ownership(cursor, data.sender_account_id, current_user["user_id"])

        # Call stored procedure
        proc_cursor = conn.cursor()
        args = (
            data.sender_account_id,
            data.receiver_account_id,
            data.amount,
            current_user["user_id"],
            data.description or "Fund Transfer",
            0,   # OUT p_transaction_id
            "",  # OUT p_status
        )
        result = proc_cursor.callproc("sp_perform_transfer", args)
        conn.commit()

        txn_id = result[5]    # OUT p_transaction_id
        txn_status = result[6]  # OUT p_status
        proc_cursor.close()
        cursor.close()

        return MessageResponse(
            message=f"Successfully transferred ${data.amount:,.2f}",
            data={"transaction_id": txn_id, "status": txn_status},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn.is_connected():
            conn.close()


@router.get("/history", response_model=List[dict])
def get_transaction_history(
    limit: int = Query(50, ge=1, le=200),
    type_filter: Optional[str] = Query(None, alias="type"),
    current_user: dict = Depends(get_current_user),
):
    """Get transaction history for all user accounts."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT t.transaction_id, t.created_at AS transaction_date,
                   tt.type_code AS type, t.description AS narrative,
                   te.amount, te.balance_after, t.status,
                   a.account_number
            FROM transaction_entries te
            JOIN transactions t ON te.transaction_id = t.transaction_id
            JOIN transaction_types tt ON t.type_id = tt.type_id
            JOIN accounts a ON te.account_id = a.account_id
            WHERE a.user_id = %s
        """
        params = [current_user["user_id"]]

        if type_filter:
            query += " AND tt.type_code = %s"
            params.append(type_filter)

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
