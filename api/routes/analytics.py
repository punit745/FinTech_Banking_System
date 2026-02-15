"""
Analytics Routes
=================
Endpoints for AI risk scores, spending predictions, and summaries.
"""

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from database import get_connection
from schemas import RiskScoreResponse, SpendingPrediction, SpendingSummary
from typing import List
import numpy as np

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/risk-scores", response_model=List[dict])
def get_risk_scores(current_user: dict = Depends(get_current_user)):
    """Fetch AI risk scores for the user's transactions."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT rs.transaction_id, rs.risk_score, rs.verdict,
                      rs.features_used, rs.scored_at,
                      ABS(te.amount) AS amount
               FROM transaction_risk_scores rs
               JOIN transactions t ON rs.transaction_id = t.transaction_id
               JOIN transaction_entries te ON t.transaction_id = te.transaction_id
               JOIN accounts a ON te.account_id = a.account_id
               WHERE a.user_id = %s AND te.amount < 0
               ORDER BY rs.scored_at DESC
               LIMIT 50""",
            (current_user["user_id"],),
        )
        scores = cursor.fetchall()
        cursor.close()

        for s in scores:
            s["risk_score"] = float(s["risk_score"])
            s["amount"] = float(s["amount"])
            if s.get("scored_at"):
                s["scored_at"] = str(s["scored_at"])

        return scores
    finally:
        if conn.is_connected():
            conn.close()


@router.get("/spending-prediction")
def get_spending_prediction(current_user: dict = Depends(get_current_user)):
    """
    Predict next month's spending using linear regression on
    historical monthly spending data.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        # Get monthly spending (outgoing transactions) for the user
        cursor.execute(
            """SELECT 
                   DATE_FORMAT(t.created_at, '%%Y-%%m') AS month,
                   SUM(ABS(te.amount)) AS total_spent,
                   COUNT(*) AS txn_count
               FROM transaction_entries te
               JOIN transactions t ON te.transaction_id = t.transaction_id
               JOIN accounts a ON te.account_id = a.account_id
               WHERE a.user_id = %s AND te.amount < 0
               GROUP BY DATE_FORMAT(t.created_at, '%%Y-%%m')
               ORDER BY month ASC""",
            (current_user["user_id"],),
        )
        monthly_data = cursor.fetchall()
        cursor.close()

        if not monthly_data or len(monthly_data) < 1:
            return {
                "predicted_next_month": 0.0,
                "average_monthly": 0.0,
                "trend": "stable",
                "monthly_data": [],
            }

        # Convert to arrays for regression
        amounts = [float(m["total_spent"]) for m in monthly_data]
        avg_monthly = sum(amounts) / len(amounts)

        # Simple linear regression for trend prediction
        if len(amounts) >= 2:
            x = np.arange(len(amounts))
            # Fit a line: y = mx + b
            coeffs = np.polyfit(x, amounts, 1)
            slope = coeffs[0]
            predicted = max(0, coeffs[0] * len(amounts) + coeffs[1])

            if slope > avg_monthly * 0.05:
                trend = "increasing"
            elif slope < -avg_monthly * 0.05:
                trend = "decreasing"
            else:
                trend = "stable"
        else:
            predicted = amounts[-1]
            trend = "stable"

        # Format monthly data for frontend charts
        formatted = []
        for m in monthly_data:
            formatted.append({
                "month": m["month"],
                "total_spent": float(m["total_spent"]),
                "txn_count": m["txn_count"],
            })

        return {
            "predicted_next_month": round(predicted, 2),
            "average_monthly": round(avg_monthly, 2),
            "trend": trend,
            "monthly_data": formatted,
        }
    finally:
        if conn.is_connected():
            conn.close()


@router.get("/spending-summary")
def get_spending_summary(current_user: dict = Depends(get_current_user)):
    """Get overall spending summary: income, expenses, net flow."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT 
                   SUM(CASE WHEN te.amount > 0 THEN te.amount ELSE 0 END) AS total_income,
                   SUM(CASE WHEN te.amount < 0 THEN ABS(te.amount) ELSE 0 END) AS total_expenses,
                   SUM(te.amount) AS net_flow,
                   COUNT(*) AS transaction_count
               FROM transaction_entries te
               JOIN accounts a ON te.account_id = a.account_id
               WHERE a.user_id = %s""",
            (current_user["user_id"],),
        )
        summary = cursor.fetchone()
        cursor.close()

        if not summary or summary["total_income"] is None:
            return {
                "total_income": 0.0,
                "total_expenses": 0.0,
                "net_flow": 0.0,
                "transaction_count": 0,
            }

        return {
            "total_income": float(summary["total_income"]),
            "total_expenses": float(summary["total_expenses"]),
            "net_flow": float(summary["net_flow"]),
            "transaction_count": summary["transaction_count"],
        }
    finally:
        if conn.is_connected():
            conn.close()
