-- ================================================================
-- FINTECH BANKING PROJECT - EMPLOYEES TABLE (Admin/Staff)
-- ================================================================
-- Separate table for bank employees who manage the system.
-- ================================================================

USE fintech_banking;

-- ================================================================
-- EMPLOYEES TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS employees (
    employee_id VARCHAR(20) PRIMARY KEY,          -- e.g. 'EMP001'
    password_hash VARCHAR(255) NOT NULL,           -- BCrypt hashed
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    department ENUM('admin', 'operations', 'support', 'audit') DEFAULT 'operations',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_emp_email (email),
    INDEX idx_emp_dept (department)
);

-- ================================================================
-- SEED DEFAULT ADMIN EMPLOYEE
-- Login: EMP001 / admin123
-- ================================================================

INSERT IGNORE INTO employees (employee_id, password_hash, full_name, email, department)
VALUES (
    'EMP001',
    '$2b$12$27lqXAwa.tmDZQ.nDYudLugVDQX0HMN6mmHKhs6lHNsZdAM0u19L6',
    'System Administrator',
    'admin@fintechbank.com',
    'admin'
);

SELECT 'Employees table created and default admin seeded.' AS status;
