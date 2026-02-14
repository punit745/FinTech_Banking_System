# FinTech Core Banking Ledger 🏦

![MySQL](https://img.shields.io/badge/Database-MySQL_8.0-4479A1?style=flat&logo=mysql&logoColor=white)
![AI](https://img.shields.io/badge/AI-Isolation_Forest-orange?style=flat)
![Python](https://img.shields.io/badge/Worker-Python_3.9+-3776AB?style=flat&logo=python&logoColor=white)

A professional-grade Banking Ledger System implemented in **MySQL** with an **AI-Powered Fraud Detection** worker that monitors transactions in real-time using Machine Learning.

## 🚀 Key Features

-   **Double-Entry Ledger**: Every transaction makes equal Debit/Credit entries. Zero-sum integrity is enforced.
-   **ACID Compliance**: Uses `START TRANSACTION`, `COMMIT`, `ROLLBACK` and Row-Level Locking (`FOR UPDATE`).
-   **Audit Trails**: Immutable JSON logs track every change to User/Account data.
-   **Rule-Based Fraud Prevention**: Triggers prevent negative balances and flag high-value transfers.
-   **🤖 AI Anomaly Detection (NEW)**: An Isolation Forest model scores every transaction for fraud risk.
-   **RBAC**: Role-Based Access Control (Admin, Auditor, Customer).

## 🧠 AI Anomaly Detection

The `ai_worker/` is a Python background process that **learns normal banking behavior** and flags anomalies.

**How it works:**
1.  The worker polls the database every 5 seconds for new, unscored transactions.
2.  It extracts 4 features per transaction:
    -   **Amount** — How much money moved.
    -   **Hour of Day** — When did the transaction happen? (3 AM = suspicious)
    -   **Day of Week** — Weekday vs weekend patterns.
    -   **Sender Frequency** — How many transactions did this account make in the last hour? (10 in 1 min = suspicious)
3.  The **Isolation Forest** model scores each transaction from `0.0` (safe) to `1.0` (fraud).
4.  Results are written back to the `transaction_risk_scores` table.

**Verdicts:**
| Score Range | Verdict | Action |
|:------------|:--------|:-------|
| 0.0 – 0.5 | 🟢 SAFE | No action |
| 0.5 – 0.8 | 🟡 SUSPICIOUS | Flag for manual review |
| 0.8 – 1.0 | 🔴 CRITICAL | Block and alert |

## 📂 Project Structure

```
FinTech_Banking_System/
├── schema/
│   ├── 01_tables.sql           # Core Tables (Users, Accounts, Ledger)
│   └── 02_risk_scores.sql      # AI Risk Scores Table + Flagged View
├── procedures/
│   ├── 01_transactions.sql     # Transfer & Deposit Logic
│   └── 02_accounts.sql         # Account Management
├── triggers/
│   ├── 01_audit_logging.sql    # System Audit Logs
│   └── 02_fraud_checks.sql     # Rule-Based Fraud Prevention
├── views/
│   └── 01_financial_reports.sql # Balance Sheet & Statements
├── ai_worker/                   # 🤖 AI Anomaly Detection
│   ├── ai_engine.py            # Isolation Forest Model
│   ├── worker.py               # Polling Loop (Main Entry Point)
│   ├── config.py               # Database & Threshold Config
│   └── requirements.txt        # Python Dependencies
├── data/
│   └── 01_seed_data.sql        # Simulation Data
└── scripts/
    └── setup.bat               # One-click DB installer
```

## 🛠️ Setup Guide

### Step 1: Database Setup
```powershell
cd scripts
setup.bat
```
*Enter your MySQL root password when prompted.*

Then run the risk scores schema:
```sql
SOURCE schema/02_risk_scores.sql;
```

### Step 2: AI Worker Setup
```powershell
cd ai_worker
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Step 3: Configure Database Connection
Edit `ai_worker/config.py` or create a `.env` file:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=fintech_banking
```

### Step 4: Run the AI Worker
```powershell
cd ai_worker
python worker.py
```
You should see output like:
```
🟢 TXN #    1 |    $1,000.00 | Score: 0.1200 |       SAFE
🟢 TXN #    2 |      $200.00 | Score: 0.0800 |       SAFE
� TXN #    5 |   $15,000.00 | Score: 0.9200 |   CRITICAL
```

### Step 5: Query Flagged Transactions
```sql
SELECT * FROM vw_flagged_transactions;
```

## 💡 Core Concepts

### Double-Entry Engine
Unlike simple apps that just update a `balance` column, this system records the **flow of money**.
-   **Transfer $100 from Alice to Bob:**
    -   Entry 1: Debit Alice (-100)
    -   Entry 2: Credit Bob (+100)
    -   *Net System Change: 0*

### Atomic Transfers
`sp_perform_transfer` wraps logic in a transaction block. If *any* step fails, the entire operation rolls back.

### Financial Integrity
`vw_ledger_integrity_check` monitors the system. It should always return **0 rows**.

## 🧪 Testing

```sql
-- Seed data
SOURCE data/01_seed_data.sql;

-- Check statements
SELECT * FROM vw_customer_statement WHERE username = 'alice';
SELECT * FROM vw_balance_sheet;

-- Check AI risk scores
SELECT * FROM transaction_risk_scores;
SELECT * FROM vw_flagged_transactions;
```
