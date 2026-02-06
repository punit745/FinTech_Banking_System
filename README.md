# FinTech Core Banking Ledger 🏦

A professional-grade Banking Ledger System implemented in pure MySQL, demonstrating **Double-Entry Bookkeeping**, **ACID Transactions**, **Forex**, **Automation**, and **Enterprise Security**.

## 🚀 Key Features

*   **Double-Entry Ledger**: Every transaction makes equal Debit/Credit entries. Zero-sum integrity is enforced.
*   **ACID Compliance**: Uses `START TRANSACTION`, `COMMIT`, `ROLLBACK` and Row-Level Locking (`FOR UPDATE`).
*   **Automated Banking**: Daily Interest Scheduler (5% APY) using MySQL Events.
*   **Multi-Currency Engine**: Cross-currency transfers (e.g., USD -> EUR) with real-time exchange rates.
*   **Role-Based Security**: Strict separation of duties between `teller_bot` (Exec) and `auditor_bot` (Read-only).
*   **Fraud Prevention**: Negative balance protection and high-value alerts.

## 📂 Project Structure

```
FinTech_Banking_System/
├── schema/
│   ├── 01_tables.sql           # Core Tables (Users, Accounts, Ledger)
│   └── 02_currencies.sql       # Forex Exchange Rates
├── procedures/
│   ├── 01_transactions.sql     # Transfer & Deposit Logic (ACID)
│   ├── 02_accounts.sql         # Account Management
│   └── 03_forex_transfer.sql   # Cross-Currency Transfer Logic
├── events/
│   └── 01_daily_interest.sql   # Daily 5% APY Automation
├── security/
│   └── 01_roles.sql            # RBAC (Teller/Auditor)
├── triggers/
│   ├── 01_audit_logging.sql    # Immutable Audit Trails
│   └── 02_fraud_checks.sql     # Business Rules
├── views/
│   └── 01_financial_reports.sql # Balance Sheet & Statements
└── scripts/
    └── setup.bat               # One-click installer
```

## 🛠️ Setup Guide

1.  **Prerequisites**: MySQL 5.7 or 8.0+.
2.  **Quick Start**:
    Run the setup script in the `scripts` folder:
    ```powershell
    cd scripts
    setup.bat
    ```
    *Enter your MySQL root password when prompted.*

## 💡 Advanced Concepts Demonstrated

### 1. Multi-Currency Transfers (`procedures/03_forex_transfer.sql`)
Performs real-time conversion during the atomic transaction transaction block.
```sql
-- Logic: Amount_Target = Amount_Source * (Rate_Target / Rate_Source)
-- Entry 1: Debit Sender (USD 100)
-- Entry 2: Credit Receiver (INR 8350)
```

### 2. Event Scheduling (`events/01_daily_interest.sql`)
Simulates "End of Day" batch processing.
-   Iterates through all Savings Accounts using a Cursor.
-   Calculate daily interest: `Balance * (0.05 / 365)`.
-   Credits account & logs to Ledger automatically.

### 3. Enterprise Security (`security/01_roles.sql`)
Instead of using `root`, creates specific service users:
-   **teller_bot**: Can EXECUTE `sp_perform_transfer` but cannot READ `audit_logs`.
-   **auditor_bot**: Can READ everything for compliance but cannot EXECUTE changes.

## 🧪 Testing

run the simulation:
```sql
SOURCE data/01_seed_data.sql;
```

Check the results:
```sql
SELECT * FROM vw_customer_statement WHERE username = 'alice';
SELECT * FROM vw_balance_sheet;
```
