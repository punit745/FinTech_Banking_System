-- ================================================================
-- FINTECH BANKING PROJECT - TRANSACTION PROCEDURES
-- ================================================================
-- Implements ACID-compliant Double-Entry Transactions
-- ================================================================

DELIMITER //

-- ================================================================
-- Procedure: sp_perform_transfer
-- Core Logic: Moves money from Account A to Account B atomically
-- ================================================================
DROP PROCEDURE IF EXISTS sp_perform_transfer //

CREATE PROCEDURE sp_perform_transfer(
    IN p_sender_account_id INT,
    IN p_receiver_account_id INT,
    IN p_amount DECIMAL(15, 4),
    IN p_user_id INT, -- Who initiated this?
    IN p_description VARCHAR(255),
    OUT p_transaction_id BIGINT,
    OUT p_status VARCHAR(20)
)
BEGIN
    DECLARE v_sender_balance DECIMAL(15, 4);
    DECLARE v_receiver_balance DECIMAL(15, 4);
    DECLARE v_txn_ref VARCHAR(50);
    DECLARE v_type_id INT;
    
    -- Exit handler for errors (Automatic ROLLBACK)
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'FAILED';
        SET p_transaction_id = NULL;
        RESIGNAL;
    END;

    -- 1. Input Validation
    IF p_amount <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Amount must be positive';
    END IF;

    IF p_sender_account_id = p_receiver_account_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot transfer to same account';
    END IF;

    -- 2. Start Atomic Transaction
    START TRANSACTION;

    -- 3. Lock Sender Account (SELECT FOR UPDATE) to prevent race conditions
    SELECT current_balance INTO v_sender_balance 
    FROM accounts 
    WHERE account_id = p_sender_account_id 
    FOR UPDATE;

    -- Check sufficiency funds
    IF v_sender_balance < p_amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient funds';
    END IF;

    -- 4. Lock Receiver Account
    SELECT current_balance INTO v_receiver_balance 
    FROM accounts 
    WHERE account_id = p_receiver_account_id 
    FOR UPDATE;

    -- 5. Create Transaction Header
    -- Generate UUID reference
    SET v_txn_ref = UUID();
    
    -- Get 'TRANSFER' type id
    SELECT type_id INTO v_type_id FROM transaction_types WHERE type_code = 'TRANSFER' LIMIT 1;

    INSERT INTO transactions (reference_id, type_id, description, initiated_by_user_id, status)
    VALUES (v_txn_ref, v_type_id, p_description, p_user_id, 'pending');
    
    SET p_transaction_id = LAST_INSERT_ID();

    -- 6. Insert DEBIT Entry (Sender) - Negative Amount
    INSERT INTO transaction_entries (transaction_id, account_id, amount, balance_after)
    VALUES (p_transaction_id, p_sender_account_id, -p_amount, (v_sender_balance - p_amount));

    -- 7. Insert CREDIT Entry (Receiver) - Positive Amount
    INSERT INTO transaction_entries (transaction_id, account_id, amount, balance_after)
    VALUES (p_transaction_id, p_receiver_account_id, p_amount, (v_receiver_balance + p_amount));

    -- 8. Update Account Balances (The Denormalized View)
    UPDATE accounts SET current_balance = current_balance - p_amount 
    WHERE account_id = p_sender_account_id;

    UPDATE accounts SET current_balance = current_balance + p_amount 
    WHERE account_id = p_receiver_account_id;

    -- 9. Finalize
    UPDATE transactions SET status = 'completed', completed_at = NOW() 
    WHERE transaction_id = p_transaction_id;

    COMMIT;
    
    SET p_status = 'SUCCESS';

END //

-- ================================================================
-- Procedure: sp_deposit_cash
-- Logic: External Money IN -> Credit Account
-- ================================================================
DROP PROCEDURE IF EXISTS sp_deposit_cash //

CREATE PROCEDURE sp_deposit_cash(
    IN p_account_id INT,
    IN p_amount DECIMAL(15, 4),
    IN p_description VARCHAR(255),
    OUT p_transaction_id BIGINT
)
BEGIN
    DECLARE v_current_balance DECIMAL(15, 4);
    DECLARE v_type_id INT;
    DECLARE v_txn_ref VARCHAR(50);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT current_balance INTO v_current_balance FROM accounts WHERE account_id = p_account_id FOR UPDATE;

    SET v_txn_ref = UUID();
    SELECT type_id INTO v_type_id FROM transaction_types WHERE type_code = 'DEPOSIT' LIMIT 1;

    INSERT INTO transactions (reference_id, type_id, description, status)
    VALUES (v_txn_ref, v_type_id, p_description, 'completed');
    
    SET p_transaction_id = LAST_INSERT_ID();

    -- Single Entry for Deposit (Technically, in real accounting, this debits the 'Bank Cash Vault', 
    -- but here we simulate 'External Source' so we just credit the user)
    INSERT INTO transaction_entries (transaction_id, account_id, amount, balance_after)
    VALUES (p_transaction_id, p_account_id, p_amount, (v_current_balance + p_amount));

    UPDATE accounts SET current_balance = current_balance + p_amount 
    WHERE account_id = p_account_id;

    COMMIT;
END //

DELIMITER ;
