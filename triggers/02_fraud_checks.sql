-- ================================================================
-- FINTECH BANKING PROJECT - FRAUD CHECK TRIGGERS
-- ================================================================

DELIMITER //

-- ================================================================
-- Prevent Negative Balance (Business Rule)
-- ================================================================
-- While the Stored Procedure checks this, a Trigger is a safety net
-- in case someone runs a raw UPDATE query manually.
-- ================================================================

DROP TRIGGER IF EXISTS trg_prevent_negative_balance //
CREATE TRIGGER trg_prevent_negative_balance
BEFORE UPDATE ON accounts
FOR EACH ROW
BEGIN
    -- Allow negative ONLY if account_type is 'loan' (or if we had an overdraft flag)
    IF NEW.current_balance < 0 AND NEW.account_type != 'loan' THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Fraud Check: Account balance cannot be negative';
    END IF;
END //

-- ================================================================
-- High Value Transaction Alert (Simulation)
-- ================================================================
-- In a real system, this would write to a 'flagged_transactions' table
-- ================================================================

DROP TRIGGER IF EXISTS trg_flag_high_value_transaction //
CREATE TRIGGER trg_flag_high_value_transaction
BEFORE INSERT ON transactions
FOR EACH ROW
BEGIN
    -- Simplistic check: If description indicates 'High Value', mark as pending review
    -- Real world: Join with User profile limits
    IF NEW.status = 'completed' AND NEW.description LIKE '%OVERWRITE_LIMIT%' THEN
         SET NEW.status = 'pending'; -- Force manual review
    END IF;
END //

DELIMITER ;
