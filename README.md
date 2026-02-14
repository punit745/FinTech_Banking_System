# FinTech Core Banking Ledger 🏦

![MySQL](https://img.shields.io/badge/Database-MySQL_8.0-4479A1?style=flat&logo=mysql&logoColor=white)
![AI](https://img.shields.io/badge/AI-Isolation_Forest-orange?style=flat)
![Python](https://img.shields.io/badge/Worker-Python_3.9+-3776AB?style=flat&logo=python&logoColor=white)
![GPT](https://img.shields.io/badge/NL--to--SQL-LedgerGPT-purple?style=flat)
![Streamlit](https://img.shields.io/badge/Dashboard-Streamlit-FF4B4B?style=flat&logo=streamlit&logoColor=white)

A professional-grade Banking Ledger System in **MySQL** with **AI Fraud Detection** and a **Natural Language SQL Auditor** (LedgerGPT).

## 🚀 Key Features

-   **Double-Entry Ledger**: Every transaction makes equal Debit/Credit entries. Zero-sum integrity is enforced.
-   **ACID Compliance**: Uses `START TRANSACTION`, `COMMIT`, `ROLLBACK` and Row-Level Locking (`FOR UPDATE`).
-   **Audit Trails**: Immutable JSON logs track every change to User/Account data.
-   **Rule-Based Fraud Prevention**: Triggers prevent negative balances and flag high-value transfers.
-   **🤖 AI Anomaly Detection**: An Isolation Forest model scores every transaction for fraud risk.
-   **💬 LedgerGPT**: Ask questions in plain English — it generates and runs SQL for you.
-   **📊 Live Dashboard**: Streamlit-powered visual monitoring with Plotly charts.
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

## 💬 LedgerGPT — Natural Language Auditor

Ask questions in plain English and get SQL results instantly.

| You Type | LedgerGPT Runs |
|:---------|:---------------|
| "Show all transactions for alice" | `SELECT ... FROM vw_customer_statement WHERE username = 'alice'` |
| "Find transfers over $500" | `SELECT ... WHERE ABS(te.amount) > 500` |
| "Show flagged transactions" | `SELECT ... FROM vw_flagged_transactions` |
| "Check ledger integrity" | `SELECT ... FROM vw_ledger_integrity_check` |

**Dual Mode:**
-   🟢 **Template Mode** (default, offline) — 15+ predefined query patterns.
-   🔵 **GPT Mode** (optional) — Set `OPENAI_API_KEY` to ask *any* question.

**Safety:** Only `SELECT` queries are allowed. All writes are blocked.

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
│   ├── worker.py               # Polling Loop
│   ├── config.py               # Config
│   └── requirements.txt        # Dependencies
├── ledger_gpt/                  # 💬 Natural Language Auditor
│   ├── app.py                  # Interactive CLI (Main Entry Point)
│   ├── query_engine.py         # NL-to-SQL Engine (GPT + Templates)
│   ├── schema_context.py       # DB Schema for LLM Prompt
│   ├── config.py               # Config
│   └── requirements.txt        # Dependencies
├── dashboard/                   # 📊 Visual Monitoring Dashboard
│   ├── app.py                  # Streamlit App (Main Entry Point)
│   ├── db.py                   # Database Query Helpers
│   └── requirements.txt        # Dependencies
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

### Step 3: LedgerGPT Setup
```powershell
cd ledger_gpt
pip install -r requirements.txt
```

### Step 4: Configure Database Connection
Edit `ai_worker/config.py` and `ledger_gpt/config.py`, or create a `.env` file in each:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=fintech_banking
```

### Step 5: Run the AI Worker
```powershell
cd ai_worker
python worker.py
```
You should see output like:
```
🟢 TXN #    1 |    $1,000.00 | Score: 0.1200 |       SAFE
🟢 TXN #    2 |      $200.00 | Score: 0.0800 |       SAFE
🔴 TXN #    5 |   $15,000.00 | Score: 0.9200 |   CRITICAL
```

### Step 6: Run LedgerGPT
```powershell
cd ledger_gpt
python app.py
```
Then ask questions like:
```
ledger> show all transactions for alice
ledger> find transfers over $500
ledger> show flagged transactions
```

### Step 7: Run the Dashboard
```powershell
cd dashboard
pip install -r requirements.txt
streamlit run app.py
```
Opens at `http://localhost:8501` with 6 interactive pages.

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
