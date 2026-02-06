-- ================================================================
-- FINTECH BANKING PROJECT - ACCOUNT PROCEDURES
-- ================================================================

DELIMITER //

-- ================================================================
-- Procedure: sp_create_account
-- Logic: Creates a new account with a generated unique ID
-- ================================================================
DROP PROCEDURE IF EXISTS sp_create_account //

CREATE PROCEDURE sp_create_account(
    IN p_user_id INT,
    IN p_account_type ENUM('savings', 'checking', 'wallet', 'loan'),
    IN p_currency CHAR(3),
    OUT p_account_id INT,
    OUT p_account_number VARCHAR(20)
)
BEGIN
    DECLARE v_acc_num VARCHAR(20);
    DECLARE v_exists INT DEFAULT 1;
    
    -- Generate unique 10-digit account number (Random for simulation)
    -- In production, this would use a sequence or luhn algorithm
    WHILE v_exists > 0 DO
        SET v_acc_num = CONCAT('AC', FLOOR(RAND() * 90000000 + 10000000));
        SELECT COUNT(*) INTO v_exists FROM accounts WHERE account_number = v_acc_num;
    END WHILE;
    
    INSERT INTO accounts (user_id, account_number, account_type, currency, status)
    VALUES (p_user_id, v_acc_num, p_account_type, IFNULL(p_currency, 'USD'), 'active');
    
    SET p_account_id = LAST_INSERT_ID();
    SET p_account_number = v_acc_num;
    
    -- Log creation in audit (handled by trigger ideally, but explicit here for clarity)
    -- INSERT INTO system_audit_logs...
END //

-- ================================================================
-- Procedure: sp_get_account_balance
-- Logic: Returns current balance and status
-- ================================================================
DROP PROCEDURE IF EXISTS sp_get_account_balance //

CREATE PROCEDURE sp_get_account_balance(
    IN p_account_id INT
)
BEGIN
    SELECT 
        account_number,
        account_type,
        currency,
        current_balance,
        status
    FROM accounts
    WHERE account_id = p_account_id;
END //

-- ================================================================
-- Procedure: sp_list_user_accounts
-- Logic: List all accounts for a user
-- ================================================================
DROP PROCEDURE IF EXISTS sp_list_user_accounts //

CREATE PROCEDURE sp_list_user_accounts(
    IN p_user_id INT
)
BEGIN
    SELECT 
        account_id,
        account_number,
        account_type,
        currency,
        current_balance,
        status,
        created_at
    FROM accounts
    WHERE user_id = p_user_id
    ORDER BY created_at DESC;
END //

DELIMITER ;
