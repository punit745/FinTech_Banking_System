@echo off
REM ================================================================
REM FinTech Banking System - Setup Script
REM ================================================================

setlocal enabledelayedexpansion

set DB_USER=root
set DB_NAME=fintech_banking

echo.
echo ========================================
echo   FinTech Banking System Setup
echo ========================================
echo.

set /p DB_PASS=Enter MySQL password for %DB_USER%: 

echo.
echo 1. Creating Schema (Tables)...
mysql -u %DB_USER% -p%DB_PASS% < ..\schema\01_tables.sql
if %errorlevel% neq 0 (
    echo Error creating schema. Exiting.
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Loading Procedures...
mysql -u %DB_USER% -p%DB_PASS% %DB_NAME% < ..\procedures\01_transactions.sql
mysql -u %DB_USER% -p%DB_PASS% %DB_NAME% < ..\procedures\02_accounts.sql

echo.
echo 3. Loading Triggers...
mysql -u %DB_USER% -p%DB_PASS% %DB_NAME% < ..\triggers\01_audit_logging.sql
mysql -u %DB_USER% -p%DB_PASS% %DB_NAME% < ..\triggers\02_fraud_checks.sql

echo.
echo 4. Creating Views...
mysql -u %DB_USER% -p%DB_PASS% %DB_NAME% < ..\views\01_financial_reports.sql

echo.
echo 5. Seeding Data...
mysql -u %DB_USER% -p%DB_PASS% %DB_NAME% < ..\data\01_seed_data.sql

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
pause
