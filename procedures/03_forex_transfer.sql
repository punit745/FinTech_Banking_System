-- ================================================================
-- FINTECH BANKING PROJECT - FOREX PROCEDURES
-- ================================================================

DELIMITER //

-- ================================================================
-- Procedure: sp_perform_forex_transfer
-- Logic: Cross-currency transfer with Real-time Rate conversion
-- ================================================================
DROP PROCEDURE IF EXISTS sp_perform_forex_transfer //

CREATE PROCEDURE sp_perform_forex_transfer(
    IN p_sender_account_id INT,
    IN p_receiver_account_id INT,
    IN p_amount_source DECIMAL(15, 4), -- Amount in SENDER'S currency
    IN p_user_id INT,
    OUT p_transaction_id BIGINT,
    OUT p_status VARCHAR(20)
)
BEGIN
    DECLARE v_sender_curr CHAR(3);
    DECLARE v_receiver_curr CHAR(3);
    DECLARE v_sender_rate DECIMAL(10, 4);
    DECLARE v_receiver_rate DECIMAL(10, 4);
    DECLARE v_amount_target DECIMAL(15, 4);
    DECLARE v_txn_ref VARCHAR(50);
    DECLARE v_type_id INT;
    DECLARE v_sender_balance DECIMAL(15, 4);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'FAILED';
        RESIGNAL;
    END;

    START TRANSACTION;

    -- 1. Get Currencies & Rates
    SELECT currency, current_balance INTO v_sender_curr, v_sender_balance 
    FROM accounts WHERE account_id = p_sender_account_id FOR UPDATE;
    
    SELECT currency INTO v_receiver_curr 
    FROM accounts WHERE account_id = p_receiver_account_id FOR UPDATE;
    
    SELECT exchange_rate INTO v_sender_rate FROM currency_rates WHERE currency_code = v_sender_curr;
    SELECT exchange_rate INTO v_receiver_rate FROM currency_rates WHERE currency_code = v_receiver_curr;
    
    -- 2. Validate Funds
    IF v_sender_balance < p_amount_source THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient funds for Forex transfer';
    END IF;

    -- 3. Calculate Target Amount
    -- Formula: Amount * (TargetRate / SourceRate)
    -- Example: 100 USD to INR. Rates: USD=1, INR=83.5. Target = 100 * (83.5 / 1) = 8350
    -- Example: 1000 INR to USD. Target = 1000 * (1 / 83.5) = 11.97
    SET v_amount_target = p_amount_source * (v_receiver_rate / v_sender_rate);
    
    -- 4. Create Transaction
    SET v_txn_ref = UUID();
    SELECT type_id INTO v_type_id FROM transaction_types WHERE type_code = 'TRANSFER' LIMIT 1;
    
    INSERT INTO transactions (reference_id, type_id, description, initiated_by_user_id, status)
    VALUES (v_txn_ref, v_type_id, CONCAT('Forex: ', p_amount_source, ' ', v_sender_curr, ' -> ', ROUND(v_amount_target, 2), ' ', v_receiver_curr), p_user_id, 'completed');
    
    SET p_transaction_id = LAST_INSERT_ID();
    
    -- 5. Debit Sender (In Source Balance)
    INSERT INTO transaction_entries (transaction_id, account_id, amount, balance_after)
    VALUES (p_transaction_id, p_sender_account_id, -p_amount_source, v_sender_balance - p_amount_source);
    UPDATE accounts SET current_balance = current_balance - p_amount_source WHERE account_id = p_sender_account_id;
    
    -- 6. Credit Receiver (In Target Balance)
    -- We need receiver's current balance first
    -- Variable reuse: v_sender_balance will now store receiver balance just for the INSERT calculation
    SELECT current_balance INTO v_sender_balance FROM accounts WHERE account_id = p_receiver_account_id;
    
    INSERT INTO transaction_entries (transaction_id, account_id, amount, balance_after)
    VALUES (p_transaction_id, p_receiver_account_id, v_amount_target, v_sender_balance + v_amount_target);
    UPDATE accounts SET current_balance = current_balance + v_amount_target WHERE account_id = p_receiver_account_id;

    COMMIT;
    SET p_status = 'SUCCESS';

END //

DELIMITER ;
