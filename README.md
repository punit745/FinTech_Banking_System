# FinTech Banking System 🏦

![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![MySQL](https://img.shields.io/badge/Database-MySQL_8.0-4479A1?style=flat&logo=mysql&logoColor=white)
![AI](https://img.shields.io/badge/AI-Isolation_Forest-orange?style=flat)
![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat&logo=python&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)
![GPT](https://img.shields.io/badge/NL--to--SQL-LedgerGPT-purple?style=flat)
![Streamlit](https://img.shields.io/badge/Dashboard-Streamlit-FF4B4B?style=flat&logo=streamlit&logoColor=white)

A **production-grade banking application** featuring a 7-page web interface, FastAPI REST API, AI-powered fraud detection, double-entry accounting on MySQL, and Indian Rupee (₹) currency support.

---

## 🚀 Key Features

| Category | Feature |
|----------|---------|
| **Core Banking** | Double-entry ledger, deposits, withdrawals, fund transfers, account statements |
| **Account Management** | Open, freeze/unfreeze, and close accounts with confirmation workflows |
| **Fund Transfers** | Own-account & external transfers, saved beneficiary manager |
| **REST API** | 20+ FastAPI endpoints with JWT authentication and role-based access |
| **7-Page Web App** | Dashboard, Accounts, Fund Transfer, Deposit/Withdraw, History, AI Insights, Profile |
| **AI Fraud Detection** | Isolation Forest model scores transactions for anomaly risk (0.0 – 1.0) |
| **Spending Analytics** | Predictive spending forecasts using linear regression |
| **LedgerGPT** | Natural language to SQL auditor — ask questions in plain English |
| **Live Dashboard** | Streamlit-powered monitoring with Plotly charts |
| **Security** | bcrypt hashing, JWT tokens, password change, RBAC (Admin/Auditor/Customer) |
| **ACID Compliance** | Transaction blocks with `COMMIT`/`ROLLBACK` and row-level locking |
| **Audit Trails** | Immutable JSON logs tracking every change to user and account data |
| **Indian Localization** | ₹ (INR) currency formatting, Indian seed users, `en-IN` number format |

---

## 📂 Project Structure

```
FinTech_Banking_System/
│
├── api/                            # 🔥 FastAPI REST API (Backend)
│   ├── main.py                     # App entry point, CORS, router setup
│   ├── config.py                   # Environment variable configuration
│   ├── database.py                 # MySQL connection pool + FastAPI dependency
│   ├── schemas.py                  # Pydantic request/response models
│   ├── auth.py                     # JWT auth, bcrypt hashing, RBAC
│   ├── .env                        # Environment variables (DB creds, JWT secret)
│   ├── requirements.txt            # Python dependencies
│   └── routes/
│       ├── users.py                # Profile + password change endpoints
│       ├── accounts.py             # Account CRUD, freeze, close endpoints
│       ├── transactions.py         # Deposit / Withdraw / Transfer endpoints
│       └── analytics.py            # AI risk scores & spending analytics
│
├── frontend/                       # 🌐 Web Frontend (7-Page SPA)
│   ├── index.html                  # 7-page application (Dashboard, Accounts, etc.)
│   ├── style.css                   # Premium dark/light glassmorphism design
│   └── app.js                      # Client-side logic, API calls, Chart.js
│
├── schema/                         # 🗄️ Database Schema
│   ├── 01_tables.sql               # Core tables (users, accounts, ledger)
│   └── 02_risk_scores.sql          # AI risk scores table + flagged view
│
├── procedures/                     # ⚙️ Stored Procedures
│   ├── 01_transactions.sql         # sp_perform_transfer, sp_deposit_cash
│   └── 02_accounts.sql             # sp_create_account, sp_get_balance
│
├── triggers/                       # 🔒 Database Triggers
│   ├── 01_audit_logging.sql        # Audit trail for user/account changes
│   └── 02_fraud_checks.sql         # Prevent negative balances, flag high-value txns
│
├── views/                          # 📊 SQL Views
│   └── 01_financial_reports.sql    # Balance sheet, ledger integrity, statements
│
├── ai_worker/                      # 🤖 AI Anomaly Detection Worker
│   ├── ai_engine.py                # Isolation Forest model
│   ├── worker.py                   # Background polling loop
│   └── requirements.txt            # Dependencies
│
├── ledger_gpt/                     # 💬 Natural Language SQL Auditor
│   ├── app.py                      # Interactive CLI
│   ├── query_engine.py             # NL-to-SQL engine (GPT + Templates)
│   ├── schema_context.py           # DB schema context for LLM
│   └── requirements.txt            # Dependencies
│
├── dashboard/                      # 📈 Streamlit Monitoring Dashboard
│   ├── app.py                      # Dashboard application
│   ├── db.py                       # Database query helpers
│   └── requirements.txt            # Dependencies
│
├── data/
│   └── 01_seed_data.sql            # Indian seed data (Arjun, Priya, Rahul)
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

Load seed data (3 Indian users with INR accounts):
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
```envcd
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

| URL | Description |
|-----|-------------|
| http://localhost:8000 | 🌐 Web Application (7-Page Frontend) |
| http://localhost:8000/docs | 📖 Swagger API Documentation |
| http://localhost:8000/redoc | 📘 ReDoc API Documentation |
| http://localhost:8000/health | ❤️ Health Check Endpoint |

---

### Step 4 — AI Worker (Optional)

Scores transactions for fraud risk in the background:

```powershell
cd ai_worker
pip install -r requirements.txt
python worker.py
```

Output:
```
🟢 TXN #1  |  ₹50,000.00 | Score: 0.1200 |     SAFE
🟡 TXN #4  |  ₹4,00,000  | Score: 0.6500 |     SUSPICIOUS
🔴 TXN #5  | ₹15,00,000  | Score: 0.9200 |     CRITICAL
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
ledger> show all transactions for arjun
ledger> find transfers over ₹5000
ledger> show flagged transactions
```

---

### Step 6 — Streamlit Dashboard (Optional)

```powershell
cd dashboard
pip install -r requirements.txt
streamlit run app.py
```

Opens at http://localhost:8501.

---

## 🌐 Frontend — 7 Pages

The web app features a modern **dark/light glassmorphism design** with a responsive sidebar layout:

| Page | Features |
|------|----------|
| **📊 Dashboard** | KPI cards (total balance, accounts, income, expenses), balance bar chart, spending doughnut, recent activity feed |
| **💰 My Accounts** | Account cards with type badges, create new accounts (INR default), account detail panel with mini-statement, freeze/unfreeze, close account |
| **🔄 Fund Transfer** | Own-account transfers, external transfers, saved beneficiary manager (localStorage) |
| **💳 Deposit / Withdraw** | Deposit and withdrawal forms with confirmation modals + receipt generation |
| **📜 History** | Search, type/category filters, date range, paginated table (20/page), CSV export, category tags |
| **🤖 AI Insights** | Spending prediction, monthly trend chart, summary KPIs, risk score table with visual bars |
| **👤 My Profile** | View/edit personal info, change password, KYC status badge, account membership details |

**Additional UI Features:**
- 🌙/☀️ Dark/Light theme toggle
- 🔔 Notification center
- ⏱️ Session timer
- ✅ Confirmation modals for all destructive actions
- 🧾 Transaction receipts
- 📦 Toast notifications

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login and receive JWT token |
| `GET` | `/auth/me` | Get current user from token |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users/profile` | Get user profile |
| `PUT` | `/users/profile` | Update name, email, phone |
| `PUT` | `/users/password` | Change password (old + new) |
| `PUT` | `/users/pin` | Set transaction PIN |

### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/accounts/` | Create new account (savings/checking/wallet) |
| `GET` | `/accounts/` | List all user accounts |
| `GET` | `/accounts/{id}` | Account detail with mini-statement |
| `GET` | `/accounts/{id}/balance` | Get account balance |
| `GET` | `/accounts/{id}/statement` | Get full account statement |
| `PATCH` | `/accounts/{id}/freeze` | Toggle freeze/unfreeze |
| `PATCH` | `/accounts/{id}/close` | Close account (requires ₹0 balance) |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/transactions/deposit` | Deposit funds |
| `POST` | `/transactions/withdraw` | Withdraw funds |
| `POST` | `/transactions/transfer` | Transfer between accounts |
| `GET` | `/transactions/history` | Transaction history (with filters) |

### AI Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/analytics/risk-scores` | AI fraud risk scores |
| `GET` | `/analytics/spending-prediction` | Predicted next month's spending |
| `GET` | `/analytics/spending-summary` | Income, expenses, net flow |

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

## 💡 Core Concepts

### Double-Entry Ledger
Every transaction creates equal debit and credit entries:

```
Transfer ₹5,000: Arjun → Priya
├── Entry 1: Debit  Arjun  (-₹5,000)
└── Entry 2: Credit Priya  (+₹5,000)
    Net System Change: ₹0
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
| **Password Change** | Requires old password verification |
| **Sessions** | JWT tokens with configurable expiration |
| **Authorization** | Role-based access control (customer, admin, auditor) |
| **Transactions** | Confirmation modals + optional PIN verification |
| **Account Safety** | Freeze/unfreeze toggle, close requires ₹0 balance |
| **Database** | Triggers prevent negative balances, audit logs track all changes |
| **API** | CORS whitelist, input validation via Pydantic |

---

## 🧪 Testing

### Seed Data
The seed data creates 3 Indian users:

| Username | Full Name | Accounts | Initial Balance |
|----------|-----------|----------|-----------------|
| `arjun` | Arjun Sharma | Savings + Checking (INR) | ₹50,000 |
| `priya` | Priya Patel | Savings (INR) | ₹25,000 |
| `rahul` | Rahul Verma | Wallet (INR) | ₹0 (receives transfers) |

```sql
SOURCE data/01_seed_data.sql;
```

### Verify via SQL
```sql
SELECT * FROM vw_customer_statement WHERE username = 'arjun';
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
  -Body '{"username":"punit","password":"password123","email":"punit@example.com","full_name":"Punit Kumar","date_of_birth":"2000-01-15","phone_number":"+91 99999 88888"}'

# Login
$response = Invoke-RestMethod -Uri http://localhost:8000/auth/login -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"punit","password":"password123"}'
$token = $response.access_token

# Create account (INR)
Invoke-RestMethod -Uri http://localhost:8000/accounts/ -Method POST `
  -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} `
  -Body '{"account_type":"savings","currency":"INR"}'

# Change password
Invoke-RestMethod -Uri http://localhost:8000/users/password -Method PUT `
  -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} `
  -Body '{"old_password":"password123","new_password":"newpass456"}'
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
| Frontend | Vanilla HTML/CSS/JS (7-page SPA) |
| Charts | Chart.js 4.x |
| NL-to-SQL | OpenAI GPT / Template Engine |
| Monitoring Dashboard | Streamlit + Plotly |
| Currency | Indian Rupee (₹ / INR) |

---

## 📄 License

This project is for educational and demonstration purposes.
