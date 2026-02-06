-- ================================================================
-- FINTECH BANKING PROJECT - AUDIT TRIGGERS
-- ================================================================

DELIMITER //

-- ================================================================
-- Users Table Audit
-- ================================================================
DROP TRIGGER IF EXISTS trg_audit_users_insert //
CREATE TRIGGER trg_audit_users_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    INSERT INTO system_audit_logs (entity_type, entity_id, action_type, new_value, created_at)
    VALUES ('USER', NEW.user_id, 'CREATE', JSON_OBJECT('username', NEW.username, 'email', NEW.email, 'role', NEW.role), NOW());
END //

DROP TRIGGER IF EXISTS trg_audit_users_update //
CREATE TRIGGER trg_audit_users_update
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    INSERT INTO system_audit_logs (entity_type, entity_id, action_type, old_value, new_value, created_at)
    VALUES ('USER', NEW.user_id, 'UPDATE', 
        JSON_OBJECT('status', OLD.is_active, 'role', OLD.role, 'kyc', OLD.kyc_status),
        JSON_OBJECT('status', NEW.is_active, 'role', NEW.role, 'kyc', NEW.kyc_status),
        NOW()
    );
END //

-- ================================================================
-- Accounts Table Audit
-- ================================================================
DROP TRIGGER IF EXISTS trg_audit_accounts_insert //
CREATE TRIGGER trg_audit_accounts_insert
AFTER INSERT ON accounts
FOR EACH ROW
BEGIN
    INSERT INTO system_audit_logs (entity_type, entity_id, action_type, new_value, created_at)
    VALUES ('ACCOUNT', NEW.account_id, 'CREATE', JSON_OBJECT('number', NEW.account_number, 'type', NEW.account_type, 'currency', NEW.currency), NOW());
END //

DROP TRIGGER IF EXISTS trg_audit_accounts_update //
CREATE TRIGGER trg_audit_accounts_update
AFTER UPDATE ON accounts
FOR EACH ROW
BEGIN
    -- Only log significantly interesting changes (Status or Balance jumps > 10000)
    IF OLD.status != NEW.status THEN
        INSERT INTO system_audit_logs (entity_type, entity_id, action_type, old_value, new_value, created_at)
        VALUES ('ACCOUNT', NEW.account_id, 'STATUS_CHANGE', 
            JSON_OBJECT('status', OLD.status),
            JSON_OBJECT('status', NEW.status),
            NOW()
        );
    END IF;
    
    -- Log large balance changes separately if needed (though transactions table covers this)
END //

DELIMITER ;
