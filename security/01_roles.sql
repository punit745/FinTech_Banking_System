-- ================================================================
-- FINTECH BANKING PROJECT - SECURITY ROLES (RBAC)
-- ================================================================
-- Defines Database Roles and Permissions for Tellers vs Auditors
-- ================================================================

-- Note: MySQL 5.7 support for ROLES is limited (introduced 5.7.7). 
-- This script uses standard USER creation which works on all versions including 8.0.

-- ================================================================
-- 1. Create Users (representing Roles)
-- ================================================================

-- The "Teller" Bot (Used by the frontend API for regular operations)
CREATE USER IF NOT EXISTS 'teller_bot'@'localhost' IDENTIFIED BY 'teller_password';

-- The "Auditor" Bot (Used by compliance tools)
CREATE USER IF NOT EXISTS 'auditor_bot'@'localhost' IDENTIFIED BY 'audit_password';

-- ================================================================
-- 2. Grant Permissions (Teller)
-- Principle of Least Privilege: Teller can Execute Procs, but NOT direct DELETE
-- ================================================================

-- Allow login
GRANT USAGE ON *.* TO 'teller_bot'@'localhost';

-- Allow Executing Banking Logic
GRANT EXECUTE ON PROCEDURE fintech_banking.sp_perform_transfer TO 'teller_bot'@'localhost';
GRANT EXECUTE ON PROCEDURE fintech_banking.sp_perform_forex_transfer TO 'teller_bot'@'localhost';
GRANT EXECUTE ON PROCEDURE fintech_banking.sp_deposit_cash TO 'teller_bot'@'localhost';
GRANT EXECUTE ON PROCEDURE fintech_banking.sp_create_account TO 'teller_bot'@'localhost';
GRANT EXECUTE ON PROCEDURE fintech_banking.sp_get_account_balance TO 'teller_bot'@'localhost';

-- Allow Reading User/Account data (For UI display)
GRANT SELECT ON fintech_banking.users TO 'teller_bot'@'localhost';
GRANT SELECT ON fintech_banking.accounts TO 'teller_bot'@'localhost';
GRANT SELECT ON fintech_banking.vw_customer_statement TO 'teller_bot'@'localhost';

-- DENY access to sensitive tables (Implicit by not granting)
-- Teller cannot see 'system_audit_logs'

-- ================================================================
-- 3. Grant Permissions (Auditor)
-- Read-Only access to everything, including Logs
-- ================================================================

GRANT SELECT ON fintech_banking.* TO 'auditor_bot'@'localhost';
-- Auditor cannot INSERT/UPDATE/DELETE anything
-- Auditor cannot EXECUTE transfers

-- ================================================================
-- 4. Apply Changes
-- ================================================================
FLUSH PRIVILEGES;

SELECT 'Security Roles and Users Configured Successfully' AS status;
