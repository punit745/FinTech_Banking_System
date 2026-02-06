-- ================================================================
-- FINTECH BANKING PROJECT - MULTI-CURRENCY SCHEMA
-- ================================================================

-- Table: Currency Exchange Rates
-- Base Currency is always USD (Rate = 1.0)
CREATE TABLE currency_rates (
    rate_id INT AUTO_INCREMENT PRIMARY KEY,
    currency_code CHAR(3) NOT NULL UNIQUE, -- USD, EUR, INR
    exchange_rate DECIMAL(10, 4) NOT NULL, -- Rate relative to USD
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_currency (currency_code)
);

-- Seed Initial Rates
INSERT INTO currency_rates (currency_code, exchange_rate) VALUES
('USD', 1.0000),
('EUR', 0.9200),  -- 1 USD = 0.92 EUR
('INR', 83.5000), -- 1 USD = 83.50 INR
('GBP', 0.7900),  -- 1 USD = 0.79 GBP
('JPY', 150.0000); -- 1 USD = 150 JPY

SELECT 'Currency Schema Created Successfully' AS status;
