-- ================================================================
-- FINTECH BANKING PROJECT - ACCOUNT RESTRICTIONS
-- ================================================================
-- Enforce: one account per user
-- ================================================================

USE fintech_banking;

-- Add UNIQUE constraint on user_id to enforce one account per user
-- (Ignore if the constraint already exists)
ALTER TABLE accounts ADD CONSTRAINT uq_user_one_account UNIQUE (user_id);

SELECT 'Account restriction (one-per-user) applied.' AS status;
