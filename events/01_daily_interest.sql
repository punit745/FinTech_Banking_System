-- ================================================================
-- FINTECH BANKING PROJECT - AUTOMATED INTEREST
-- ================================================================
-- Implements Daily Interest Accrual using MySQL Event Scheduler
-- ================================================================

DELIMITER //

-- ================================================================
-- 1. Helper Procedure: Process Daily Interest
-- Loop through eligible Savings accounts and credit interest
-- ================================================================
DROP PROCEDURE IF EXISTS sp_process_daily_interest //

CREATE PROCEDURE sp_process_daily_interest()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_account_id INT;
    DECLARE v_balance DECIMAL(15, 4);
    DECLARE v_interest_rate DECIMAL(5, 4) DEFAULT 0.05; -- 5% APY
    DECLARE v_daily_interest DECIMAL(15, 4);
    DECLARE v_txn_ref VARCHAR(50);
    DECLARE v_type_id INT;
    DECLARE v_txn_id BIGINT;
    
    -- Cursor for Savings accounts with positive balance
    DECLARE cur_accounts CURSOR FOR 
        SELECT account_id, current_balance 
        FROM accounts 
        WHERE account_type = 'savings' AND current_balance > 0 AND status = 'active';
        
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- Get Interest Type ID
    SELECT type_id INTO v_type_id FROM transaction_types WHERE type_code = 'INTEREST' LIMIT 1;
    
    OPEN cur_accounts;

    read_loop: LOOP
        FETCH cur_accounts INTO v_account_id, v_balance;
        IF done THEN
            LEAVE read_loop;
        END IF;

        -- Calculate Daily Interest ( Simple interest for daily accrual: Balance * (Rate / 365) )
        -- Rounding to 4 decimal places for precision
        SET v_daily_interest = ROUND(v_balance * (v_interest_rate / 365), 4);
        
        -- Only process if amount > 0.00
        IF v_daily_interest > 0 THEN
            START TRANSACTION;
            
            -- Create Transaction Record (System generated)
            SET v_txn_ref = UUID();
            
            INSERT INTO transactions (reference_id, type_id, description, status)
            VALUES (v_txn_ref, v_type_id, CONCAT('Daily Interest Credit: ', CURDATE()), 'completed');
            
            SET v_txn_id = LAST_INSERT_ID();
            
            -- Credit Entry (Interest Income for User)
            -- We assume the bank pays this from a central "reserve" (not modeled here, so single entry credit)
            INSERT INTO transaction_entries (transaction_id, account_id, amount, balance_after)
            VALUES (v_txn_id, v_account_id, v_daily_interest, v_balance + v_daily_interest);
            
            -- Update Account
            UPDATE accounts 
            SET current_balance = current_balance + v_daily_interest,
                updated_at = NOW()
            WHERE account_id = v_account_id;
            
            COMMIT;
            
            -- Log (Optional)
            -- INSERT INTO system_audit_logs ...
        END IF;
        
    END LOOP;

    CLOSE cur_accounts;
    
    -- Log Batch Execution
    INSERT INTO system_audit_logs (entity_type, entity_id, action_type, new_value)
    VALUES ('SYSTEM', 'BATCH_JOB', 'INTEREST_RUN', JSON_OBJECT('date', CURDATE(), 'status', 'SUCCESS'));

END //

DELIMITER ;

-- ================================================================
-- 2. Event Scheduler: Run Daily at Midnight
-- ================================================================

-- Make sure scheduler is ON
SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS ev_daily_interest_run;

CREATE EVENT ev_daily_interest_run
ON SCHEDULE EVERY 1 DAY
STARTS DATE(NOW() + INTERVAL 1 DAY) -- Starts tomorrow midnight
DO
    CALL sp_process_daily_interest();
