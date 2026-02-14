"""
AI Anomaly Detection Worker
============================
A background process that monitors the MySQL database for new transactions,
extracts features, scores them using an Isolation Forest model, and writes
the risk scores back to the `transaction_risk_scores` table.

Usage:
    python worker.py
"""

import time
import json
import mysql.connector
import pandas as pd
from datetime import datetime

from config import DB_CONFIG, POLL_INTERVAL
from ai_engine import AnomalyDetector

BANNER = """
╔══════════════════════════════════════════════════════╗
║   FinTech AI Anomaly Detection Worker                ║
║   Model: Isolation Forest v1.0                       ║
║   Status: ACTIVE                                     ║
╚══════════════════════════════════════════════════════╝
"""


def get_connection():
    """Create a fresh MySQL connection."""
    return mysql.connector.connect(**DB_CONFIG)


def fetch_unscored_transactions(conn) -> pd.DataFrame:
    """
    Find transactions that have NOT yet been scored by the AI.
    Uses a LEFT JOIN to find transactions missing from transaction_risk_scores.
    """
    query = """
        SELECT 
            t.transaction_id,
            ABS(te.amount) AS amount,
            HOUR(t.created_at) AS hour_of_day,
            DAYOFWEEK(t.created_at) - 1 AS day_of_week,
            te.account_id AS sender_account_id, 
            t.created_at
        FROM transactions t
        JOIN transaction_entries te ON t.transaction_id = te.transaction_id
        LEFT JOIN transaction_risk_scores rs ON t.transaction_id = rs.transaction_id
        WHERE rs.score_id IS NULL
          AND te.amount < 0
        ORDER BY t.created_at ASC
    """
    cursor = conn.cursor(dictionary=True)
    cursor.execute(query)
    rows = cursor.fetchall()
    cursor.close()
    return pd.DataFrame(rows)


def get_sender_frequency(conn, account_id: int, txn_time) -> int:
    """
    Count how many transactions the sender made in the 1 hour
    before this transaction. High frequency = suspicious.
    """
    query = """
        SELECT COUNT(*) AS freq
        FROM transaction_entries te
        JOIN transactions t ON te.transaction_id = t.transaction_id
        WHERE te.account_id = %s
          AND te.amount < 0
          AND t.created_at BETWEEN DATE_SUB(%s, INTERVAL 1 HOUR) AND %s
    """
    cursor = conn.cursor(dictionary=True)
    cursor.execute(query, (account_id, txn_time, txn_time))
    result = cursor.fetchone()
    cursor.close()
    return result["freq"] if result else 0


def insert_risk_score(conn, transaction_id: int, result: dict):
    """Insert the AI risk score into the database."""
    query = """
        INSERT INTO transaction_risk_scores 
            (transaction_id, risk_score, verdict, features_used, model_version)
        VALUES (%s, %s, %s, %s, 'v1.0')
    """
    cursor = conn.cursor()
    cursor.execute(query, (
        transaction_id,
        result["risk_score"],
        result["verdict"],
        json.dumps(result["features_used"])
    ))
    conn.commit()
    cursor.close()


def fetch_training_data(conn) -> pd.DataFrame:
    """
    Fetch historical transaction data for training the model.
    Extracts features from all completed debit entries.
    """
    query = """
        SELECT 
            ABS(te.amount) AS amount,
            HOUR(t.created_at) AS hour_of_day,
            DAYOFWEEK(t.created_at) - 1 AS day_of_week,
            te.account_id
        FROM transactions t
        JOIN transaction_entries te ON t.transaction_id = te.transaction_id
        WHERE te.amount < 0
    """
    cursor = conn.cursor(dictionary=True)
    cursor.execute(query)
    rows = cursor.fetchall()
    cursor.close()
    
    df = pd.DataFrame(rows)
    if not df.empty:
        # Add frequency feature (simplified: set to 1 for training data)
        df["sender_tx_freq"] = 1
    return df


def train_model(detector: AnomalyDetector, conn):
    """Train or load the AI model."""
    if detector.load():
        return

    print("[Worker] Training model on historical data...")
    df = fetch_training_data(conn)
    detector.train(df)


def run_scoring_loop():
    """Main loop: poll for new transactions → score → insert."""
    print(BANNER)

    detector = AnomalyDetector()

    # Step 1: Connect and train
    print("[Worker] Connecting to database...")
    conn = get_connection()
    print(f"[Worker] Connected to {DB_CONFIG['database']} @ {DB_CONFIG['host']}")

    train_model(detector, conn)

    # Step 2: Polling loop
    print(f"[Worker] Polling every {POLL_INTERVAL}s for new transactions...\n")
    print("-" * 60)

    while True:
        try:
            # Reconnect if connection dropped
            if not conn.is_connected():
                conn = get_connection()

            unscored = fetch_unscored_transactions(conn)

            if unscored.empty:
                pass  # Nothing to score
            else:
                for _, row in unscored.iterrows():
                    # Get sender frequency
                    freq = get_sender_frequency(
                        conn, 
                        row["sender_account_id"], 
                        row["created_at"]
                    )

                    # Score the transaction
                    result = detector.predict(
                        amount=float(row["amount"]),
                        hour=int(row["hour_of_day"]),
                        day=int(row["day_of_week"]),
                        freq=freq
                    )

                    # Insert into DB
                    insert_risk_score(conn, int(row["transaction_id"]), result)

                    # Console output
                    icon = "🟢" if result["verdict"] == "SAFE" else "🟡" if result["verdict"] == "SUSPICIOUS" else "🔴"
                    print(
                        f"  {icon} TXN #{row['transaction_id']:>5} | "
                        f"${float(row['amount']):>10,.2f} | "
                        f"Score: {result['risk_score']:.4f} | "
                        f"{result['verdict']:>10}"
                    )

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            print("\n[Worker] Shutdown requested. Exiting...")
            break
        except Exception as e:
            print(f"[Worker] Error: {e}")
            time.sleep(POLL_INTERVAL)

    if conn.is_connected():
        conn.close()
    print("[Worker] Connection closed. Goodbye.")


if __name__ == "__main__":
    run_scoring_loop()
