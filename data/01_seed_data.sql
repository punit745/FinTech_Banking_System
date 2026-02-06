-- ================================================================
-- FINTECH BANKING PROJECT - SEED DATA
-- ================================================================

-- 1. Create Users
INSERT INTO users (username, password_hash, email, full_name, date_of_birth, kyc_status, role) VALUES 
('alice', 'hashed_pw_1', 'alice@example.com', 'Alice Wonderland', '1990-01-01', 'verified', 'customer'),
('bob', 'hashed_pw_2', 'bob@builder.com', 'Bob The Builder', '1985-05-20', 'verified', 'customer'),
('charlie', 'hashed_pw_3', 'charlie@chaplin.com', 'Charlie Chaplin', '1992-12-10', 'verified', 'customer'),
('admin', 'admin_pw', 'admin@fintech.com', 'System Admin', '1980-01-01', 'verified', 'admin');

-- 2. Create Accounts (Using the Procedures ensures unique numbers)
-- Note: In a raw script we can't capture OUT params easily in MySQL 5.7 batch, 
-- so we'll just insert directly or use CALLs if we don't need the ID immediately.

-- Alice Accounts
CALL sp_create_account(1, 'savings', 'USD', @alice_sav_id, @alice_sav_num);
CALL sp_create_account(1, 'checking', 'USD', @alice_chk_id, @alice_chk_num);

-- Bob Accounts
CALL sp_create_account(2, 'savings', 'USD', @bob_sav_id, @bob_sav_num);

-- Charlie Accounts
CALL sp_create_account(3, 'wallet', 'USD', @charlie_wal_id, @charlie_wal_num);

-- 3. Deposit Initial Funds (Seed Capital)
-- Alice Deposits $1000
CALL sp_deposit_cash(@alice_sav_id, 1000.00, 'Initial Deposit', @txn1);

-- Bob Deposits $500
CALL sp_deposit_cash(@bob_sav_id, 500.00, 'Salary Deposit', @txn2);

-- 4. Perform Transfers
-- Alice sends $200 to Bob
CALL sp_perform_transfer(@alice_sav_id, @bob_sav_id, 200.00, 1, 'Dinner Split', @txn3, @status3);

-- Bob sends $50 to Charlie
CALL sp_perform_transfer(@bob_sav_id, @charlie_wal_id, 50.00, 2, 'Gift', @txn4, @status4);

-- Alice moves $100 from Savings to Checking
CALL sp_perform_transfer(@alice_sav_id, @alice_chk_id, 100.00, 1, 'Self Transfer', @txn5, @status5);

SELECT 'Seed Data Loaded Successfully' AS status;
