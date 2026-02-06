-- ================================================================
-- FINTECH BANKING PROJECT - TABLE SCHEMA
-- ================================================================
-- Implements Double-Entry Bookkeeping Principles
-- ================================================================

DROP DATABASE IF EXISTS fintech_banking;
CREATE DATABASE fintech_banking;
USE fintech_banking;

-- ================================================================
-- 1. USERS & AUTHENTICATION
-- ================================================================

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, -- Stored as SHA2/BCrypt
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    kyc_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    role ENUM('customer', 'admin', 'auditor') DEFAULT 'customer',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_kyc (kyc_status)
);

-- ================================================================
-- 2. ACCOUNTS (WALLETS)
-- ================================================================

CREATE TABLE accounts (
    account_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    account_number VARCHAR(20) NOT NULL UNIQUE, -- Generated 10-12 digit number
    account_type ENUM('savings', 'checking', 'wallet', 'loan') NOT NULL,
    currency CHAR(3) DEFAULT 'USD', -- ISO 4217 Code
    current_balance DECIMAL(15, 4) DEFAULT 0.0000, -- Denormalized balance (Performance)
    status ENUM('active', 'frozen', 'closed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_account_user (user_id),
    INDEX idx_account_number (account_number)
);

-- ================================================================
-- 3. TRANSACTION DEFINITIONS
-- ================================================================

CREATE TABLE transaction_types (
    type_id INT AUTO_INCREMENT PRIMARY KEY,
    type_code VARCHAR(20) NOT NULL UNIQUE, -- e.g., 'DEPOSIT', 'TRANSFER', 'INTEREST'
    description VARCHAR(100),
    is_system_generated BOOLEAN DEFAULT FALSE
);

-- Seed basic types
INSERT INTO transaction_types (type_code, description, is_system_generated) VALUES 
('DEPOSIT', 'Cash deposit into account', FALSE),
('WITHDRAWAL', 'Cash withdrawal from account', FALSE),
('TRANSFER', 'Internal transfer between accounts', FALSE),
('PAYMENT', 'Payment to external merchant', FALSE),
('INTEREST', 'Monthly interest credit', TRUE),
('FEE', 'Service or overdraft fee', TRUE);

-- ================================================================
-- 4. GENERAL LEDGER (Double-Entry Core)
-- ================================================================

-- The "Header" for a transaction (Grouping the double entries)
CREATE TABLE transactions (
    transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reference_id VARCHAR(50) NOT NULL UNIQUE, -- UUID for idempotency
    type_id INT NOT NULL,
    description VARCHAR(255),
    initiated_by_user_id INT, -- Who clicked the button?
    status ENUM('pending', 'completed', 'failed', 'reversed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (type_id) REFERENCES transaction_types(type_id),
    FOREIGN KEY (initiated_by_user_id) REFERENCES users(user_id),
    INDEX idx_txn_ref (reference_id),
    INDEX idx_txn_date (created_at)
);

-- The "Legs" of the transaction (Debit/Credit entries)
-- Every transaction must have at least 2 entries that sum to 0 (if asset/liability modeled)
-- Or in simple terms: Sender (Negative), Receiver (Positive)
CREATE TABLE transaction_entries (
    entry_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    account_id INT NOT NULL,
    amount DECIMAL(15, 4) NOT NULL, -- Negative for Debit, Positive for Credit
    balance_after DECIMAL(15, 4) NOT NULL, -- Snapshot of balance after this entry
    entry_type ENUM('debit', 'credit') GENERATED ALWAYS AS (IF(amount < 0, 'debit', 'credit')) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id),
    INDEX idx_entry_account (account_id),
    INDEX idx_entry_txn (transaction_id)
);

-- ================================================================
-- 5. AUDIT & LOGGING
-- ================================================================

CREATE TABLE system_audit_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'USER', 'ACCOUNT', 'TRANSACTION'
    entity_id VARCHAR(50) NOT NULL,
    action_type VARCHAR(20) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    old_value JSON,
    new_value JSON,
    performed_by INT, -- User ID or NULL for system
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_entity (entity_type, entity_id)
);

-- ================================================================
-- 6. INDEXES & CONSTRAINTS
-- ================================================================

-- Ensure account numbers are unique and standard length
-- (MySQL 5.7 ignores CHECK constraints, so this is documentation only)
-- ALTER TABLE accounts ADD CONSTRAINT chk_balance_positive CHECK (current_balance >= 0);

SELECT 'Double-Entry Schema Created Successfully' AS status;
