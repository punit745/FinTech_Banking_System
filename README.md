# FinTech Core Banking Ledger 🏦

A professional-grade Banking Ledger System implemented in pure MySQL, demonstrating **Double-Entry Bookkeeping**, **ACID Transactions**, and **Financial Auditing**.

## 🚀 Key Features

-   **Double-Entry Ledger**: Every transaction makes equal Debit/Credit entries. Zero-sum integrity is enforced.
-   **ACID Compliance**: Uses `START TRANSACTION`, `COMMIT`, `ROLLBACK` and Row-Level Locking (`FOR UPDATE`) to handle concurrency and prevent race conditions.
-   **Audit Trails**: Immutable logs track every change to User/Account data.
-   **Fraud Prevention**: Triggers prevent negative balances and flag suspicious high-value transfers.
-   **RBAC**: Role-Based Access Control schema (Admin, Auditor, Customer).

## 📂 Project Structure

```
FinTech_Banking_System/
├── schema/
│   └── 01_tables.sql           # Core Tables (Users, Accounts, Ledger)
├── procedures/
│   ├── 01_transactions.sql     # Transfer & Deposit Logic (The "Brain")
│   └── 02_accounts.sql         # Account Management
├── triggers/
│   ├── 01_audit_logging.sql    # System Audit Logs
│   └── 02_fraud_checks.sql     # Business Rules
├── views/
│   └── 01_financial_reports.sql # Balance Sheet & Statements
├── data/
│   └── 01_seed_data.sql        # Simulation Data
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

## 💡 Core Concepts Demonstrated

### 1. The Double-Entry Engine (`schema/01_tables.sql`)
Unlike simple apps that just update a `balance` column, this system records the **flow of money**.
-   **Transfer $100 from Alice to Bob:**
    -   Entry 1: Debit Alice (-100)
    -   Entry 2: Credit Bob (+100)
    -   *Net System Change: 0*

### 2. Atomic Transfers (`procedures/01_transactions.sql`)
The `sp_perform_transfer` procedure wraps logic in a transaction block. If *any* step fails (e.g., insert fails, insufficient funds), the entire operation rolls back.

```sql
START TRANSACTION;
-- Lock rows
SELECT ... FOR UPDATE;
-- Insert Entries
INSERT INTO transaction_entries...
-- Commit
COMMIT;
```

### 3. Financial Integrity (`views/01_financial_reports.sql`)
The `vw_ledger_integrity_check` view constantly monitors the system. It should always return **0 rows**. If it returns data, the mathematical integrity of the ledger is broken.

## 🧪 Testing

run the seed data script to populate:
```sql
SOURCE data/01_seed_data.sql;
```

Check the results:
```sql
SELECT * FROM vw_customer_statement WHERE username = 'alice';
SELECT * FROM vw_balance_sheet;
```
