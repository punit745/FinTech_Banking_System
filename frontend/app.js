/**
 * FinTech Banking System — Frontend Application
 * ================================================
 * SPA logic: API calls, DOM manipulation, Chart.js,
 * JWT management, theme toggle, notification center,
 * confirmation modals, session timer, search/filter/pagination,
 * CSV export, and animated KPIs.
 */

// ── Config ────────────────────────────────────────────────
const API_BASE = window.location.origin;
let authToken = localStorage.getItem("fintech_token") || null;
let currentUser = JSON.parse(localStorage.getItem("fintech_user") || "null");

// Chart instances
let balanceChartInstance = null;
let spendingDoughnutInstance = null;
let monthlyTrendInstance = null;

// History state
let allTransactions = [];
let filteredTransactions = [];
let currentPage = 1;
const PAGE_SIZE = 20;
let filterDebounceTimer = null;

// Notifications
let notifications = JSON.parse(localStorage.getItem("fintech_notifications") || "[]");

// Modal
let pendingAction = null;

// Session timer
let sessionTimerInterval = null;
const SESSION_DURATION = 30 * 60; // 30 minutes
let sessionSecondsLeft = SESSION_DURATION;

// Previous KPI values for animation
let prevKPIs = { balance: 0, accounts: 0, income: 0, expenses: 0 };

// ── Init ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    // Apply saved theme
    const savedTheme = localStorage.getItem("fintech_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);

    if (authToken && currentUser) {
        showApp();
    } else {
        showAuth();
    }

    // Close notification panel on outside click
    document.addEventListener("click", (e) => {
        const panel = document.getElementById("notifPanel");
        const bell = document.getElementById("notifBell");
        if (panel && bell && !panel.contains(e.target) && !bell.contains(e.target)) {
            panel.classList.remove("open");
        }
    });
});

// ══════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════

async function apiFetch(endpoint, options = {}) {
    const headers = { "Content-Type": "application/json", ...options.headers };
    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
    }
    try {
        const resp = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        if (resp.status === 401) {
            logout();
            throw new Error("Session expired. Please log in again.");
        }
        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.detail || data.message || "Request failed");
        }
        return data;
    } catch (err) {
        if (err.message.includes("Failed to fetch")) {
            throw new Error("Cannot connect to server. Is the API running?");
        }
        throw err;
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
}

// ── Animated KPI Counter ─────────────────────────────────
function animateValue(element, start, end, duration, isCurrency = true) {
    const startTime = performance.now();
    const update = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentVal = start + (end - start) * eased;
        element.textContent = isCurrency ? formatCurrency(currentVal) : Math.round(currentVal).toString();
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.classList.add("flash");
            setTimeout(() => element.classList.remove("flash"), 600);
        }
    };
    requestAnimationFrame(update);
}

// ── Transaction Category Detection ───────────────────────
function categorizeTransaction(txn) {
    const text = ((txn.narrative || "") + " " + (txn.type || "")).toLowerCase();
    if (/salary|payroll|wage/.test(text)) return { cat: "salary", label: "💰 Salary" };
    if (/food|restaurant|grocery|cafe|pizza|burger/.test(text)) return { cat: "food", label: "🍔 Food" };
    if (/rent|housing|mortgage/.test(text)) return { cat: "rent", label: "🏠 Rent" };
    if (/shop|amazon|buy|purchase|store/.test(text)) return { cat: "shopping", label: "🛒 Shopping" };
    if (/bill|electric|water|gas|internet|phone|subscription/.test(text)) return { cat: "bills", label: "📄 Bills" };
    if (/transfer/.test(text)) return { cat: "transfer", label: "🔄 Transfer" };
    return { cat: "other", label: "📌 Other" };
}

// ── Toast Notifications ──────────────────────────────────

function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    const icons = { success: "✅", error: "❌", info: "ℹ️" };
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// ══════════════════════════════════════════════════════════
//  THEME TOGGLE
// ══════════════════════════════════════════════════════════

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("fintech_theme", next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById("themeToggleBtn");
    if (btn) btn.textContent = theme === "dark" ? "🌙" : "☀️";
}

// ══════════════════════════════════════════════════════════
//  NOTIFICATION CENTER
// ══════════════════════════════════════════════════════════

function addNotification(icon, message) {
    const notif = { icon, message, time: new Date().toLocaleTimeString() };
    notifications.unshift(notif);
    if (notifications.length > 50) notifications.pop();
    localStorage.setItem("fintech_notifications", JSON.stringify(notifications));
    renderNotifications();
}

function renderNotifications() {
    const list = document.getElementById("notifList");
    const count = document.getElementById("notifCount");
    if (!list) return;

    if (notifications.length === 0) {
        list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
        count.textContent = "";
        return;
    }

    count.textContent = notifications.length > 9 ? "9+" : notifications.length;
    list.innerHTML = notifications.slice(0, 20).map(n => `
        <div class="notif-item">
            <span class="notif-icon">${n.icon}</span>
            <div class="notif-text">
                <div class="notif-msg">${n.message}</div>
                <div class="notif-time">${n.time}</div>
            </div>
        </div>
    `).join("");
}

function toggleNotifications() {
    const panel = document.getElementById("notifPanel");
    panel.classList.toggle("open");
}

function clearNotifications() {
    notifications = [];
    localStorage.setItem("fintech_notifications", "[]");
    renderNotifications();
}

// ══════════════════════════════════════════════════════════
//  MODAL SYSTEM
// ══════════════════════════════════════════════════════════

function openModal(id) {
    document.getElementById(id).classList.add("open");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("open");
    if (id === "confirmModal") pendingAction = null;
}

function showConfirmation(title, subtitle, details, action) {
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmSubtitle").textContent = subtitle;

    let html = "";
    for (const [label, value] of Object.entries(details)) {
        const cls = label === "Amount" ? "total" : "";
        html += `<div class="confirm-row ${cls}"><span class="label">${label}</span><span class="value">${value}</span></div>`;
    }
    document.getElementById("confirmDetails").innerHTML = html;
    pendingAction = action;
    openModal("confirmModal");
}

async function executePendingAction() {
    if (!pendingAction) return;
    const btn = document.getElementById("confirmActionBtn");
    btn.classList.add("loading");
    btn.disabled = true;
    try {
        await pendingAction();
    } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
        closeModal("confirmModal");
    }
}

function showReceipt(amount, details) {
    document.getElementById("receiptAmount").textContent = formatCurrency(amount);
    let html = "";
    for (const [label, value] of Object.entries(details)) {
        html += `<div class="receipt-row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
    }
    document.getElementById("receiptDetails").innerHTML = html;
    openModal("receiptModal");
}

// ══════════════════════════════════════════════════════════
//  SESSION TIMER
// ══════════════════════════════════════════════════════════

function startSessionTimer() {
    sessionSecondsLeft = SESSION_DURATION;
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    sessionTimerInterval = setInterval(() => {
        sessionSecondsLeft--;
        updateSessionDisplay();
        if (sessionSecondsLeft <= 0) {
            clearInterval(sessionTimerInterval);
            showToast("Session expired. Logging out...", "error");
            setTimeout(logout, 1500);
        } else if (sessionSecondsLeft === 120) {
            showToast("⚠️ Your session expires in 2 minutes!", "info");
        }
    }, 1000);
    updateSessionDisplay();
}

function stopSessionTimer() {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
}

function updateSessionDisplay() {
    const el = document.getElementById("sessionTimerValue");
    const container = document.getElementById("sessionTimer");
    if (!el) return;
    const m = Math.floor(sessionSecondsLeft / 60);
    const s = sessionSecondsLeft % 60;
    el.textContent = `${m}:${s.toString().padStart(2, "0")}`;

    container.classList.remove("warning", "critical");
    if (sessionSecondsLeft <= 120) container.classList.add("critical");
    else if (sessionSecondsLeft <= 300) container.classList.add("warning");
}

// ══════════════════════════════════════════════════════════
//  AUTH FUNCTIONS
// ══════════════════════════════════════════════════════════

function showAuth() {
    document.getElementById("authPage").style.display = "flex";
    document.getElementById("appPage").style.display = "none";
    stopSessionTimer();
}

function showApp() {
    document.getElementById("authPage").style.display = "none";
    document.getElementById("appPage").style.display = "flex";
    updateSidebarUser();
    renderNotifications();
    startSessionTimer();
    navigateTo("dashboard");
}

function switchAuthTab(tab) {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
    if (tab === "login") {
        document.querySelectorAll(".auth-tab")[0].classList.add("active");
        document.getElementById("loginForm").classList.add("active");
    } else {
        document.querySelectorAll(".auth-tab")[1].classList.add("active");
        document.getElementById("registerForm").classList.add("active");
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById("loginBtn");
    btn.classList.add("loading");
    btn.disabled = true;

    try {
        const data = await apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({
                username: document.getElementById("loginUsername").value,
                password: document.getElementById("loginPassword").value,
            }),
        });
        authToken = data.access_token;
        currentUser = { user_id: data.user_id, username: data.username, role: data.role };
        localStorage.setItem("fintech_token", authToken);
        localStorage.setItem("fintech_user", JSON.stringify(currentUser));
        addNotification("🔐", `Signed in as ${data.username}`);
        showToast(`Welcome back, ${data.username}!`, "success");
        showApp();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById("registerBtn");
    btn.classList.add("loading");
    btn.disabled = true;

    try {
        await apiFetch("/auth/register", {
            method: "POST",
            body: JSON.stringify({
                username: document.getElementById("regUsername").value,
                full_name: document.getElementById("regFullName").value,
                email: document.getElementById("regEmail").value,
                phone_number: document.getElementById("regPhone").value || null,
                date_of_birth: document.getElementById("regDOB").value,
                password: document.getElementById("regPassword").value,
            }),
        });
        showToast("Account created! You can now sign in.", "success");
        addNotification("🎉", "Account created successfully!");
        switchAuthTab("login");
        document.getElementById("loginUsername").value = document.getElementById("regUsername").value;
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem("fintech_token");
    localStorage.removeItem("fintech_user");
    stopSessionTimer();
    showAuth();
    showToast("You have been signed out.", "info");
}

function updateSidebarUser() {
    if (!currentUser) return;
    const initials = currentUser.username.substring(0, 2).toUpperCase();
    document.getElementById("userAvatarInitials").textContent = initials;
    document.getElementById("sidebarUserName").textContent = currentUser.username;
    document.getElementById("sidebarUserRole").textContent = currentUser.role;
}

// ══════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════

function navigateTo(page) {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item.dataset.page === page);
    });

    document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add("active");

    // Close mobile sidebar
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("active");

    // Load page data
    switch (page) {
        case "dashboard": loadDashboard(); break;
        case "accounts": loadAccounts(); break;
        case "transactions": loadTransactionDropdowns(); break;
        case "history": loadHistory(); break;
        case "analytics": loadAnalytics(); break;
        case "profile": loadProfile(); break;
    }
}

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("sidebarOverlay").classList.toggle("active");
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════

async function loadDashboard() {
    // Dynamic greeting
    const greetEl = document.getElementById("dashboardGreeting");
    if (greetEl && currentUser) {
        greetEl.textContent = `${getGreeting()}, ${currentUser.username}`;
    }

    try {
        const [accounts, summary, history] = await Promise.all([
            apiFetch("/accounts/"),
            apiFetch("/analytics/spending-summary").catch(() => null),
            apiFetch("/transactions/history?limit=5").catch(() => []),
        ]);

        // Animated KPIs
        const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);
        animateValue(document.getElementById("kpiTotalBalance"), prevKPIs.balance, totalBalance, 800);
        animateValue(document.getElementById("kpiAccountCount"), prevKPIs.accounts, accounts.length, 600, false);
        prevKPIs.balance = totalBalance;
        prevKPIs.accounts = accounts.length;

        if (summary) {
            animateValue(document.getElementById("kpiTotalIncome"), prevKPIs.income, summary.total_income, 800);
            animateValue(document.getElementById("kpiTotalExpenses"), prevKPIs.expenses, summary.total_expenses, 800);
            prevKPIs.income = summary.total_income;
            prevKPIs.expenses = summary.total_expenses;
        }

        // Charts
        renderBalanceChart(accounts);
        renderSpendingDoughnut(accounts);

        // Quick transfer dropdown
        populateQuickTransferDropdown(accounts);

        // Recent Activity
        renderRecentActivity(history);

    } catch (err) {
        showToast("Failed to load dashboard: " + err.message, "error");
    }
}

function renderBalanceChart(accounts) {
    const ctx = document.getElementById("balanceChart");
    if (!ctx) return;

    if (balanceChartInstance) balanceChartInstance.destroy();

    if (accounts.length === 0) {
        ctx.parentElement.innerHTML = '<div class="empty-state"><div class="icon">📊</div><h3>No accounts yet</h3><p>Create your first account to see charts.</p></div>';
        return;
    }

    const colors = { savings: "#10b981", checking: "#06b6d4", wallet: "#8b5cf6", loan: "#f43f5e" };

    balanceChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: accounts.map(a => a.account_number),
            datasets: [{
                label: "Balance",
                data: accounts.map(a => a.current_balance),
                backgroundColor: accounts.map(a => colors[a.account_type] || "#6366f1"),
                borderRadius: 8,
                borderSkipped: false,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    borderColor: "rgba(99, 102, 241, 0.3)",
                    borderWidth: 1,
                    titleColor: "#f1f5f9",
                    bodyColor: "#94a3b8",
                    padding: 12,
                    cornerRadius: 8,
                },
            },
            scales: {
                x: { ticks: { color: "#64748b", font: { size: 11 } }, grid: { display: false } },
                y: {
                    ticks: { color: "#64748b", font: { size: 11 }, callback: v => "$" + v.toLocaleString() },
                    grid: { color: "rgba(255,255,255,0.04)" },
                },
            },
        },
    });
}

function renderSpendingDoughnut(accounts) {
    const ctx = document.getElementById("spendingDoughnut");
    if (!ctx) return;

    if (spendingDoughnutInstance) spendingDoughnutInstance.destroy();

    if (accounts.length === 0) {
        ctx.parentElement.innerHTML = '<div class="empty-state"><div class="icon">🍩</div><h3>No data</h3></div>';
        return;
    }

    const typeMap = {};
    for (const a of accounts) {
        typeMap[a.account_type] = (typeMap[a.account_type] || 0) + a.current_balance;
    }

    const labels = Object.keys(typeMap);
    const data = Object.values(typeMap);
    const bgColors = labels.map(t => ({ savings: "#10b981", checking: "#06b6d4", wallet: "#8b5cf6", loan: "#f43f5e" }[t] || "#6366f1"));

    spendingDoughnutInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
            datasets: [{ data, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 8 }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { color: "#94a3b8", padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } },
                },
            },
        },
    });
}

function populateQuickTransferDropdown(accounts) {
    const sel = document.getElementById("quickFrom");
    if (!sel) return;
    sel.innerHTML = '<option value="">Account...</option>' +
        accounts.map(a => `<option value="${a.account_id}">${a.account_number} (${formatCurrency(a.current_balance)})</option>`).join("");
}

function renderRecentActivity(transactions) {
    const container = document.getElementById("recentActivity");
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📜</div><h3>No recent activity</h3><p>Make your first transaction.</p></div>';
        return;
    }

    let html = '<div style="display:flex;flex-direction:column;gap:10px;">';
    for (const txn of transactions) {
        const isCredit = txn.amount > 0;
        const amountClass = isCredit ? "amount-positive" : "amount-negative";
        const icon = txn.type === "DEPOSIT" ? "💵" : txn.type === "WITHDRAWAL" ? "🏧" : txn.type === "TRANSFER" ? "🔄" : "💳";
        const { label } = categorizeTransaction(txn);
        html += `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-glass);border-radius:var(--radius-sm);border:1px solid var(--border-glass);">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:1.2rem;">${icon}</span>
                    <div>
                        <div style="font-size:0.85rem;font-weight:500;">${txn.narrative || txn.type}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);">${txn.account_number || ""} · ${txn.transaction_date ? txn.transaction_date.split(" ")[0] : ""}</div>
                    </div>
                </div>
                <span class="${amountClass}" style="font-size:0.9rem;">${isCredit ? "+" : ""}${formatCurrency(txn.amount)}</span>
            </div>
        `;
    }
    html += "</div>";
    container.innerHTML = html;
}

// ── Quick Transfer ───────────────────────────────────────
async function handleQuickTransfer(e) {
    e.preventDefault();
    const fromId = parseInt(document.getElementById("quickFrom").value);
    const toId = parseInt(document.getElementById("quickTo").value);
    const amount = parseFloat(document.getElementById("quickAmount").value);

    showConfirmation("Quick Transfer", "Confirm the transfer details below.", {
        "From Account": `ID: ${fromId}`,
        "To Account": `ID: ${toId}`,
        "Amount": formatCurrency(amount),
    }, async () => {
        const data = await apiFetch("/transactions/transfer", {
            method: "POST",
            body: JSON.stringify({
                sender_account_id: fromId,
                receiver_account_id: toId,
                amount,
                description: "Quick Transfer",
            }),
        });
        addNotification("🔄", `Transferred ${formatCurrency(amount)} to Account #${toId}`);
        showReceipt(amount, { "Type": "Transfer", "To": `Account ${toId}`, "Status": "Completed", "Time": new Date().toLocaleString() });
        document.getElementById("quickTo").value = "";
        document.getElementById("quickAmount").value = "";
        loadDashboard();
    });
}

// ══════════════════════════════════════════════════════════
//  ACCOUNTS
// ══════════════════════════════════════════════════════════

async function loadAccounts() {
    const container = document.getElementById("accountsList");
    container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div>Loading...</div>';

    try {
        const accounts = await apiFetch("/accounts/");
        if (accounts.length === 0) {
            container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🏦</div><h3>No accounts yet</h3><p>Click "New Account" to create your first bank account.</p></div>';
            return;
        }

        let html = "";
        for (const acct of accounts) {
            html += `
                <div class="account-card">
                    <span class="account-type-badge ${acct.account_type}">${acct.account_type}</span>
                    <div class="balance">${formatCurrency(acct.current_balance)}</div>
                    <div class="account-number">
                        <span class="status-dot ${acct.status}"></span>
                        ${acct.account_number} · ${acct.currency}
                    </div>
                    <div style="margin-top:12px;font-size:0.75rem;color:var(--text-muted);">
                        ID: ${acct.account_id} · ${acct.status.toUpperCase()}
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">⚠️</div><h3>Error</h3><p>${err.message}</p></div>`;
    }
}

function showCreateAccountModal() {
    document.getElementById("createAccountForm").style.display = "block";
}

function hideCreateAccountModal() {
    document.getElementById("createAccountForm").style.display = "none";
}

async function handleCreateAccount(e) {
    e.preventDefault();
    try {
        const data = await apiFetch("/accounts/", {
            method: "POST",
            body: JSON.stringify({
                account_type: document.getElementById("newAccountType").value,
                currency: document.getElementById("newAccountCurrency").value,
            }),
        });
        showToast(data.message + ` (${data.data.account_number})`, "success");
        addNotification("🏦", `New ${document.getElementById("newAccountType").value} account created`);
        hideCreateAccountModal();
        loadAccounts();
    } catch (err) {
        showToast(err.message, "error");
    }
}

// ══════════════════════════════════════════════════════════
//  TRANSACTIONS (with Confirmation Modals)
// ══════════════════════════════════════════════════════════

async function loadTransactionDropdowns() {
    try {
        const accounts = await apiFetch("/accounts/");
        const options = accounts.map(a =>
            `<option value="${a.account_id}">${a.account_number} (${a.account_type}) — ${formatCurrency(a.current_balance)}</option>`
        );
        const optionsHtml = '<option value="">Select account...</option>' + options.join("");

        document.getElementById("depositAccount").innerHTML = optionsHtml;
        document.getElementById("withdrawAccount").innerHTML = optionsHtml;
        document.getElementById("transferFrom").innerHTML = optionsHtml;
    } catch (err) {
        showToast("Failed to load accounts: " + err.message, "error");
    }
}

async function handleDeposit(e) {
    e.preventDefault();
    const accountId = parseInt(document.getElementById("depositAccount").value);
    const amount = parseFloat(document.getElementById("depositAmount").value);
    const desc = document.getElementById("depositDesc").value || "Cash Deposit";
    const acctText = document.getElementById("depositAccount").selectedOptions[0].text;

    showConfirmation("Confirm Deposit", "Review the deposit details.", {
        "Account": acctText,
        "Description": desc,
        "Amount": formatCurrency(amount),
    }, async () => {
        const data = await apiFetch("/transactions/deposit", {
            method: "POST",
            body: JSON.stringify({ account_id: accountId, amount, description: desc }),
        });
        addNotification("💵", `Deposited ${formatCurrency(amount)}`);
        showReceipt(amount, { "Type": "Deposit", "Account": acctText.split("(")[0].trim(), "Description": desc, "Status": "Completed", "Time": new Date().toLocaleString() });
        document.getElementById("depositAmount").value = "";
        document.getElementById("depositDesc").value = "";
        loadTransactionDropdowns();
    });
}

async function handleWithdraw(e) {
    e.preventDefault();
    const accountId = parseInt(document.getElementById("withdrawAccount").value);
    const amount = parseFloat(document.getElementById("withdrawAmount").value);
    const desc = document.getElementById("withdrawDesc").value || "Cash Withdrawal";
    const acctText = document.getElementById("withdrawAccount").selectedOptions[0].text;

    showConfirmation("Confirm Withdrawal", "Review the withdrawal details.", {
        "Account": acctText,
        "Description": desc,
        "Amount": formatCurrency(amount),
    }, async () => {
        const data = await apiFetch("/transactions/withdraw", {
            method: "POST",
            body: JSON.stringify({ account_id: accountId, amount, description: desc }),
        });
        addNotification("🏧", `Withdrew ${formatCurrency(amount)}`);
        showReceipt(amount, { "Type": "Withdrawal", "Account": acctText.split("(")[0].trim(), "Description": desc, "Status": "Completed", "Time": new Date().toLocaleString() });
        document.getElementById("withdrawAmount").value = "";
        document.getElementById("withdrawDesc").value = "";
        loadTransactionDropdowns();
    });
}

async function handleTransfer(e) {
    e.preventDefault();
    const fromId = parseInt(document.getElementById("transferFrom").value);
    const toId = parseInt(document.getElementById("transferTo").value);
    const amount = parseFloat(document.getElementById("transferAmount").value);
    const desc = document.getElementById("transferDesc").value || "Fund Transfer";
    const acctText = document.getElementById("transferFrom").selectedOptions[0].text;

    showConfirmation("Confirm Transfer", "Review the transfer details.", {
        "From": acctText,
        "To": `Account ID: ${toId}`,
        "Description": desc,
        "Amount": formatCurrency(amount),
    }, async () => {
        const data = await apiFetch("/transactions/transfer", {
            method: "POST",
            body: JSON.stringify({
                sender_account_id: fromId,
                receiver_account_id: toId,
                amount,
                description: desc,
            }),
        });
        addNotification("🔄", `Transferred ${formatCurrency(amount)} to Account #${toId}`);
        showReceipt(amount, { "Type": "Transfer", "From": acctText.split("(")[0].trim(), "To": `Account ${toId}`, "Description": desc, "Status": "Completed", "Time": new Date().toLocaleString() });
        document.getElementById("transferAmount").value = "";
        document.getElementById("transferTo").value = "";
        document.getElementById("transferDesc").value = "";
        loadTransactionDropdowns();
    });
}

// ══════════════════════════════════════════════════════════
//  TRANSACTION HISTORY (Search, Filter, Pagination, CSV)
// ══════════════════════════════════════════════════════════

async function loadHistory() {
    const container = document.getElementById("historyTable");
    container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div>Loading...</div>';
    document.getElementById("historyPagination").style.display = "none";

    try {
        const transactions = await apiFetch("/transactions/history?limit=500");
        allTransactions = transactions || [];
        filterHistory();
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3><p>${err.message}</p></div>`;
    }
}

function debounceFilterHistory() {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(filterHistory, 300);
}

function filterHistory() {
    const searchTerm = (document.getElementById("historySearch")?.value || "").toLowerCase();
    const dateFrom = document.getElementById("historyDateFrom")?.value || "";
    const dateTo = document.getElementById("historyDateTo")?.value || "";
    const typeFilter = document.getElementById("historyTypeFilter")?.value || "";

    filteredTransactions = allTransactions.filter(txn => {
        if (searchTerm) {
            const text = `${txn.narrative || ""} ${txn.type || ""} ${txn.amount} ${txn.account_number || ""}`.toLowerCase();
            if (!text.includes(searchTerm)) return false;
        }
        if (dateFrom && txn.transaction_date) {
            if (txn.transaction_date.split(" ")[0] < dateFrom) return false;
        }
        if (dateTo && txn.transaction_date) {
            if (txn.transaction_date.split(" ")[0] > dateTo) return false;
        }
        if (typeFilter && txn.type !== typeFilter) return false;
        return true;
    });

    currentPage = 1;
    renderHistoryPage();
}

function renderHistoryPage() {
    const container = document.getElementById("historyTable");
    const totalItems = filteredTransactions.length;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, totalItems);
    const pageItems = filteredTransactions.slice(start, end);

    if (totalItems === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📜</div><h3>No transactions found</h3><p>Adjust your filters or make a transaction first.</p></div>';
        document.getElementById("historyPagination").style.display = "none";
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Account</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const txn of pageItems) {
        const isCredit = txn.amount > 0;
        const amountClass = isCredit ? "amount-positive" : "amount-negative";
        const { cat, label } = categorizeTransaction(txn);
        const statusBadge = txn.status === "completed"
            ? '<span class="badge badge-success">completed</span>'
            : txn.status === "pending"
                ? '<span class="badge badge-warning">pending</span>'
                : `<span class="badge badge-danger">${txn.status}</span>`;

        html += `
            <tr>
                <td>#${txn.transaction_id}</td>
                <td style="white-space:nowrap;">${txn.transaction_date ? txn.transaction_date.split(" ")[0] : "—"}</td>
                <td><span class="badge badge-info">${txn.type}</span></td>
                <td><span class="category-tag ${cat}">${label}</span></td>
                <td>${txn.narrative || "—"}</td>
                <td style="font-family:monospace;font-size:0.78rem;">${txn.account_number || "—"}</td>
                <td class="${amountClass}">${isCredit ? "+" : ""}${formatCurrency(txn.amount)}</td>
                <td>${formatCurrency(txn.balance_after)}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }

    html += "</tbody></table>";
    container.innerHTML = html;

    // Pagination
    const paginationEl = document.getElementById("historyPagination");
    if (totalPages > 1) {
        let pHtml = `<button ${currentPage <= 1 ? "disabled" : ""} onclick="goToPage(${currentPage - 1})">‹ Prev</button>`;
        const maxButtons = 5;
        let startP = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endP = Math.min(totalPages, startP + maxButtons - 1);
        if (endP - startP < maxButtons - 1) startP = Math.max(1, endP - maxButtons + 1);

        for (let i = startP; i <= endP; i++) {
            pHtml += `<button class="${i === currentPage ? "active" : ""}" onclick="goToPage(${i})">${i}</button>`;
        }
        pHtml += `<span class="page-info">${start + 1}–${end} of ${totalItems}</span>`;
        pHtml += `<button ${currentPage >= totalPages ? "disabled" : ""} onclick="goToPage(${currentPage + 1})">Next ›</button>`;
        paginationEl.innerHTML = pHtml;
        paginationEl.style.display = "flex";
    } else {
        paginationEl.style.display = "none";
    }
}

function goToPage(page) {
    currentPage = page;
    renderHistoryPage();
}

// ── CSV Export ───────────────────────────────────────────
function exportTransactionsCSV() {
    const data = filteredTransactions.length > 0 ? filteredTransactions : allTransactions;
    if (!data || data.length === 0) {
        showToast("No transactions to export.", "info");
        return;
    }

    const headers = ["ID", "Date", "Type", "Category", "Description", "Account", "Amount", "Balance After", "Status"];
    const rows = data.map(t => {
        const { label } = categorizeTransaction(t);
        return [
            t.transaction_id,
            t.transaction_date || "",
            t.type || "",
            label,
            `"${(t.narrative || "").replace(/"/g, '""')}"`,
            t.account_number || "",
            t.amount,
            t.balance_after || "",
            t.status || "",
        ];
    });

    let csv = headers.join(",") + "\n";
    csv += rows.map(r => r.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Exported ${data.length} transactions to CSV`, "success");
    addNotification("📥", `Exported ${data.length} transactions to CSV`);
}

// ══════════════════════════════════════════════════════════
//  ANALYTICS (with Monthly Trend Chart)
// ══════════════════════════════════════════════════════════

async function loadAnalytics() {
    try {
        const [prediction, summary, history] = await Promise.all([
            apiFetch("/analytics/spending-prediction").catch(() => null),
            apiFetch("/analytics/spending-summary").catch(() => null),
            apiFetch("/transactions/history?limit=500").catch(() => []),
        ]);

        // Prediction
        if (prediction) {
            document.getElementById("predictedSpending").textContent = formatCurrency(prediction.predicted_next_month);
            document.getElementById("avgMonthly").textContent = formatCurrency(prediction.average_monthly);

            const trendIcons = { increasing: "📈 Increasing", decreasing: "📉 Decreasing", stable: "➡️ Stable" };
            document.getElementById("spendingTrend").innerHTML =
                `<span class="trend-badge ${prediction.trend}">${trendIcons[prediction.trend] || prediction.trend}</span>`;
        }

        // Summary
        if (summary) {
            document.getElementById("summaryIncome").textContent = formatCurrency(summary.total_income);
            document.getElementById("summaryExpenses").textContent = formatCurrency(summary.total_expenses);
            document.getElementById("summaryNetFlow").textContent = formatCurrency(summary.net_flow);
            document.getElementById("summaryTxnCount").textContent = summary.transaction_count;
        }

        // Monthly trend chart
        renderMonthlyTrendChart(history);

        // Risk scores
        loadRiskScores();
    } catch (err) {
        showToast("Failed to load analytics: " + err.message, "error");
    }
}

function renderMonthlyTrendChart(transactions) {
    const ctx = document.getElementById("monthlyTrendChart");
    if (!ctx) return;
    if (monthlyTrendInstance) monthlyTrendInstance.destroy();

    if (!transactions || transactions.length === 0) {
        ctx.parentElement.innerHTML = '<div class="empty-state"><div class="icon">📊</div><h3>No data</h3></div>';
        return;
    }

    // Aggregate by month
    const monthlyData = {};
    for (const txn of transactions) {
        if (!txn.transaction_date) continue;
        const month = txn.transaction_date.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };
        if (txn.amount > 0) monthlyData[month].income += txn.amount;
        else monthlyData[month].expense += Math.abs(txn.amount);
    }

    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(m => {
        const [y, mo] = m.split("-");
        return new Date(y, mo - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    });

    monthlyTrendInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Income",
                    data: sortedMonths.map(m => monthlyData[m].income),
                    borderColor: "#10b981",
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: "#10b981",
                },
                {
                    label: "Expenses",
                    data: sortedMonths.map(m => monthlyData[m].expense),
                    borderColor: "#f43f5e",
                    backgroundColor: "rgba(244, 63, 94, 0.1)",
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: "#f43f5e",
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "top",
                    labels: { color: "#94a3b8", usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } },
                },
                tooltip: {
                    backgroundColor: "rgba(15,23,42,0.95)",
                    titleColor: "#f1f5f9",
                    bodyColor: "#94a3b8",
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` },
                },
            },
            scales: {
                x: { ticks: { color: "#64748b", font: { size: 11 } }, grid: { display: false } },
                y: {
                    ticks: { color: "#64748b", font: { size: 11 }, callback: v => "$" + v.toLocaleString() },
                    grid: { color: "rgba(255,255,255,0.04)" },
                },
            },
        },
    });
}

async function loadRiskScores() {
    const container = document.getElementById("riskScoresTable");
    container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div>Loading...</div>';

    try {
        const scores = await apiFetch("/analytics/risk-scores");

        if (scores.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">🤖</div><h3>No risk scores</h3><p>The AI worker needs to score your transactions first.</p></div>';
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>TXN ID</th>
                        <th>Amount</th>
                        <th>Risk Score</th>
                        <th>Risk Level</th>
                        <th>Verdict</th>
                        <th>Scored At</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const s of scores) {
            const riskClass = s.risk_score >= 0.8 ? "critical" : s.risk_score >= 0.5 ? "suspicious" : "safe";
            const verdictBadge = s.verdict === "SAFE"
                ? '<span class="badge badge-success">🟢 SAFE</span>'
                : s.verdict === "SUSPICIOUS"
                    ? '<span class="badge badge-warning">🟡 SUSPICIOUS</span>'
                    : '<span class="badge badge-danger">🔴 CRITICAL</span>';

            html += `
                <tr>
                    <td>#${s.transaction_id}</td>
                    <td>${formatCurrency(s.amount)}</td>
                    <td>
                        ${s.risk_score.toFixed(4)}
                        <div class="risk-bar"><div class="risk-bar-fill ${riskClass}" style="width: ${s.risk_score * 100}%"></div></div>
                    </td>
                    <td style="text-transform:uppercase;font-weight:600;color:${riskClass === 'safe' ? 'var(--accent-emerald)' : riskClass === 'suspicious' ? 'var(--accent-amber)' : 'var(--accent-rose)'};">${riskClass}</td>
                    <td>${verdictBadge}</td>
                    <td style="white-space:nowrap;font-size:0.78rem;">${s.scored_at || "—"}</td>
                </tr>
            `;
        }

        html += "</tbody></table>";
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3><p>${err.message}</p></div>`;
    }
}

// ══════════════════════════════════════════════════════════
//  PROFILE
// ══════════════════════════════════════════════════════════

async function loadProfile() {
    try {
        const profile = await apiFetch("/auth/me");

        const initials = (profile.full_name || profile.username || "U").substring(0, 2).toUpperCase();
        document.getElementById("profileAvatar").textContent = initials;
        document.getElementById("profileName").textContent = profile.full_name || profile.username;
        document.getElementById("profileEmail").textContent = profile.email || "—";
        document.getElementById("profilePhone").textContent = profile.phone_number || "—";
        document.getElementById("profileDOB").textContent = profile.date_of_birth || "—";

        const kycBadge = profile.kyc_status === "verified"
            ? '<span class="badge badge-success">✅ Verified</span>'
            : profile.kyc_status === "pending"
                ? '<span class="badge badge-warning">⏳ Pending</span>'
                : '<span class="badge badge-danger">❌ Rejected</span>';
        document.getElementById("profileKYC").innerHTML = kycBadge;

        document.getElementById("profileUserId").textContent = profile.user_id;
        document.getElementById("profileUsername").textContent = profile.username;
        document.getElementById("profileRole").textContent = profile.role;
        document.getElementById("profileStatus").textContent = profile.is_active ? "Active" : "Inactive";
        document.getElementById("profileCreated").textContent = profile.created_at || "—";

        document.getElementById("editFullName").value = profile.full_name || "";
        document.getElementById("editEmail").value = profile.email || "";
        document.getElementById("editPhone").value = profile.phone_number || "";
    } catch (err) {
        showToast("Failed to load profile: " + err.message, "error");
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    try {
        const body = {};
        const name = document.getElementById("editFullName").value;
        const email = document.getElementById("editEmail").value;
        const phone = document.getElementById("editPhone").value;

        if (name) body.full_name = name;
        if (email) body.email = email;
        if (phone) body.phone_number = phone;

        await apiFetch("/users/profile", {
            method: "PUT",
            body: JSON.stringify(body),
        });
        showToast("Profile updated successfully!", "success");
        addNotification("👤", "Profile updated");
        loadProfile();
    } catch (err) {
        showToast(err.message, "error");
    }
}
