# FinTech Banking System 🏦

![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![MySQL](https://img.shields.io/badge/Database-MySQL_8.0-4479A1?style=flat&logo=mysql&logoColor=white)
![JS](https://img.shields.io/badge/Frontend-Vanilla_JS-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat&logo=python&logoColor=white)
![Security](https://img.shields.io/badge/Security-RBAC_%26_2FA-DC143C?style=flat&logo=security&logoColor=white)

A **production-grade banking application** featuring strict role-based access control, secure transaction flows with password verification, AI-powered fraud detection, and a comprehensive admin dashboard.

---

## Key Features

### Secure Banking (New!)
- **Password-Protected Transactions:** Sensitive actions (Deposit, Withdraw, Transfer) require password re-entry for security.
- **Secure Balance Check:** Account balances are masked by default on the dashboard. Users must authenticate to reveal them.
- **Strict Role Separation:** distinct login flows for **Customers** and **Employees** via a unified dropdown interface.

### 👤 Customer Features
| Category | Feature |
|----------|---------|
| **Profile & Accounts** | View personal details and a consolidated "My Accounts" list with status indicators. |
| **Fund Transfers** | Secure internal transfers and external payments with password validation. |
| **Transaction History** | Searchable history with date range filters, category tagging, and CSV export. |
| **Registration** | Public registration flow for new customers with automated account number generation (upon admin approval). |
| **Smart Insights** | AI-driven spending predictions and risk scoring for every transaction. |

###  Employee (Admin) Features
| Category | Feature |
|----------|---------|
| **Dashboard** | Real-time overview of system assets, active users, and fraud alerts. |
| **User Management** | KYC verification, user activation/deactivation, and profile edits. |
| **Account Control** | **Create Accounts** for users, Freeze suspicious accounts, and Close accounts zero-balance accounts. |
| **Audit Trail** | Immutable logs of all administrative actions for compliance. |

---

## Project Structure

```
FinTech_Banking_System/
│
├── api/                            # 🔥 FastAPI REST API (Backend)
│   ├── main.py                     # App entry point & middleware
│   ├── auth.py                     # JWT auth & RBAC (Customer/Employee)
│   ├── routes/
│   │   ├── users.py                # Profile & Password management
│   │   ├── accounts.py             # Account operations & Masked balances
│   │   ├── admin.py                # 👮 Admin-only endpoints
│   │   └── transactions.py         # Secure transaction logic
│   └── ...
│
├── frontend/                       # 🌐 Modern Web App (Single Page)
│   ├── index.html                  # Unified UI with Role-Based Views
│   ├── style.css                   # Glassmorphism Design System
│   └── app.js                      # Frontend Controller & API Integration
│
├── schema/                         # 🗄️ Database Schema
│   ├── 01_tables.sql               # Core schema (Users, Accounts, Txns)
│   ├── 02_risk_scores.sql          # ML Model tables
│   └── ...                         # Stored procedures & Seed data
│
└── scripts/                        # 🛠️ Utility Scripts
    └── verify_secure_features.py   # E2E Test Suite for Security Features
```

---

## 🛠️ Setup Guide

### Prerequisites
- **Python 3.9+**
- **MySQL 8.0+**

### Step 1 — Database Setup
Run the SQL scripts in the `data/` or `schema/` folder to initialize the database:
```powershell
# Create database and tables
mysql -u root -p < schema/01_tables.sql
# (Optional) Load seed data
mysql -u root -p fintech_banking < data/01_seed_data.sql
```

### Step 2 — Start API
```powershell
cd api
# Create and activate virtual environment
python -m venv api_venv
.\api_venv\Scripts\activate
# Install dependencies
pip install -r requirements.txt
# Run the server
python -m uvicorn main:app --reload
```

### Step 3 — Launch Frontend
Simply open `frontend/index.html` in your browser (Live Server recommended) or visit `http://localhost:8000` if serving static files via FastAPI.

---

## 🔑 Default Credentials

### 🏢 Employee (Admin)
- **Role:** Employee
- **ID:** `EMP001`
- **Password:** `admin123`
- **Access:** Admin Dashboard, KYC, Account Management

### 👤 Customer (Demo)
- **Role:** Customer
- **Username:** `arjun`
- **Password:** `password123`
- **Access:** Banking Dashboard, Transfers, History

> **Note:** You can also register a new customer via the "New User Registration" option in the login dropdown.

---

## 🛡️ Security Architecture

| Layer | Implementation |
|-------|----------------|
| **Transport** | CORS configured for secure frontend communication |
| **Auth** | JWT (JSON Web Tokens) with expiration |
| **Data Protection** | Passwords hashed with `bcrypt` (12 rounds) |
| **Authorization** | Endpoint-level `Depends(get_current_user)` checks |
| **Transaction Security** | **Double-Check Mechanism**: Password re-entry required for all fund movements |
