-- ================================================================
-- FINTECH BANKING PROJECT - SEED DATA
-- ================================================================

-- 1. Create Users
INSERT INTO users (username, password_hash, email, full_name, date_of_birth, phone_number, kyc_status, role) VALUES 
('arjun', 'hashed_pw_1', 'arjun@example.com', 'Arjun Sharma', '1995-03-15', '+91 98765 43210', 'verified', 'customer'),
('priya', 'hashed_pw_2', 'priya@example.com', 'Priya Patel', '1992-08-22', '+91 87654 32109', 'verified', 'customer'),
('rahul', 'hashed_pw_3', 'rahul@example.com', 'Rahul Verma', '1990-11-05', '+91 76543 21098', 'verified', 'customer'),
('admin', 'admin_pw', 'admin@fintech.com', 'System Admin', '1985-01-01', NULL, 'verified', 'admin');

-- 2. Create Accounts (Using the Procedures ensures unique numbers)

-- Arjun Accounts
CALL sp_create_account(1, 'savings', 'INR', @arjun_sav_id, @arjun_sav_num);
CALL sp_create_account(1, 'checking', 'INR', @arjun_chk_id, @arjun_chk_num);

-- Priya Accounts
CALL sp_create_account(2, 'savings', 'INR', @priya_sav_id, @priya_sav_num);

-- Rahul Accounts
CALL sp_create_account(3, 'wallet', 'INR', @rahul_wal_id, @rahul_wal_num);

-- 3. Deposit Initial Funds (Seed Capital)
-- Arjun Deposits ₹50,000
CALL sp_deposit_cash(@arjun_sav_id, 50000.00, 'Salary Deposit', @txn1);

-- Priya Deposits ₹25,000
CALL sp_deposit_cash(@priya_sav_id, 25000.00, 'Freelance Payment', @txn2);

-- 4. Perform Transfers
-- Arjun sends ₹5,000 to Priya
CALL sp_perform_transfer(@arjun_sav_id, @priya_sav_id, 5000.00, 1, 'Rent Split', @txn3, @status3);

-- Priya sends ₹2,000 to Rahul
CALL sp_perform_transfer(@priya_sav_id, @rahul_wal_id, 2000.00, 2, 'Birthday Gift', @txn4, @status4);

-- Arjun moves ₹10,000 from Savings to Checking
CALL sp_perform_transfer(@arjun_sav_id, @arjun_chk_id, 10000.00, 1, 'Self Transfer', @txn5, @status5);

SELECT 'Seed Data Loaded Successfully' AS status;
