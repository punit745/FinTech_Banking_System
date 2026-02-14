-- ================================================================
-- FINTECH BANKING PROJECT - AI RISK SCORING TABLE
-- ================================================================
-- Stores AI-generated risk scores for every transaction.
-- The Python AI worker inserts rows after analyzing each transaction.
-- ================================================================

CREATE TABLE IF NOT EXISTS transaction_risk_scores (
    score_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT NOT NULL UNIQUE,
    risk_score DECIMAL(5, 4) NOT NULL,         -- 0.0000 (safe) to 1.0000 (fraud)
    verdict ENUM('SAFE', 'SUSPICIOUS', 'CRITICAL') NOT NULL,
    features_used JSON,                         -- Snapshot of model input features
    model_version VARCHAR(20) DEFAULT 'v1.0',
    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id),
    INDEX idx_risk_verdict (verdict),
    INDEX idx_risk_score (risk_score)
);

-- ================================================================
-- View: High Risk Transactions (for Auditors)
-- ================================================================

CREATE OR REPLACE VIEW vw_flagged_transactions AS
SELECT 
    t.transaction_id,
    t.reference_id,
    t.description,
    t.status AS txn_status,
    t.created_at AS txn_time,
    rs.risk_score,
    rs.verdict,
    rs.features_used,
    u.username AS initiated_by
FROM transactions t
JOIN transaction_risk_scores rs ON t.transaction_id = rs.transaction_id
LEFT JOIN users u ON t.initiated_by_user_id = u.user_id
WHERE rs.verdict IN ('SUSPICIOUS', 'CRITICAL')
ORDER BY rs.risk_score DESC;

SELECT 'Risk Scores Schema Created Successfully' AS status;
