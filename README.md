# FinTech Banking System 🏦

![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![MySQL](https://img.shields.io/badge/Database-MySQL_8.0-4479A1?style=flat&logo=mysql&logoColor=white)
![JS](https://img.shields.io/badge/Frontend-Vanilla_JS-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat&logo=python&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT_RBAC-000000?style=flat&logo=jsonwebtokens&logoColor=white)

A **production-grade banking application** featuring a dual-login system (Customer/Employee), integrated Admin Dashboard, AI-powered fraud detection, and double-entry accounting on MySQL.

---

## 🚀 Key Features

### 👤 Customer Features
| Category | Feature |
|----------|---------|
| **Core Banking** | View accounts, balances, and mini-statements |
| **Fund Transfers** | Own-account transfers & external beneficiary payments |
| **Transaction History** | Searchable history with filters, CSV export, and category tags |
| **AI Insights** | Spending predictions & fraud risk scores for every transaction |
| **Security** | 2FA-like PIN for transfers, password management, session timeouts |

### 🏢 Employee (Admin) Features
| Category | Feature |
|----------|---------|
| **Admin Dashboard** | System-wide KPIs (Active Users, Total Balance, Fraud Alerts) |
| **User Management** | View users, toggle active status, **Verify KYC** |
| **Account Management** | **Create Accounts** (one per user), Freeze/Unfreeze, Close Accounts |
| **Audit Logs** | Immutable trail of all system actions (logins, status changes) |
| **Transaction Monitoring** | View all system transactions and their risk scores |

### 🧠 Intelligent Core
- **Dual Login System:** Distinct flows for Customers (`UserLogin`) and Employees (`EmployeeLogin`).
- **Account Restrictions:** Strict "One Account Per User" policy enforced by DB constraints.
- **Role-Based Access:** API endpoints secured by strict role checks (`customer` vs `employee`).
- **AI Fraud Detection:** Isolation Forest model scores transactions in real-time (0.0 - 1.0).

---

## 📂 Project Structure

```
FinTech_Banking_System/
│
├── api/                            # 🔥 FastAPI REST API (Backend)
│   ├── main.py                     # App entry point, CORS, router setup
│   ├── auth.py                     # JWT auth, RBAC (Customer/Employee)
│   ├── routes/
│   │   ├── users.py                # Customer profile management
│   │   ├── accounts.py             # Account listing & details
│   │   ├── admin.py                # 👮 Admin-only endpoints
│   │   └── transactions.py         # Fund transfer logic
│   └── ...
│
├── frontend/                       # 🌐 Modern Web App (Single Page)
│   ├── index.html                  # 3-Tab Login, Customer & Admin Dashboards
│   ├── style.css                   # Dark/Light Glassmorphism Design
│   └── app.js                      # Logic for API calls & Role-Based UI
│
├── schema/                         # 🗄️ Database Schema
│   ├── 01_tables.sql               # Core tables (users, accounts)
│   ├── 03_employees.sql            # Employee table & seeding
│   └── 04_account_restrictions.sql # Unique account constraints
│
└── ai_worker/                      # 🤖 AI Fraud Detection Worker
```

---

## 🛠️ Setup Guide

### Prerequisites
- **Python 3.9+**
- **MySQL 8.0+**

### Step 1 — Database Setup
Run the SQL scripts in order:
```powershell
mysql -u root -p < schema/01_tables.sql
mysql -u root -p fintech_banking < schema/02_risk_scores.sql
mysql -u root -p fintech_banking < schema/03_employees.sql
mysql -u root -p fintech_banking < schema/04_account_restrictions.sql
# ... load triggers/procedures as needed
```

### Step 2 — Start API
```powershell
cd api
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### Step 3 — Login
Open `http://localhost:8000` in your browser.

#### 🏢 Employee Login (Admin)
- **Tab:** Employee
- **ID:** `EMP001`
- **Password:** `admin123`
- **Capabilities:** Create accounts, verify KYC, freeze accounts.

#### 👤 Customer Login
- **Tab:** Customer
- **Username:** `arjun` / `password123` (from seed data)
- **Capabilities:** View balance, transfer funds.

---

## 🔒 Security & Compliance

| Layer | Mechanism |
|-------|-----------|
| **Authentication** | Dual-flow JWT (Customer/Employee) |
| **Passwords** | bcrypt hashing (12 rounds) |
| **Account Safety** | **Employee-only account creation**, KYC verification required |
| **Audit** | `system_audit_logs` table tracks every admin action |
| **Concurrency** | ACID-compliant transaction blocks with row locking |

---

## 📋 Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | FastAPI, Python 3.10+ |
| **Database** | MySQL 8.0 (Relational) |
| **Frontend** | Vanilla JS (ES6+), CSS3 Variables |
| **Design** | Glassmorphism, Dark Mode Support |
| **AI/ML** | Scikit-Learn (Isolation Forest) |
