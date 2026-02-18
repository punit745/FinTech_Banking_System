/**
 * FinTech Banking System — Application Logic
 * =============================================
 * Handles auth, navigation, dashboard, accounts, transfers,
 * transactions, history, analytics, profile, beneficiaries,
 * notifications, session timer, and theme toggle.
 */

// ── Config ─────────────────────────────────────────────
const API = window.location.origin;
let authToken = localStorage.getItem("authToken");
let currentUser = null;
let currentRole = localStorage.getItem("userRole") || null;
let allAccounts = [];
let allHistory = [];
let filteredHistory = [];
let historyPage = 1;
const ITEMS_PER_PAGE = 20;
let pendingAction = null;
let notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
let sessionStart = Date.now();
let sessionTimerInterval = null;
let balanceChart = null;
let doughnutChart = null;
let trendChart = null;
let debounceTimer = null;
let adminSearchTimers = {};

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
    if (authToken) {
        showApp();
    } else {
        showAuth();
    }
});

function showAuth() {
    document.getElementById("authPage").style.display = "flex";
    document.getElementById("appPage").style.display = "none";
}

function showApp() {
    document.getElementById("authPage").style.display = "none";
    document.getElementById("appPage").style.display = "flex";

    // Detect role from JWT
    if (authToken) {
        try {
            const payload = JSON.parse(atob(authToken.split(".")[1]));
            currentRole = payload.role || "customer";
            localStorage.setItem("userRole", currentRole);
        } catch (_) {
            currentRole = "customer";
        }
    }

    // Show/hide nav based on role
    const customerNav = document.querySelector(".customer-nav");
    const adminNav = document.querySelector(".admin-nav");
    if (currentRole === "employee") {
        if (customerNav) customerNav.style.display = "none";
        if (adminNav) adminNav.style.display = "block";
        document.querySelector(".sidebar").classList.add("admin-mode");
        loadAdminDashboard();
        startSessionTimer();
        navigateTo("admin-dashboard");
    } else {
        if (customerNav) customerNav.style.display = "block";
        if (adminNav) adminNav.style.display = "none";
        document.querySelector(".sidebar").classList.remove("admin-mode");
        loadProfile().then(() => {
            loadDashboard();
            startSessionTimer();
            renderNotifications();
        });
    }
}

// ══════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════
function switchAuthType(type) {
    document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
    if (type === "login") {
        document.getElementById("loginForm").classList.add("active");
    } else if (type === "employee") {
        document.getElementById("employeeLoginForm").classList.add("active");
    } else {
        document.getElementById("registerForm").classList.add("active");
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById("loginBtn");
    btn.classList.add("loading");
    try {
        const res = await apiFetch("/auth/login", "POST", {
            username: document.getElementById("loginUsername").value,
            password: document.getElementById("loginPassword").value,
        });
        authToken = res.access_token;
        localStorage.setItem("authToken", authToken);
        showApp();
        toast("Welcome back!", "success");
    } catch (err) {
        toast(err.message, "error");
    } finally {
        btn.classList.remove("loading");
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById("registerBtn");
    btn.classList.add("loading");
    try {
        const res = await apiFetch("/auth/register", "POST", {
            username: document.getElementById("regUsername").value,
            full_name: document.getElementById("regFullName").value,
            email: document.getElementById("regEmail").value,
            phone_number: document.getElementById("regPhone").value || null,
            date_of_birth: document.getElementById("regDOB").value,
            password: document.getElementById("regPassword").value,
        });
        toast("Account created! Please sign in.", "success");
        switchAuthTab("login");
    } catch (err) {
        toast(err.message, "error");
    } finally {
        btn.classList.remove("loading");
    }
}

async function handleEmployeeLogin(e) {
    e.preventDefault();
    const btn = document.getElementById("empLoginBtn");
    btn.classList.add("loading");
    try {
        const res = await apiFetch("/auth/employee/login", "POST", {
            employee_id: document.getElementById("empId").value,
            password: document.getElementById("empPassword").value,
        });
        authToken = res.access_token;
        localStorage.setItem("authToken", authToken);
        currentRole = "employee";
        localStorage.setItem("userRole", "employee");
        showApp();
        toast(`Welcome, ${res.username}!`, "success");
    } catch (err) {
        toast(err.message, "error");
    } finally {
        btn.classList.remove("loading");
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    currentRole = null;
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
    clearInterval(sessionTimerInterval);
    showAuth();
    toast("Signed out successfully", "info");
}

// ══════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════
function navigateTo(page) {
    // Update nav
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.classList.add("active");

    // Update pages
    document.querySelectorAll(".page-section").forEach(p => p.classList.remove("active"));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add("active");

    // Load data for specific pages
    switch (page) {
        case "dashboard": loadDashboard(); break;
        case "accounts": loadAccounts(); break;
        case "transfer": loadTransferSelects(); loadBeneficiaries(); break;
        case "transactions": loadTransactionSelects(); break;
        case "history": loadHistory(); break;
        case "analytics": loadAnalytics(); break;
        case "profile": loadProfile(); break;
        case "admin-dashboard": loadAdminDashboard(); break;
        case "admin-users": loadAdminUsers(); break;
        case "admin-accounts": loadAdminAccounts(); break;
        case "admin-transactions": loadAdminTransactions(); break;
        case "admin-audit": loadAdminAuditLogs(); break;
    }

    // Close sidebar on mobile
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("active");
}

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("sidebarOverlay").classList.toggle("active");
}

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
async function loadDashboard() {
    try {
        const [accounts, summary] = await Promise.all([
            apiFetch("/accounts/"),
            apiFetch("/analytics/spending-summary").catch(() => null),
        ]);
        allAccounts = accounts;
        // Update KPIs
        const totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0);
        animateKPI("kpiTotalBalance", `$${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
        animateKPI("kpiAccountCount", accounts.length.toString());

        if (summary) {
            animateKPI("kpiTotalIncome", `$${summary.total_income.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
            animateKPI("kpiTotalExpenses", `$${summary.total_expenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
        }

        // Greeting
        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
        document.getElementById("dashboardGreeting").textContent = `${greeting}, ${currentUser?.full_name?.split(" ")[0] || "User"} 👋`;

        // Balance chart - Initially hidden or zero
        renderBalanceChart(accounts);
        // Doughnut
        renderSpendingDoughnut(summary);
        // Recent activity
        loadRecentActivity();
    } catch (err) {
        toast("Failed to load dashboard", "error");
    }
}

let secureCallback = null;

function checkBalanceFlow() {
    secureCallback = async (password) => {
        // Fetch balance for all active accounts
        // We need to iterate or fetch a summary. The requirement implies checking "Total Balance".
        // Or we can just calculate it if we update the endpoint to return it.
        // But let's assume we want to update the UI with the real value.
        // Since we have multiple accounts, we should probably fetch them one by one or create a bulk endpoint.
        // For simplicity, let's fetch the first active account's balance to show *something*,
        // or re-fetch the account list but this time via a POST endpoint? 
        // No, the `list_accounts` is GET.
        // Let's iterate and fetch balance for each (naive but works) OR just update the KPI with the result of one.
        
        // Actually, to update "Total Balance", we need balances of all accounts.
        // Calling POST /accounts/balance for each account is feasible if N is small.
        let total = 0;
        for (const acct of allAccounts) {
            if (acct.status === "active") {
                const res = await apiFetch("/accounts/balance", "POST", { account_id: acct.account_id, password });
                total += res.current_balance;
                // Update the local account object
                acct.current_balance = res.current_balance;
            }
        }
        
        animateKPI("kpiTotalBalance", formatCurrency(total));
        renderBalanceChart(allAccounts); // Refresh chart with real data
        toast("Balance revealed", "success");
    };
    
    document.getElementById("securePasswordInput").value = "";
    document.getElementById("secureModal").classList.add("open");
}

async function handleSecureSubmit() {
    const pwd = document.getElementById("securePasswordInput").value;
    if (!pwd) { toast("Password is required", "error"); return; }
    
    const btn = document.getElementById("secureSubmitBtn");
    btn.classList.add("loading");
    try {
        if (secureCallback) await secureCallback(pwd);
        closeModal("secureModal");
    } catch (err) {
        toast(err.message, "error");
    } finally {
        btn.classList.remove("loading");
    }
}

function animateKPI(id, target) {
    const el = document.getElementById(id);
    if (el) { el.textContent = target; el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 600); }
}

function renderBalanceChart(accounts) {
    const ctx = document.getElementById("balanceChart")?.getContext("2d");
    if (!ctx) return;
    if (balanceChart) balanceChart.destroy();
    const activeAccts = accounts.filter(a => a.status !== "closed");
    balanceChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: activeAccts.map(a => `${a.account_type} (…${a.account_number.slice(-4)})`),
            datasets: [{
                label: "Balance",
                data: activeAccts.map(a => a.current_balance),
                backgroundColor: ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e"],
                borderRadius: 8,
                barPercentage: 0.6,
            }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.04)" } }, x: { ticks: { color: "#94a3b8" }, grid: { display: false } } } },
    });
}

function renderSpendingDoughnut(summary) {
    const ctx = document.getElementById("spendingDoughnut")?.getContext("2d");
    if (!ctx) return;
    if (doughnutChart) doughnutChart.destroy();
    const inc = summary?.total_income || 0;
    const exp = summary?.total_expenses || 0;
    doughnutChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Income", "Expenses"],
            datasets: [{ data: [inc, exp], backgroundColor: ["#10b981", "#f43f5e"], borderWidth: 0, cutout: "70%" }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: "#94a3b8", padding: 16 } } } },
    });
}

async function loadRecentActivity() {
    try {
        const history = await apiFetch("/transactions/history?limit=5");
        const el = document.getElementById("recentActivity");
        if (!history.length) { el.innerHTML = '<div class="empty-state"><div class="icon">📭</div><h3>No transactions yet</h3><p>Make your first deposit to get started!</p></div>'; return; }
        el.innerHTML = `<div class="table-container"><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>${history.map(t => `<tr><td>${formatDate(t.transaction_date)}</td><td>${t.type}</td><td>${t.narrative || "—"}</td><td class="${t.amount >= 0 ? "amount-positive" : "amount-negative"}">${formatCurrency(t.amount)}</td><td><span class="badge badge-${t.status === "completed" ? "success" : "warning"}">${t.status}</span></td></tr>`).join("")}</tbody></table></div>`;
    } catch { document.getElementById("recentActivity").innerHTML = '<div class="empty-state"><p>Could not load activity</p></div>'; }
}

// ══════════════════════════════════════════════════════════
// ACCOUNTS
// ══════════════════════════════════════════════════════════
async function loadAccounts() {
    try {
        const accounts = await apiFetch("/accounts/");
        allAccounts = accounts;
        const container = document.getElementById("accountsList");
        if (!accounts.length) { container.innerHTML = '<div class="empty-state"><div class="icon">🏦</div><h3>No accounts yet</h3><p>Click "Open New Account" to get started.</p></div>'; return; }
        container.innerHTML = accounts.map(a => `
            <div class="account-card" onclick="viewAccountDetail(${a.account_id})">
                <span class="account-type-badge ${a.account_type}">${a.account_type}</span>
                <div class="balance">${formatCurrency(a.current_balance)}</div>
                <div class="account-number"><span class="status-dot ${a.status}"></span> ${a.account_number} • <span style="text-transform:capitalize">${a.status}</span></div>
                <div class="account-actions" onclick="event.stopPropagation();">
                    ${a.status === "active" ? `<button class="btn btn-warning btn-sm" onclick="freezeAccount(${a.account_id})">❄️ Freeze</button>` : ""}
                    ${a.status === "frozen" ? `<button class="btn btn-success btn-sm" onclick="freezeAccount(${a.account_id})">🔓 Unfreeze</button>` : ""}
                    ${a.status !== "closed" ? `<button class="btn btn-danger btn-sm" onclick="closeAccountFlow(${a.account_id}, ${a.current_balance})">Close</button>` : `<span class="badge badge-danger">Closed</span>`}
                </div>
            </div>`).join("");
    } catch (err) { toast("Failed to load accounts", "error"); }
}

// Account creation is admin-only — see adminCreateAccount in admin functions below

async function viewAccountDetail(accountId) {
    const panel = document.getElementById("accountDetailPanel");
    panel.style.display = "block";
    document.getElementById("detailInfo").innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
    document.getElementById("detailStatement").innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
    try {
        const detail = await apiFetch(`/accounts/${accountId}`);
        document.getElementById("detailAccountTitle").textContent = `${detail.account_type.toUpperCase()} — ${detail.account_number}`;
        document.getElementById("detailInfo").innerHTML = `
            <div class="detail-item"><div class="label">Balance</div><div class="value">${formatCurrency(detail.current_balance)}</div></div>
            <div class="detail-item"><div class="label">Account Type</div><div class="value" style="text-transform:capitalize">${detail.account_type}</div></div>
            <div class="detail-item"><div class="label">Currency</div><div class="value">${detail.currency}</div></div>
            <div class="detail-item"><div class="label">Status</div><div class="value"><span class="status-dot ${detail.status}"></span> ${detail.status}</div></div>
            <div class="detail-item"><div class="label">Opened</div><div class="value">${formatDate(detail.created_at)}</div></div>`;

        // Actions
        const actionsEl = document.getElementById("detailActions");
        actionsEl.innerHTML = "";
        if (detail.status === "active") actionsEl.innerHTML += `<button class="btn btn-warning btn-sm" onclick="freezeAccount(${detail.account_id})">❄️ Freeze Account</button>`;
        if (detail.status === "frozen") actionsEl.innerHTML += `<button class="btn btn-success btn-sm" onclick="freezeAccount(${detail.account_id})">🔓 Unfreeze Account</button>`;
        if (detail.status !== "closed") actionsEl.innerHTML += `<button class="btn btn-danger btn-sm" onclick="closeAccountFlow(${detail.account_id}, ${detail.current_balance})">Close Account</button>`;

        // Mini-statement
        const txns = detail.recent_transactions || [];
        if (!txns.length) { document.getElementById("detailStatement").innerHTML = '<div class="empty-state"><p>No transactions for this account.</p></div>'; return; }
        document.getElementById("detailStatement").innerHTML = `<table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>Balance</th></tr></thead><tbody>${txns.map(t => `<tr><td>${formatDate(t.transaction_date)}</td><td>${t.type}</td><td>${t.narrative || "—"}</td><td class="${t.amount >= 0 ? "amount-positive" : "amount-negative"}">${formatCurrency(t.amount)}</td><td>${formatCurrency(t.balance_after)}</td></tr>`).join("")}</tbody></table>`;
    } catch (err) { toast(err.message, "error"); }
}

function closeAccountDetail() { document.getElementById("accountDetailPanel").style.display = "none"; }

function freezeAccount(id) {
    showConfirm("Toggle Account Freeze", "Are you sure you want to freeze/unfreeze this account?", [
        { label: "Account ID", value: id },
    ], async () => {
        const res = await apiFetch(`/accounts/${id}/freeze`, "PATCH");
        toast(res.message, "success");
        addNotification(`🔒 ${res.message}`, "info");
        loadAccounts();
        closeAccountDetail();
    });
}

function closeAccountFlow(id, balance) {
    if (balance !== 0) { toast(`Account balance must be ₹0.00 to close. Current: ₹${balance.toFixed(2)}`, "error"); return; }
    showConfirm("Close Account Permanently", "This action is irreversible. The account will be permanently closed.", [
        { label: "Account ID", value: id },
        { label: "Action", value: "Permanent Closure" },
    ], async () => {
        const res = await apiFetch(`/accounts/${id}/close`, "PATCH");
        toast(res.message, "success");
        addNotification(`🗑️ ${res.message}`, "info");
        loadAccounts();
        closeAccountDetail();
    });
}

// ══════════════════════════════════════════════════════════
// FUND TRANSFER
// ══════════════════════════════════════════════════════════
function loadTransferSelects() {
    const activeAccounts = allAccounts.filter(a => a.status === "active");
    const options = activeAccounts.map(a => `<option value="${a.account_id}">${a.account_type} (…${a.account_number.slice(-4)}) — $${a.current_balance.toFixed(2)}</option>`).join("");
    ["ownTransferFrom", "ownTransferTo", "extTransferFrom"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<option value="">Select account...</option>` + options;
    });
}

function handleOwnTransfer(e) {
    e.preventDefault();
    const from = document.getElementById("ownTransferFrom").value;
    const to = document.getElementById("ownTransferTo").value;
    const amount = parseFloat(document.getElementById("ownTransferAmount").value);
    const desc = document.getElementById("ownTransferDesc").value || "Own Account Transfer";
    const pwd = document.getElementById("ownTransferPwd").value;
    if (from === to) { toast("From and To accounts must be different", "error"); return; }
    if (!pwd) { toast("Password is required", "error"); return; }
    
    showConfirm("Confirm Transfer", "Review the transfer details below.", [
        { label: "From Account", value: `ID ${from}` },
        { label: "To Account", value: `ID ${to}` },
        { label: "Amount", value: formatCurrency(amount), total: true },
    ], async () => {
        await apiFetch("/transactions/transfer", "POST", { sender_account_id: parseInt(from), receiver_account_id: parseInt(to), amount, description: desc, password: pwd });
        showReceipt(amount, [{ label: "Type", value: "Own Transfer" }, { label: "From", value: `Account ${from}` }, { label: "To", value: `Account ${to}` }, { label: "Description", value: desc }]);
        addNotification(`🔄 Transferred ${formatCurrency(amount)}`, "success");
        loadTransferSelects();
        document.querySelector('#page-transfer form').reset();
    });
}

function handleExternalTransfer(e) {
    e.preventDefault();
    const from = document.getElementById("extTransferFrom").value;
    const to = parseInt(document.getElementById("extTransferTo").value);
    const amount = parseFloat(document.getElementById("extTransferAmount").value);
    const desc = document.getElementById("extTransferDesc").value || "Fund Transfer";
    const pwd = document.getElementById("extTransferPwd").value;
    if (!pwd) { toast("Password is required", "error"); return; }

    showConfirm("Confirm External Transfer", "You are sending money to another account.", [
        { label: "From Account", value: `ID ${from}` },
        { label: "Receiver Account ID", value: to },
        { label: "Amount", value: formatCurrency(amount), total: true },
    ], async () => {
        await apiFetch("/transactions/transfer", "POST", { sender_account_id: parseInt(from), receiver_account_id: to, amount, description: desc, password: pwd });
        showReceipt(amount, [{ label: "Type", value: "External Transfer" }, { label: "Receiver", value: `Account ${to}` }, { label: "Description", value: desc }]);
        addNotification(`📤 Sent ${formatCurrency(amount)} to Account ${to}`, "success");
        loadTransferSelects();
        document.querySelector('#page-transfer form').reset();
    });
}

// ── Beneficiaries ────────────────────────────────────────
function getBeneficiaries() { return JSON.parse(localStorage.getItem("beneficiaries") || "[]"); }
function saveBeneficiaries(b) { localStorage.setItem("beneficiaries", JSON.stringify(b)); }

function loadBeneficiaries() {
    const list = getBeneficiaries();
    const container = document.getElementById("beneficiaryList");
    if (!list.length) { container.innerHTML = '<div class="empty-state" style="padding:20px;"><p>No saved beneficiaries. Click "＋ Add" to save one.</p></div>'; return; }
    container.innerHTML = list.map((b, i) => `
        <div class="beneficiary-card" onclick="selectBeneficiary(${b.accountId})">
            <div class="beneficiary-avatar">${b.name.charAt(0).toUpperCase()}</div>
            <div class="beneficiary-info"><div class="name">${b.name}</div><div class="acct">Account: ${b.accountId}</div></div>
            <button class="beneficiary-remove" onclick="event.stopPropagation();removeBeneficiary(${i})" title="Remove">✕</button>
        </div>`).join("");
}

function showAddBeneficiaryForm() { document.getElementById("addBeneficiaryForm").style.display = "block"; }
function hideAddBeneficiaryForm() { document.getElementById("addBeneficiaryForm").style.display = "none"; }

function addBeneficiary() {
    const name = document.getElementById("beneName").value.trim();
    const accountId = parseInt(document.getElementById("beneAccountId").value);
    if (!name || !accountId) { toast("Name and Account ID are required", "error"); return; }
    const list = getBeneficiaries();
    list.push({ name, accountId });
    saveBeneficiaries(list);
    document.getElementById("beneName").value = "";
    document.getElementById("beneAccountId").value = "";
    hideAddBeneficiaryForm();
    loadBeneficiaries();
    toast("Beneficiary saved", "success");
}

function removeBeneficiary(index) {
    const list = getBeneficiaries();
    list.splice(index, 1);
    saveBeneficiaries(list);
    loadBeneficiaries();
}

function selectBeneficiary(accountId) {
    document.getElementById("extTransferTo").value = accountId;
    toast(`Beneficiary selected — Account ${accountId}`, "info");
}

// ══════════════════════════════════════════════════════════
// DEPOSIT / WITHDRAW
// ══════════════════════════════════════════════════════════
function loadTransactionSelects() {
    const activeAccounts = allAccounts.filter(a => a.status === "active");
    const options = activeAccounts.map(a => `<option value="${a.account_id}">${a.account_type} (…${a.account_number.slice(-4)}) — $${a.current_balance.toFixed(2)}</option>`).join("");
    ["depositAccount", "withdrawAccount"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<option value="">Select account...</option>` + options;
    });
}

function handleDeposit(e) {
    e.preventDefault();
    const acctId = parseInt(document.getElementById("depositAccount").value);
    const amount = parseFloat(document.getElementById("depositAmount").value);
    const desc = document.getElementById("depositDesc").value || "Deposit";
    const pwd = document.getElementById("depositPwd").value;
    if (!pwd) { toast("Password is required", "error"); return; }
    
    showConfirm("Confirm Deposit", "Review the deposit details.", [
        { label: "Account", value: `ID ${acctId}` },
        { label: "Amount", value: formatCurrency(amount), total: true },
    ], async () => {
        await apiFetch("/transactions/deposit", "POST", { account_id: acctId, amount, description: desc, password: pwd });
        showReceipt(amount, [{ label: "Type", value: "Deposit" }, { label: "Account", value: `ID ${acctId}` }, { label: "Description", value: desc }]);
        addNotification(`💵 Deposited ${formatCurrency(amount)}`, "success");
        loadTransactionSelects();
        document.querySelector('#page-transactions form').reset();
    });
}

function handleWithdraw(e) {
    e.preventDefault();
    const acctId = parseInt(document.getElementById("withdrawAccount").value);
    const amount = parseFloat(document.getElementById("withdrawAmount").value);
    const desc = document.getElementById("withdrawDesc").value || "Withdrawal";
    const pwd = document.getElementById("withdrawPwd").value;
    if (!pwd) { toast("Password is required", "error"); return; }

    showConfirm("Confirm Withdrawal", "Review the withdrawal details.", [
        { label: "Account", value: `ID ${acctId}` },
        { label: "Amount", value: formatCurrency(amount), total: true },
    ], async () => {
        await apiFetch("/transactions/withdraw", "POST", { account_id: acctId, amount, description: desc, password: pwd });
        showReceipt(amount, [{ label: "Type", value: "Withdrawal" }, { label: "Account", value: `ID ${acctId}` }, { label: "Description", value: desc }]);
        addNotification(`🏧 Withdrew ${formatCurrency(amount)}`, "success");
        loadTransactionSelects();
        document.querySelector('#page-transactions form').reset();
    });
}

// ══════════════════════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════════════════════
async function loadHistory() {
    try {
        allHistory = await apiFetch("/transactions/history?limit=500");
        filteredHistory = [...allHistory];
        historyPage = 1;
        renderHistory();
    } catch (err) { toast("Failed to load history", "error"); }
}

function debounceFilterHistory() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(filterHistory, 300);
}

function filterHistory() {
    const search = (document.getElementById("historySearch").value || "").toLowerCase();
    const dateFrom = document.getElementById("historyDateFrom").value;
    const dateTo = document.getElementById("historyDateTo").value;
    const typeFilter = document.getElementById("historyTypeFilter").value;

    filteredHistory = allHistory.filter(t => {
        const text = `${t.narrative || ""} ${t.type} ${t.amount} ${t.status}`.toLowerCase();
        if (search && !text.includes(search)) return false;
        if (typeFilter && t.type !== typeFilter) return false;
        if (dateFrom && t.transaction_date < dateFrom) return false;
        if (dateTo && t.transaction_date > dateTo + "T23:59:59") return false;
        return true;
    });
    historyPage = 1;
    renderHistory();
}

function renderHistory() {
    const container = document.getElementById("historyTable");
    const paginationEl = document.getElementById("historyPagination");

    if (!filteredHistory.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><h3>No transactions found</h3><p>Try adjusting your filters.</p></div>';
        paginationEl.style.display = "none";
        return;
    }

    const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
    const start = (historyPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filteredHistory.slice(start, start + ITEMS_PER_PAGE);

    container.innerHTML = `<table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th>Balance</th><th>Status</th></tr></thead><tbody>${pageItems.map(t => {
        const cat = categorize(t.narrative);
        return `<tr><td>${formatDate(t.transaction_date)}</td><td>${t.type}</td><td><span class="category-tag ${cat.cls}">${cat.label}</span></td><td>${t.narrative || "—"}</td><td class="${t.amount >= 0 ? "amount-positive" : "amount-negative"}">${formatCurrency(t.amount)}</td><td>${formatCurrency(t.balance_after)}</td><td><span class="badge badge-${t.status === "completed" ? "success" : "warning"}">${t.status}</span></td></tr>`;
    }).join("")}</tbody></table>`;

    // Pagination
    if (totalPages > 1) {
        paginationEl.style.display = "flex";
        let html = `<button ${historyPage === 1 ? "disabled" : ""} onclick="goHistoryPage(${historyPage - 1})">◀ Prev</button>`;
        for (let p = 1; p <= totalPages; p++) {
            if (totalPages > 7 && Math.abs(p - historyPage) > 2 && p !== 1 && p !== totalPages) { if (p === 2 || p === totalPages - 1) html += `<span class="page-info">…</span>`; continue; }
            html += `<button class="${p === historyPage ? "active" : ""}" onclick="goHistoryPage(${p})">${p}</button>`;
        }
        html += `<button ${historyPage === totalPages ? "disabled" : ""} onclick="goHistoryPage(${historyPage + 1})">Next ▶</button>`;
        html += `<span class="page-info">${filteredHistory.length} items</span>`;
        paginationEl.innerHTML = html;
    } else { paginationEl.style.display = "none"; }
}

function goHistoryPage(p) { historyPage = p; renderHistory(); }

function categorize(narrative) {
    if (!narrative) return { label: "Other", cls: "other" };
    const n = narrative.toLowerCase();
    if (n.includes("salary") || n.includes("payroll")) return { label: "Salary", cls: "salary" };
    if (n.includes("food") || n.includes("restaurant") || n.includes("groceries")) return { label: "Food", cls: "food" };
    if (n.includes("rent") || n.includes("lease")) return { label: "Rent", cls: "rent" };
    if (n.includes("shop") || n.includes("amazon") || n.includes("store")) return { label: "Shopping", cls: "shopping" };
    if (n.includes("bill") || n.includes("electric") || n.includes("utility")) return { label: "Bills", cls: "bills" };
    if (n.includes("transfer")) return { label: "Transfer", cls: "transfer" };
    return { label: "Other", cls: "other" };
}

function exportTransactionsCSV() {
    if (!filteredHistory.length) { toast("No data to export", "error"); return; }
    const headers = ["Date", "Type", "Category", "Description", "Amount", "Balance After", "Status"];
    const rows = filteredHistory.map(t => [formatDate(t.transaction_date), t.type, categorize(t.narrative).label, `"${(t.narrative || "").replace(/"/g, '""')}"`, t.amount, t.balance_after, t.status]);
    let csv = headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast("CSV exported successfully", "success");
}

// ══════════════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════════════
async function loadAnalytics() {
    try {
        const [prediction, summary] = await Promise.all([
            apiFetch("/analytics/spending-prediction").catch(() => null),
            apiFetch("/analytics/spending-summary").catch(() => null),
        ]);

        if (prediction) {
            document.getElementById("predictedSpending").textContent = formatCurrency(prediction.predicted_next_month);
            document.getElementById("avgMonthly").textContent = formatCurrency(prediction.average_monthly);
            document.getElementById("spendingTrend").innerHTML = `<span class="trend-badge ${prediction.trend}">${prediction.trend === "increasing" ? "📈" : prediction.trend === "decreasing" ? "📉" : "➡️"} ${prediction.trend}</span>`;
            renderTrendChart(prediction.monthly_data);
        }

        if (summary) {
            document.getElementById("summaryIncome").textContent = formatCurrency(summary.total_income);
            document.getElementById("summaryExpenses").textContent = formatCurrency(summary.total_expenses);
            document.getElementById("summaryNetFlow").textContent = formatCurrency(summary.net_flow);
            document.getElementById("summaryTxnCount").textContent = summary.transaction_count;
        }

        loadRiskScores();
    } catch (err) { toast("Failed to load analytics", "error"); }
}

function renderTrendChart(monthlyData) {
    const ctx = document.getElementById("monthlyTrendChart")?.getContext("2d");
    if (!ctx || !monthlyData?.length) return;
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: monthlyData.map(m => m.month),
            datasets: [{ label: "Spending", data: monthlyData.map(m => m.total_spent), borderColor: "#f43f5e", backgroundColor: "rgba(244,63,94,0.08)", tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: "#f43f5e" }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#94a3b8" } } }, scales: { y: { beginAtZero: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.04)" } }, x: { ticks: { color: "#94a3b8" }, grid: { display: false } } } },
    });
}

async function loadRiskScores() {
    try {
        const scores = await apiFetch("/analytics/risk-scores");
        const container = document.getElementById("riskScoresTable");
        if (!scores.length) { container.innerHTML = '<div class="empty-state"><p>No risk scores available yet.</p></div>'; return; }
        container.innerHTML = `<table><thead><tr><th>Txn ID</th><th>Amount</th><th>Risk Score</th><th>Verdict</th><th>Scored At</th></tr></thead><tbody>${scores.map(s => {
            const cls = s.risk_score < 0.3 ? "safe" : s.risk_score < 0.7 ? "suspicious" : "critical";
            return `<tr><td>#${s.transaction_id}</td><td>${formatCurrency(s.amount)}</td><td><div class="risk-bar"><div class="risk-bar-fill ${cls}" style="width:${Math.round(s.risk_score * 100)}%"></div></div><span style="font-size:0.75rem;color:var(--text-muted)">${(s.risk_score * 100).toFixed(0)}%</span></td><td><span class="badge badge-${cls === "safe" ? "success" : cls === "suspicious" ? "warning" : "danger"}">${s.verdict}</span></td><td>${formatDate(s.scored_at)}</td></tr>`;
        }).join("")}</tbody></table>`;
    } catch { document.getElementById("riskScoresTable").innerHTML = '<div class="empty-state"><p>Could not load risk scores.</p></div>'; }
}

// ══════════════════════════════════════════════════════════
// PROFILE
// ══════════════════════════════════════════════════════════
async function loadProfile() {
    try {
        const profile = await apiFetch("/users/profile");
        currentUser = profile;
        // Sidebar
        const initials = (profile.full_name || "User").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
        document.getElementById("userAvatarInitials").textContent = initials;
        document.getElementById("sidebarUserName").textContent = profile.full_name || profile.username;
        document.getElementById("sidebarUserRole").textContent = profile.role;
        // Profile page
        document.getElementById("profileAvatar").textContent = initials;
        document.getElementById("profileName").textContent = profile.full_name;
        document.getElementById("profileEmail").textContent = profile.email;
        document.getElementById("profilePhone").textContent = profile.phone_number || "Not set";
        document.getElementById("profileDOB").textContent = profile.date_of_birth || "Not set";
        document.getElementById("profileKYC").innerHTML = `<span class="badge badge-${profile.kyc_status === "verified" ? "success" : profile.kyc_status === "pending" ? "warning" : "danger"}">${profile.kyc_status}</span>`;
        document.getElementById("profileUserId").textContent = profile.user_id;
        document.getElementById("profileUsername").textContent = profile.username;
        document.getElementById("profileRole").textContent = profile.role;
        document.getElementById("profileStatus").textContent = profile.is_active ? "Active" : "Inactive";
        document.getElementById("profileCreated").textContent = formatDate(profile.created_at);
        // Pre-fill edit form
        document.getElementById("editFullName").value = profile.full_name || "";
        document.getElementById("editEmail").value = profile.email || "";
        document.getElementById("editPhone").value = profile.phone_number || "";
    } catch (err) { toast("Failed to load profile", "error"); }
    
    // Load accounts into profile
    try {
        const accounts = await apiFetch("/accounts/"); // This returns masked balance, ok for profile
        const container = document.getElementById("profileAccountsList");
        if (!container) return; // In case element is missing
        if (!accounts.length) { container.innerHTML = '<div class="empty-state"><p>No accounts found.</p></div>'; return; }
        
        container.innerHTML = accounts.map(a => `
               <div class="account-card" style="cursor:default;">
                   <span class="account-type-badge ${a.account_type}">${a.account_type}</span>
                   <div class="balance">${formatCurrency(a.current_balance)}</div>
                   <div class="account-number"><span class="status-dot ${a.status}"></span> ${a.account_number}</div>
                   <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">${a.currency}</div>
               </div>`).join("");
    } catch (_) { /* ignore */ }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const body = {};
    const fn = document.getElementById("editFullName").value.trim();
    const em = document.getElementById("editEmail").value.trim();
    const ph = document.getElementById("editPhone").value.trim();
    if (fn) body.full_name = fn;
    if (em) body.email = em;
    if (ph) body.phone_number = ph;
    if (!Object.keys(body).length) { toast("No changes to save", "error"); return; }
    try {
        await apiFetch("/users/profile", "PUT", body);
        toast("Profile updated successfully", "success");
        addNotification("👤 Profile updated", "info");
        loadProfile();
    } catch (err) { toast(err.message, "error"); }
}

async function handlePasswordChange(e) {
    e.preventDefault();
    const o = document.getElementById("oldPassword").value;
    const n = document.getElementById("newPassword").value;
    const c = document.getElementById("confirmPassword").value;
    if (n !== c) { toast("New passwords do not match", "error"); return; }
    if (n.length < 6) { toast("Password must be at least 6 characters", "error"); return; }
    try {
        await apiFetch("/users/password", "PUT", { old_password: o, new_password: n });
        toast("Password changed successfully!", "success");
        addNotification("🔑 Password changed", "info");
        document.getElementById("oldPassword").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmPassword").value = "";
    } catch (err) { toast(err.message, "error"); }
}

// ══════════════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════════════
function showConfirm(title, subtitle, rows, action) {
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmSubtitle").textContent = subtitle;
    const detailsEl = document.getElementById("confirmDetails");
    detailsEl.innerHTML = rows.map(r => `<div class="confirm-row ${r.total ? "total" : ""}"><span class="label">${r.label}</span><span class="value">${r.value}</span></div>`).join("");
    pendingAction = action;
    document.getElementById("confirmModal").classList.add("open");
}

async function executePendingAction() {
    const btn = document.getElementById("confirmActionBtn");
    btn.classList.add("loading");
    try {
        if (pendingAction) await pendingAction();
        closeModal("confirmModal");
    } catch (err) {
        toast(err.message, "error");
    } finally {
        btn.classList.remove("loading");
    }
}

function showReceipt(amount, rows) {
    document.getElementById("receiptAmount").textContent = formatCurrency(Math.abs(amount));
    document.getElementById("receiptDetails").innerHTML = rows.map(r => `<div class="receipt-row"><span class="label">${r.label}</span><span>${r.value}</span></div>`).join("") + `<div class="receipt-row"><span class="label">Time</span><span>${new Date().toLocaleString()}</span></div>`;
    document.getElementById("receiptModal").classList.add("open");
}

function closeModal(id) { document.getElementById(id).classList.remove("open"); pendingAction = null; }

// ══════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════
function addNotification(msg, type = "info") {
    notifications.unshift({ msg, type, time: new Date().toLocaleTimeString() });
    if (notifications.length > 50) notifications.pop();
    localStorage.setItem("notifications", JSON.stringify(notifications));
    renderNotifications();
}

function renderNotifications() {
    const list = document.getElementById("notifList");
    const count = document.getElementById("notifCount");
    count.textContent = notifications.length || "";
    if (!notifications.length) { list.innerHTML = '<div class="notif-empty">No notifications yet</div>'; return; }
    list.innerHTML = notifications.slice(0, 20).map(n => `<div class="notif-item"><span class="notif-icon">${n.type === "success" ? "✅" : n.type === "error" ? "❌" : "ℹ️"}</span><div><div class="notif-msg">${n.msg}</div><div class="notif-time">${n.time}</div></div></div>`).join("");
}

function toggleNotifications() { document.getElementById("notifPanel").classList.toggle("open"); }
function clearNotifications() { notifications = []; localStorage.setItem("notifications", "[]"); renderNotifications(); }

// ══════════════════════════════════════════════════════════
// SESSION TIMER
// ══════════════════════════════════════════════════════════
function startSessionTimer() {
    sessionStart = Date.now();
    clearInterval(sessionTimerInterval);
    sessionTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        const el = document.getElementById("sessionTimerValue");
        const container = document.getElementById("sessionTimer");
        el.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        container.classList.remove("warning", "critical");
        if (mins >= 55) container.classList.add("critical");
        else if (mins >= 45) container.classList.add("warning");
    }, 1000);
}

// ══════════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════════
function loadTheme() {
    const theme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("themeToggleBtn");
    if (btn) btn.textContent = theme === "dark" ? "🌙" : "☀️";
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    document.getElementById("themeToggleBtn").textContent = next === "dark" ? "🌙" : "☀️";
}

// ══════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════
async function apiFetch(path, method = "GET", body = null) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (authToken) opts.headers["Authorization"] = `Bearer ${authToken}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`);
    return data;
}

function formatCurrency(val) {
    if (val == null || isNaN(val)) return "₹0.00";
    const abs = Math.abs(val);
    const formatted = "₹" + abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val < 0 ? `-${formatted}` : formatted;
}

function formatDate(d) {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); } catch { return d; }
}

function toast(msg, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// ══════════════════════════════════════════════════════════
// ADMIN FUNCTIONS
// ══════════════════════════════════════════════════════════

async function loadAdminDashboard() {
    try {
        const data = await apiFetch("/admin/dashboard");
        document.getElementById("kpiTotalUsers").textContent = data.total_users ?? "—";
        document.getElementById("kpiActiveUsers").textContent = data.active_users ?? "—";
        document.getElementById("kpiTotalAccounts").textContent = data.total_accounts ?? "—";
        document.getElementById("kpiSystemBalance").textContent = formatCurrency(data.system_balance);
        document.getElementById("kpiTotalTxns").textContent = data.total_transactions ?? "—";
        document.getElementById("kpiPendingKyc").textContent = data.pending_kyc ?? "—";
        document.getElementById("kpiFrozenAcct").textContent = data.frozen_accounts ?? "—";
        document.getElementById("kpiRecent24h").textContent = data.recent_transactions_24h ?? "—";
    } catch (err) {
        toast("Failed to load admin dashboard: " + err.message, "error");
    }
}

async function loadAdminUsers() {
    const search = document.getElementById("adminUserSearch")?.value || "";
    const kyc = document.getElementById("adminKycFilter")?.value || "";
    try {
        let url = "/admin/users?limit=200";
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (kyc) url += `&kyc=${encodeURIComponent(kyc)}`;
        const users = await apiFetch(url);
        const tbody = document.getElementById("adminUsersTableBody");
        if (!users.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No users found</td></tr>';
            return;
        }
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.user_id}</td>
                <td><strong>${u.username}</strong></td>
                <td>${u.full_name || "—"}</td>
                <td>${u.email || "—"}</td>
                <td><span class="badge badge-${u.kyc_status === 'verified' ? 'success' : u.kyc_status === 'rejected' ? 'danger' : 'warning'}">${u.kyc_status}</span></td>
                <td>${u.account_count}</td>
                <td>${formatCurrency(u.total_balance)}</td>
                <td>
                    <button class="btn btn-sm ${u.is_active ? 'btn-success' : 'btn-danger'}" onclick="toggleUserActive(${u.user_id})">
                        ${u.is_active ? '✓ Active' : '✗ Inactive'}
                    </button>
                </td>
                <td>
                    <select class="form-control form-control-sm" onchange="updateKYC(${u.user_id}, this.value)" style="min-width:100px;">
                        <option value="pending" ${u.kyc_status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="verified" ${u.kyc_status === 'verified' ? 'selected' : ''}>Verified</option>
                        <option value="rejected" ${u.kyc_status === 'rejected' ? 'selected' : ''}>Rejected</option>
                    </select>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        toast("Failed to load users: " + err.message, "error");
    }
}

async function loadAdminAccounts() {
    const search = document.getElementById("adminAcctSearch")?.value || "";
    const status = document.getElementById("adminAcctStatusFilter")?.value || "";
    try {
        let url = "/admin/accounts?limit=200";
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (status) url += `&status=${encodeURIComponent(status)}`;
        const accounts = await apiFetch(url);
        const tbody = document.getElementById("adminAcctTableBody");
        if (!accounts.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No accounts found</td></tr>';
            return;
        }
        tbody.innerHTML = accounts.map(a => `
            <tr>
                <td><strong>${a.account_number}</strong></td>
                <td>${a.account_type}</td>
                <td>${a.full_name || a.username}</td>
                <td>${formatCurrency(a.current_balance)}</td>
                <td><span class="badge badge-${a.status === 'active' ? 'success' : a.status === 'frozen' ? 'warning' : 'danger'}">${a.status}</span></td>
                <td>${formatDate(a.created_at)}</td>
                <td>
                    ${a.status !== 'closed' ? `
                        <button class="btn btn-sm ${a.status === 'frozen' ? 'btn-success' : 'btn-warning'}" onclick="adminFreezeAccount(${a.account_id})">
                            ${a.status === 'frozen' ? '🔓 Unfreeze' : '🔒 Freeze'}
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="adminCloseAccount(${a.account_id})" style="margin-left:4px;">❌ Close</button>
                    ` : '<span class="text-muted">Closed</span>'}
                </td>
            </tr>
        `).join("");
    } catch (err) {
        toast("Failed to load accounts: " + err.message, "error");
    }
}

async function loadAdminTransactions() {
    const search = document.getElementById("adminTxnSearch")?.value || "";
    const type = document.getElementById("adminTxnTypeFilter")?.value || "";
    try {
        let url = "/admin/transactions?limit=200";
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (type) url += `&type=${encodeURIComponent(type)}`;
        const txns = await apiFetch(url);
        const tbody = document.getElementById("adminTxnTableBody");
        if (!txns.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No transactions found</td></tr>';
            return;
        }
        tbody.innerHTML = txns.map(t => `
            <tr>
                <td style="font-family:monospace;font-size:0.8em;">${(t.reference_id || '—').substring(0, 12)}…</td>
                <td>${formatDate(t.transaction_date)}</td>
                <td><span class="badge badge-${t.type === 'DEPOSIT' ? 'success' : t.type === 'WITHDRAWAL' ? 'danger' : 'info'}">${t.type}</span></td>
                <td>${t.full_name || t.username}</td>
                <td>${t.account_number}</td>
                <td>${formatCurrency(t.amount)}</td>
                <td>${formatCurrency(t.balance_after)}</td>
                <td><span class="badge badge-${t.status === 'completed' ? 'success' : 'warning'}">${t.status}</span></td>
            </tr>
        `).join("");
    } catch (err) {
        toast("Failed to load transactions: " + err.message, "error");
    }
}

async function loadAdminAuditLogs() {
    try {
        const logs = await apiFetch("/admin/audit-logs?limit=200");
        const tbody = document.getElementById("adminAuditTableBody");
        if (!logs.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No audit logs found</td></tr>';
            return;
        }
        tbody.innerHTML = logs.map(l => `
            <tr>
                <td>${l.log_id}</td>
                <td>${l.entity_type || "—"}</td>
                <td>${l.action_type || "—"}</td>
                <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;">${l.old_value || "—"}</td>
                <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;">${l.new_value || "—"}</td>
                <td>${l.performed_by || "—"}</td>
                <td>${l.ip_address || "—"}</td>
                <td>${formatDate(l.created_at)}</td>
            </tr>
        `).join("");
    } catch (err) {
        toast("Failed to load audit logs: " + err.message, "error");
    }
}

// ── Admin Actions ────────────────────────────────────────

async function toggleUserActive(userId) {
    try {
        const res = await apiFetch(`/admin/users/${userId}/toggle-active`, "PATCH");
        toast(res.message, "success");
        loadAdminUsers();
        loadAdminDashboard();
    } catch (err) {
        toast(err.message, "error");
    }
}

async function updateKYC(userId, status) {
    try {
        const res = await apiFetch(`/admin/users/${userId}/kyc?status=${encodeURIComponent(status)}`, "PATCH");
        toast(res.message, "success");
        loadAdminDashboard();
    } catch (err) {
        toast(err.message, "error");
    }
}

async function adminFreezeAccount(accountId) {
    try {
        const res = await apiFetch(`/admin/accounts/${accountId}/freeze`, "PATCH");
        toast(res.message, "success");
        loadAdminAccounts();
        loadAdminDashboard();
    } catch (err) {
        toast(err.message, "error");
    }
}

async function adminCloseAccount(accountId) {
    if (!confirm("Are you sure you want to close this account? This action cannot be undone.")) return;
    try {
        const res = await apiFetch(`/admin/accounts/${accountId}/close`, "PATCH");
        toast(res.message, "success");
        loadAdminAccounts();
        loadAdminDashboard();
    } catch (err) {
        toast(err.message, "error");
    }
}

async function adminCreateAccount(e) {
    e.preventDefault();
    const btn = document.getElementById("adminCreateAcctBtn");
    btn.classList.add("loading");
    try {
        const res = await apiFetch("/admin/accounts/create", "POST", {
            user_id: parseInt(document.getElementById("adminNewAcctUserId").value),
            account_type: document.getElementById("adminNewAcctType").value,
            currency: document.getElementById("adminNewAcctCurrency").value,
        });
        toast(res.message, "success");
        addNotification("✅ " + res.message, "success");
        document.getElementById("adminNewAcctUserId").value = "";
        loadAdminAccounts();
        loadAdminDashboard();
    } catch (err) {
        toast(err.message, "error");
    } finally {
        btn.classList.remove("loading");
    }
}

// ── Admin Search Debounce ────────────────────────────────
function debounceAdminUserSearch() {
    clearTimeout(adminSearchTimers.users);
    adminSearchTimers.users = setTimeout(() => loadAdminUsers(), 400);
}

function debounceAdminAcctSearch() {
    clearTimeout(adminSearchTimers.accounts);
    adminSearchTimers.accounts = setTimeout(() => loadAdminAccounts(), 400);
}

function debounceAdminTxnSearch() {
    clearTimeout(adminSearchTimers.transactions);
    adminSearchTimers.transactions = setTimeout(() => loadAdminTransactions(), 400);
}
