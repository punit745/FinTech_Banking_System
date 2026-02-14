"""
AI Anomaly Detection Engine
Uses Isolation Forest to detect unusual transaction patterns.

Features extracted per transaction:
  1. amount         - Transaction amount (absolute value)
  2. hour_of_day    - Hour when the transaction occurred (0-23)
  3. day_of_week    - Day of the week (0=Monday, 6=Sunday)
  4. sender_tx_freq - How many transactions the sender made in the last hour
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib
import os
from config import THRESHOLD_SUSPICIOUS, THRESHOLD_CRITICAL

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model_isolation_forest.pkl")


class AnomalyDetector:
    def __init__(self):
        self.model = None
        self.is_trained = False

    def train(self, df: pd.DataFrame):
        """
        Train the Isolation Forest on historical transaction data.
        
        Args:
            df: DataFrame with columns [amount, hour_of_day, day_of_week, sender_tx_freq]
        """
        if df.empty or len(df) < 10:
            print("[AI Engine] Not enough data to train. Using synthetic bootstrap...")
            df = self._generate_synthetic_data()

        feature_cols = ["amount", "hour_of_day", "day_of_week", "sender_tx_freq"]
        X = df[feature_cols].values

        # contamination=0.05 means we expect ~5% of data to be anomalous
        self.model = IsolationForest(
            n_estimators=200,
            contamination=0.05,
            random_state=42,
            max_samples="auto"
        )
        self.model.fit(X)
        self.is_trained = True

        # Save the trained model
        joblib.dump(self.model, MODEL_PATH)
        print(f"[AI Engine] Model trained on {len(df)} samples and saved.")

    def load(self):
        """Load a previously trained model from disk."""
        if os.path.exists(MODEL_PATH):
            self.model = joblib.load(MODEL_PATH)
            self.is_trained = True
            print("[AI Engine] Loaded existing model.")
            return True
        return False

    def predict(self, amount: float, hour: int, day: int, freq: int) -> dict:
        """
        Score a single transaction.
        
        Returns:
            dict with risk_score (0.0-1.0), verdict, and features_used
        """
        if not self.is_trained:
            return {
                "risk_score": 0.0,
                "verdict": "SAFE",
                "features_used": {},
                "reason": "Model not trained"
            }

        features = np.array([[amount, hour, day, freq]])

        # decision_function: negative = anomaly, positive = normal
        raw_score = self.model.decision_function(features)[0]
        prediction = self.model.predict(features)[0]  # -1 = outlier, 1 = inlier

        # Normalize to 0.0 - 1.0 risk scale
        # Lower raw_score = higher risk
        risk_score = self._normalize_score(raw_score, prediction)

        # Determine verdict
        if risk_score >= THRESHOLD_CRITICAL:
            verdict = "CRITICAL"
        elif risk_score >= THRESHOLD_SUSPICIOUS:
            verdict = "SUSPICIOUS"
        else:
            verdict = "SAFE"

        return {
            "risk_score": round(risk_score, 4),
            "verdict": verdict,
            "features_used": {
                "amount": amount,
                "hour_of_day": hour,
                "day_of_week": day,
                "sender_tx_freq": freq
            }
        }

    def _normalize_score(self, raw_score: float, prediction: int) -> float:
        """Convert Isolation Forest raw score to 0.0-1.0 risk scale."""
        if prediction == -1:
            # Outlier: map to 0.6 - 1.0 range based on severity
            risk = 0.6 + min(0.4, abs(raw_score) * 2)
        else:
            # Inlier: map to 0.0 - 0.4 range
            risk = max(0.0, 0.4 - raw_score * 0.5)
        return max(0.0, min(1.0, risk))

    def _generate_synthetic_data(self) -> pd.DataFrame:
        """
        Generate realistic synthetic banking data for initial training.
        Models 'normal' behavior so anomalies stand out.
        """
        rng = np.random.RandomState(42)
        n_normal = 500

        # Normal transactions: moderate amounts, business hours
        normal = pd.DataFrame({
            "amount": rng.lognormal(mean=4, sigma=1, size=n_normal).clip(10, 5000),
            "hour_of_day": rng.normal(14, 3, size=n_normal).clip(0, 23).astype(int),
            "day_of_week": rng.randint(0, 5, size=n_normal),      # Weekdays
            "sender_tx_freq": rng.poisson(2, size=n_normal),       # ~2 txns/hour avg
        })

        # Anomalous transactions (5%): huge amounts, odd hours, high frequency
        n_anomalies = 25
        anomalies = pd.DataFrame({
            "amount": rng.uniform(8000, 50000, size=n_anomalies),
            "hour_of_day": rng.randint(0, 5, size=n_anomalies),    # 12 AM - 5 AM
            "day_of_week": rng.randint(5, 7, size=n_anomalies),    # Weekends
            "sender_tx_freq": rng.randint(8, 20, size=n_anomalies), # Rapid-fire
        })

        return pd.concat([normal, anomalies], ignore_index=True)
