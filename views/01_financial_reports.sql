-- ================================================================
-- FINTECH BANKING PROJECT - FINANCIAL REPORTS
-- ================================================================

-- ================================================================
-- View: Balance Sheet (The "Proof" of the Application)
-- Checks if Assets = Liabilities + Equity
-- In our simple wallet model:
-- Assets = Cash in Vault (Not modeled here explicitly, but implied)
-- Liabilities = User Deposits (What the "Bank" owes users)
-- ================================================================

CREATE OR REPLACE VIEW vw_balance_sheet AS
SELECT 
    'User Liabilities' AS category,
    SUM(current_balance) AS total_amount,
    currency
FROM accounts
GROUP BY currency;

-- ================================================================
-- View: General Ledger Summary
-- Verifies that Debits = Credits for every completed transaction
-- ================================================================
CREATE OR REPLACE VIEW vw_ledger_integrity_check AS
SELECT 
    t.transaction_id,
    t.reference_id,
    SUM(te.amount) AS net_sum, -- Should ALWAYS be 0.0000
    COUNT(te.entry_id) AS entries_count
FROM transactions t
JOIN transaction_entries te ON t.transaction_id = te.transaction_id
WHERE t.status = 'completed'
GROUP BY t.transaction_id, t.reference_id
HAVING ABS(net_sum) > 0.0001; -- Floating point tolerance

-- ================================================================
-- View: Customer Statement
-- Readable history of user activity
-- ================================================================
CREATE OR REPLACE VIEW vw_customer_statement AS
SELECT 
    u.user_id,
    u.username,
    a.account_number,
    t.created_at AS transaction_date,
    tt.description AS type,
    t.description AS narrative,
    te.amount,
    te.balance_after,
    t.status
FROM users u
JOIN accounts a ON u.user_id = a.user_id
JOIN transaction_entries te ON a.account_id = te.account_id
JOIN transactions t ON te.transaction_id = t.transaction_id
JOIN transaction_types tt ON t.type_id = tt.type_id
ORDER BY t.created_at DESC;
