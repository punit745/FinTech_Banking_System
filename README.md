# FinTech Banking System 🏦

![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![MySQL](https://img.shields.io/badge/Database-MySQL_8.0-4479A1?style=flat&logo=mysql&logoColor=white)
![AI](https://img.shields.io/badge/AI-Isolation_Forest-orange?style=flat)
![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat&logo=python&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)
![GPT](https://img.shields.io/badge/NL--to--SQL-LedgerGPT-purple?style=flat)
![Streamlit](https://img.shields.io/badge/Dashboard-Streamlit-FF4B4B?style=flat&logo=streamlit&logoColor=white)

A **full-stack banking application** with a FastAPI REST API, real-time web frontend, AI-powered fraud detection, and a double-entry accounting ledger built on MySQL.

---

## 🚀 Key Features

| Category | Feature |
|----------|---------|
| **Core Banking** | Double-entry ledger, deposits, withdrawals, fund transfers, account statements |
| **REST API** | 15+ FastAPI endpoints with JWT authentication and role-based access control |
| **Web Frontend** | Modern dark-mode SPA with Chart.js dashboards and real-time updates |
| **AI Fraud Detection** | Isolation Forest model scores every transaction for anomaly risk (0.0 – 1.0) |
| **Spending Analytics** | Predictive spending forecasts using linear regression |
| **LedgerGPT** | Natural language to SQL auditor — ask questions in plain English |
| **Live Dashboard** | Streamlit-powered monitoring with Plotly charts |
| **Security** | bcrypt password hashing, JWT tokens, PIN verification, RBAC (Admin/Auditor/Customer) |
| **ACID Compliance** | Transaction blocks with `COMMIT`/`ROLLBACK` and row-level locking |
| **Audit Trails** | Immutable JSON logs tracking every change to user and account data |

---

## 📂 Project Structure

```
FinTech_Banking_System/
│
├── api/                            # 🔥 FastAPI REST API (Backend)
│   ├── main.py                     # App entry point, CORS, auth routes, router setup
│   ├── config.py                   # Environment variable configuration
│   ├── database.py                 # MySQL connection pool + FastAPI dependency
│   ├── schemas.py                  # Pydantic request/response models
│   ├── auth.py                     # JWT auth, bcrypt hashing, RBAC
│   ├── .env                        # Environment variables (DB creds, JWT secret)
│   ├── requirements.txt            # Python dependencies
│   └── routes/
│       ├── users.py                # User profile endpoints
│       ├── accounts.py             # Account management endpoints
│       ├── transactions.py         # Deposit / Withdraw / Transfer endpoints
│       └── analytics.py            # AI risk scores & spending analytics
│
├── frontend/                       # 🌐 Web Frontend (SPA)
│   ├── index.html                  # Single-page application (6 views)
│   ├── style.css                   # Premium dark glassmorphism design system
│   └── app.js                      # Client-side logic, API calls, Chart.js
│
├── schema/                         # 🗄️ Database Schema
│   ├── 01_tables.sql               # Core tables (users, accounts, ledger)
│   └── 02_risk_scores.sql          # AI risk scores table + flagged view
│
├── procedures/                     # ⚙️ Stored Procedures
│   ├── 01_transactions.sql         # sp_perform_transfer, sp_deposit_cash
│   └── 02_accounts.sql             # sp_create_account, sp_get_balance, sp_list_accounts
│
├── triggers/                       # 🔒 Database Triggers
│   ├── 01_audit_logging.sql        # Audit trail for user/account changes
│   └── 02_fraud_checks.sql         # Prevent negative balances, flag high-value txns
│
├── views/                          # 📊 SQL Views
│   └── 01_financial_reports.sql    # Balance sheet, ledger integrity, customer statements
│
├── ai_worker/                      # 🤖 AI Anomaly Detection Worker
│   ├── ai_engine.py                # Isolation Forest model
│   ├── worker.py                   # Background polling loop
│   ├── config.py                   # Worker configuration
│   └── requirements.txt            # Dependencies
│
├── ledger_gpt/                     # 💬 Natural Language SQL Auditor
│   ├── app.py                      # Interactive CLI
│   ├── query_engine.py             # NL-to-SQL engine (GPT + Templates)
│   ├── schema_context.py           # DB schema context for LLM
│   ├── config.py                   # Configuration
│   └── requirements.txt            # Dependencies
│
├── dashboard/                      # 📈 Streamlit Monitoring Dashboard
│   ├── app.py                      # Dashboard application
│   ├── db.py                       # Database query helpers
│   └── requirements.txt            # Dependencies
│
├── data/
│   └── 01_seed_data.sql            # Sample data for testing
│
└── scripts/
    └── setup.bat                   # One-click database installer
```

---

## 🛠️ Setup Guide

### Prerequisites

- **Python 3.9+**
- **MySQL 8.0+** (running locally or remote)
- **Git**

---

### Step 1 — Database Setup

Run the automated setup script or manually load the SQL files:

```powershell
# Option A: Automated (Windows)
cd scripts
setup.bat

# Option B: Manual
mysql -u root -p < schema/01_tables.sql
mysql -u root -p fintech_banking < schema/02_risk_scores.sql
mysql -u root -p fintech_banking < procedures/01_transactions.sql
mysql -u root -p fintech_banking < procedures/02_accounts.sql
mysql -u root -p fintech_banking < triggers/01_audit_logging.sql
mysql -u root -p fintech_banking < triggers/02_fraud_checks.sql
mysql -u root -p fintech_banking < views/01_financial_reports.sql
```

Seed sample data (optional):
```powershell
mysql -u root -p fintech_banking < data/01_seed_data.sql
```

---

### Step 2 — API Setup

```powershell
cd FinTech_Banking_System

# Create virtual environment
python -m venv api_venv

# Activate (Windows)
api_venv\Scripts\activate

# Install dependencies
pip install -r api/requirements.txt
```

Configure the `.env` file at `api/.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=fintech_banking
JWT_SECRET=change-this-to-a-strong-random-secret
JWT_EXPIRATION_HOURS=24
API_PORT=8000
```

---

### Step 3 — Start the Server

```powershell
cd api
..\api_venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```

The following are now available:

| URL | Description |
|-----|-------------|
| http://localhost:8000 | 🌐 Web Application (Frontend) |
| http://localhost:8000/docs | 📖 Swagger API Documentation |
| http://localhost:8000/redoc | 📘 ReDoc API Documentation |
| http://localhost:8000/health | ❤️ Health Check Endpoint |

---

### Step 4 — AI Worker (Optional)

Runs in the background and scores transactions for fraud risk:

```powershell
cd ai_worker
pip install -r requirements.txt
python worker.py
```

Output:
```
🟢 TXN #1  |  $1,000.00 | Score: 0.1200 |     SAFE
🟡 TXN #4  |  $8,000.00 | Score: 0.6500 |     SUSPICIOUS
🔴 TXN #5  | $15,000.00 | Score: 0.9200 |     CRITICAL
```

---

### Step 5 — LedgerGPT (Optional)

Natural language querying for auditors:

```powershell
cd ledger_gpt
pip install -r requirements.txt
python app.py
```

```
ledger> show all transactions for alice
ledger> find transfers over $500
ledger> show flagged transactions
```

---

### Step 6 — Streamlit Dashboard (Optional)

Visual monitoring with charts:

```powershell
cd dashboard
pip install -r requirements.txt
streamlit run app.py
```

Opens at http://localhost:8501.

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login and receive JWT token |
| `GET` | `/auth/me` | Get current user profile |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users/profile` | Get user profile |
| `PUT` | `/users/profile` | Update name, email, phone |
| `PUT` | `/users/pin` | Set transaction PIN |

### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/accounts/` | Create new account (savings/checking/wallet) |
| `GET` | `/accounts/` | List all user accounts |
| `GET` | `/accounts/{id}/balance` | Get account balance |
| `GET` | `/accounts/{id}/statement` | Get account statement |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/transactions/deposit` | Deposit funds |
| `POST` | `/transactions/withdraw` | Withdraw funds |
| `POST` | `/transactions/transfer` | Transfer between accounts |
| `GET` | `/transactions/history` | Get transaction history (with filters) |

### AI Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/analytics/risk-scores` | AI fraud risk scores for transactions |
| `GET` | `/analytics/spending-prediction` | Predicted next month's spending |
| `GET` | `/analytics/spending-summary` | Income, expenses, net flow summary |

> All endpoints except `/auth/register`, `/auth/login`, and `/health` require a valid JWT token in the `Authorization: Bearer <token>` header.

---

## 🧠 AI Fraud Detection

The Isolation Forest model analyzes 4 features per transaction:

| Feature | Why It Matters |
|---------|---------------|
| **Amount** | Unusually large amounts are suspicious |
| **Hour of Day** | Transactions at 3 AM are riskier than at noon |
| **Day of Week** | Weekend vs weekday patterns |
| **Sender Frequency** | 10 transactions in 1 minute = suspicious |

**Risk Verdicts:**

| Score | Verdict | Action |
|-------|---------|--------|
| 0.0 – 0.5 | 🟢 SAFE | No action |
| 0.5 – 0.8 | 🟡 SUSPICIOUS | Flag for manual review |
| 0.8 – 1.0 | 🔴 CRITICAL | Block and alert |

---

## 🌐 Frontend Features

The web frontend is a **single-page application** with a premium dark glassmorphism design:

- **Auth Page** — Login/register with animated tab switching
- **Dashboard** — KPI cards (total balance, accounts, income, expenses) + Chart.js balance chart + recent activity feed
- **Accounts** — Visual account cards with type badges (savings/checking/wallet), create new accounts
- **Transactions** — Three-panel layout for deposit, withdraw, and transfer operations
- **History** — Sortable, filterable transaction table with type badges and status indicators
- **AI Insights** — Spending prediction with trend analysis, monthly summary KPIs, risk score table with visual bars
- **Profile** — View/edit profile information, account details, KYC status

---

## 💡 Core Concepts

### Double-Entry Ledger
Every transaction creates equal debit and credit entries. The system's net balance is always zero:

```
Transfer $100: Alice → Bob
├── Entry 1: Debit  Alice  (-$100)
└── Entry 2: Credit Bob    (+$100)
    Net System Change: $0
```

### Atomic Transfers
`sp_perform_transfer` wraps all logic in a transaction block. If any step fails, the entire operation rolls back — no partial transfers.

### Financial Integrity
The `vw_ledger_integrity_check` view monitors the system. It should always return **0 rows**. Any rows indicate a ledger imbalance.

---

## 🔐 Security

| Layer | Mechanism |
|-------|-----------|
| **Passwords** | bcrypt with 12-round salt |
| **Sessions** | JWT tokens with configurable expiration |
| **Authorization** | Role-based access control (customer, admin, auditor) |
| **Transactions** | Optional PIN verification |
| **Database** | Triggers prevent negative balances, audit logs track all changes |
| **API** | CORS whitelist, input validation via Pydantic |

---

## 🧪 Testing

### Seed Data
```sql
SOURCE data/01_seed_data.sql;
```

### Verify via SQL
```sql
SELECT * FROM vw_customer_statement WHERE username = 'alice';
SELECT * FROM vw_balance_sheet;
SELECT * FROM transaction_risk_scores;
SELECT * FROM vw_flagged_transactions;
```

### Verify via API
```powershell
# Health check
Invoke-RestMethod -Uri http://localhost:8000/health

# Register a user
Invoke-RestMethod -Uri http://localhost:8000/auth/register -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"testuser","password":"test123","email":"test@example.com","full_name":"Test User","date_of_birth":"2000-01-01"}'

# Login
$response = Invoke-RestMethod -Uri http://localhost:8000/auth/login -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"testuser","password":"test123"}'
$token = $response.access_token

# Create account
Invoke-RestMethod -Uri http://localhost:8000/accounts/ -Method POST `
  -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} `
  -Body '{"account_type":"savings","currency":"USD"}'
```

---

## 📋 Tech Stack

| Component | Technology |
|-----------|------------|
| Backend API | FastAPI + Uvicorn |
| Database | MySQL 8.0 |
| Authentication | JWT (PyJWT) + bcrypt |
| Data Validation | Pydantic |
| AI/ML | scikit-learn (Isolation Forest), NumPy |
| Predictive Analytics | Linear Regression |
| Frontend | Vanilla HTML/CSS/JS |
| Charts | Chart.js |
| NL-to-SQL | OpenAI GPT / Template Engine |
| Monitoring Dashboard | Streamlit + Plotly |

---

## 📄 License

This project is for educational and demonstration purposes.
