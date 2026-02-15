/**
 * FinTech Banking System — Frontend Application v2.0
 * ====================================================
 * Dynamic SPA: animated counters, confirmation/receipt modals,
 * search & pagination, CSV export, auto-refresh, live health ping.
 */

// ── Config ────────────────────────────────────────────────
const API_BASE = window.location.origin;
let authToken = localStorage.getItem("fintech_token") || null;
let currentUser = JSON.parse(localStorage.getItem("fintech_user") || "null");

// Chart instances
let balanceChartInstance = null;
let spendingDoughnutInstance = null;
let monthlyTrendInstance = null;

// Auto-refresh
let autoRefreshInterval = null;
let autoRefreshActive = false;

// Connection health
let healthCheckInterval = null;
let isOnline = true;

// History state
let allTransactions = [];
let filteredTransactions = [];
let currentPage = 1;
const PAGE_SIZE = 20;

// Pending confirmed action
let pendingAction = null;

// ── Init ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    if (authToken && currentUser) {
        showApp();
    } else {
        showAuth();
    }
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

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
}

function formatDateTime() {
    return new Date().toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
    }) + " · " + new Date().toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit"
    });
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

// ── Animated Counter ─────────────────────────────────────

function animateValue(element, start, end, duration, isCurrency = true) {
    const startTime = performance.now();
    const update = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
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

// ── Skeleton Helpers ─────────────────────────────────────

function showSkeletonCards(container, count = 4) {
    let html = "";
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton skeleton-circle"></div>
                <div class="skeleton skeleton-line lg w-60"></div>
                <div class="skeleton skeleton-line w-40"></div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ── Modal System ─────────────────────────────────────────

function openModal(id) {
    document.getElementById(id).classList.add("active");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("active");
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

async function executeConfirmedAction() {
    if (!pendingAction) return;
    const btn = document.getElementById("confirmActionBtn");
    btn.classList.add("loading");
    btn.disabled = true;

    try {
        await pendingAction();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
        closeModal("confirmModal");
        pendingAction = null;
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
//  AUTH FUNCTIONS
// ══════════════════════════════════════════════════════════

function showAuth() {
    document.getElementById("authPage").style.display = "flex";
    document.getElementById("appPage").style.display = "none";
    stopAutoRefresh();
    stopHealthCheck();
}

function showApp() {
    document.getElementById("authPage").style.display = "none";
    document.getElementById("appPage").style.display = "flex";
    updateSidebarUser();
    startHealthCheck();
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
//  CONNECTION HEALTH CHECK
// ══════════════════════════════════════════════════════════

function startHealthCheck() {
    checkHealth();
    healthCheckInterval = setInterval(checkHealth, 15000);
}

function stopHealthCheck() {
    if (healthCheckInterval) clearInterval(healthCheckInterval);
}

async function checkHealth() {
    try {
        await apiFetch("/health");
        setOnlineStatus(true);
    } catch {
        setOnlineStatus(false);
    }
}

function setOnlineStatus(online) {
    isOnline = online;
    const dot = document.getElementById("connectionDot");
    const text = document.getElementById("connectionText");
    if (online) {
        dot.classList.remove("offline");
        text.textContent = "Connected";
    } else {
        dot.classList.add("offline");
        text.textContent = "Offline";
    }
}

// ══════════════════════════════════════════════════════════
//  AUTO-REFRESH
// ══════════════════════════════════════════════════════════

function toggleAutoRefresh() {
    autoRefreshActive = !autoRefreshActive;
    const btn = document.getElementById("autoRefreshBtn");
    const label = document.getElementById("autoRefreshLabel");

    if (autoRefreshActive) {
        btn.classList.add("active");
        label.textContent = "Live (30s)";
        autoRefreshInterval = setInterval(() => {
            loadDashboard(true); // silent refresh
        }, 30000);
        showToast("Auto-refresh enabled (30s)", "info");
    } else {
        stopAutoRefresh();
        showToast("Auto-refresh disabled", "info");
    }
}

function stopAutoRefresh() {
    autoRefreshActive = false;
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    const btn = document.getElementById("autoRefreshBtn");
    const label = document.getElementById("autoRefreshLabel");
    if (btn) btn.classList.remove("active");
    if (label) label.textContent = "Auto-Refresh";
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

async function loadDashboard(silent = false) {
    // Update greeting
    const greetEl = document.getElementById("dashboardGreeting");
    const dateEl = document.getElementById("dashboardDateTime");
    if (greetEl) greetEl.textContent = `${getGreeting()}, ${currentUser?.username || "User"} 👋`;
    if (dateEl) dateEl.textContent = formatDateTime();

    try {
        const [accounts, summary, history] = await Promise.all([
            apiFetch("/accounts/"),
            apiFetch("/analytics/spending-summary").catch(() => null),
            apiFetch("/transactions/history?limit=5").catch(() => []),
        ]);

        // Animated KPIs
        const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);
        const balEl = document.getElementById("kpiTotalBalance");
        const countEl = document.getElementById("kpiAccountCount");

        animateValue(balEl, 0, totalBalance, 1200, true);
        animateValue(countEl, 0, accounts.length, 800, false);

        if (summary) {
            animateValue(document.getElementById("kpiTotalIncome"), 0, summary.total_income, 1000, true);
            animateValue(document.getElementById("kpiTotalExpenses"), 0, summary.total_expenses, 1000, true);
        }

        // Charts
        renderBalanceChart(accounts);
        renderSpendingDoughnut(history);
        renderRecentActivity(history);

        if (!silent) {
            // No toast on normal load
        }
    } catch (err) {
        if (!silent) showToast("Failed to load dashboard: " + err.message, "error");
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
                    callbacks: {
                        label: ctx => formatCurrency(ctx.parsed.y),
                    },
                },
            },
            scales: {
                x: {
                    ticks: { color: "#64748b", font: { size: 11 } },
                    grid: { display: false },
                },
                y: {
                    ticks: {
                        color: "#64748b",
                        font: { size: 11 },
                        callback: v => "$" + v.toLocaleString(),
                    },
                    grid: { color: "rgba(255,255,255,0.04)" },
                },
            },
        },
    });
}

function renderSpendingDoughnut(transactions) {
    const ctx = document.getElementById("spendingDoughnut");
    if (!ctx) return;
    if (spendingDoughnutInstance) spendingDoughnutInstance.destroy();

    if (!transactions || transactions.length === 0) {
        ctx.parentElement.innerHTML = '<div class="empty-state"><div class="icon">🍩</div><h3>No data yet</h3><p>Make transactions to see breakdown.</p></div>';
        return;
    }

    const types = {};
    for (const t of transactions) {
        const type = t.type || "OTHER";
        types[type] = (types[type] || 0) + Math.abs(t.amount);
    }

    const typeColors = {
        DEPOSIT: "#10b981",
        WITHDRAWAL: "#f43f5e",
        TRANSFER: "#6366f1",
        PAYMENT: "#f59e0b",
        OTHER: "#8b5cf6",
    };

    spendingDoughnutInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: Object.keys(types),
            datasets: [{
                data: Object.values(types),
                backgroundColor: Object.keys(types).map(t => typeColors[t] || "#64748b"),
                borderWidth: 0,
                hoverOffset: 8,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#94a3b8",
                        padding: 16,
                        font: { size: 12 },
                        usePointStyle: true,
                        pointStyleWidth: 10,
                    },
                },
                tooltip: {
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    titleColor: "#f1f5f9",
                    bodyColor: "#94a3b8",
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`,
                    },
                },
            },
        },
    });
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
        html += `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-glass);border-radius:var(--radius-sm);border:1px solid var(--border-glass);transition:var(--transition-fast);" onmouseenter="this.style.background='var(--bg-glass-hover)'" onmouseleave="this.style.background='var(--bg-glass)'">
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

// ══════════════════════════════════════════════════════════
//  ACCOUNTS
// ══════════════════════════════════════════════════════════

async function loadAccounts() {
    const container = document.getElementById("accountsList");
    showSkeletonCards(container, 3);

    try {
        const accounts = await apiFetch("/accounts/");
        if (accounts.length === 0) {
            container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🏦</div><h3>No accounts yet</h3><p>Click "New Account" to create your first bank account.</p></div>';
            return;
        }

        const maxBal = Math.max(...accounts.map(a => a.current_balance), 1);

        let html = "";
        for (const acct of accounts) {
            const pct = Math.min((acct.current_balance / maxBal) * 100, 100);
            html += `
                <div class="account-card" onclick="toggleAccountExpand(this, ${acct.account_id})">
                    <span class="account-type-badge ${acct.account_type}">${acct.account_type}</span>
                    <div class="balance">${formatCurrency(acct.current_balance)}</div>
                    <div class="account-number">
                        <span class="status-dot ${acct.status}"></span>
                        ${acct.account_number} · ${acct.currency}
                    </div>
                    <div class="account-progress">
                        <div class="account-progress-fill ${acct.account_type}" style="width: ${pct}%"></div>
                    </div>
                    <div style="margin-top:8px;font-size:0.72rem;color:var(--text-muted);">
                        ID: ${acct.account_id} · ${acct.status.toUpperCase()} · Click for details
                    </div>
                    <div class="account-mini-statement" id="mini-${acct.account_id}">
                        <div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.78rem;">Loading mini-statement...</div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">⚠️</div><h3>Error</h3><p>${err.message}</p></div>`;
    }
}

async function toggleAccountExpand(card, accountId) {
    const isExpanded = card.classList.contains("expanded");
    // Close all expanded
    document.querySelectorAll(".account-card.expanded").forEach(c => c.classList.remove("expanded"));

    if (!isExpanded) {
        card.classList.add("expanded");
        const miniContainer = document.getElementById(`mini-${accountId}`);
        try {
            const statement = await apiFetch(`/accounts/${accountId}/statement`);
            const txns = statement.slice(0, 5);
            if (txns.length === 0) {
                miniContainer.innerHTML = '<div style="text-align:center;padding:8px;font-size:0.78rem;color:var(--text-muted);">No transactions yet</div>';
            } else {
                let html = '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:8px;font-weight:600;">Recent Transactions</div>';
                for (const t of txns) {
                    const isPos = t.amount > 0;
                    html += `
                        <div class="mini-txn">
                            <span class="desc">${t.narrative || t.type}</span>
                            <span class="${isPos ? 'amt-pos' : 'amt-neg'}">${isPos ? '+' : ''}${formatCurrency(t.amount)}</span>
                        </div>
                    `;
                }
                miniContainer.innerHTML = html;
            }
        } catch {
            miniContainer.innerHTML = '<div style="text-align:center;padding:8px;font-size:0.78rem;color:var(--text-muted);">Could not load statement</div>';
        }
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
        hideCreateAccountModal();
        loadAccounts();
    } catch (err) {
        showToast(err.message, "error");
    }
}

// ══════════════════════════════════════════════════════════
//  TRANSACTIONS — with Confirmation & Receipt
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

function handleDeposit(e) {
    e.preventDefault();
    const accountEl = document.getElementById("depositAccount");
    const amount = parseFloat(document.getElementById("depositAmount").value);
    const desc = document.getElementById("depositDesc").value || "Cash Deposit";
    const accountName = accountEl.options[accountEl.selectedIndex].text;

    showConfirmation("Confirm Deposit", "You are about to deposit funds", {
        "Account": accountName,
        "Description": desc,
        "Amount": formatCurrency(amount),
    }, async () => {
        const data = await apiFetch("/transactions/deposit", {
            method: "POST",
            body: JSON.stringify({
                account_id: parseInt(accountEl.value),
                amount,
                description: desc,
            }),
        });
        showReceipt(amount, {
            "Type": "Deposit",
            "Account": accountName,
            "Description": desc,
            "Status": "Completed",
            "Date": new Date().toLocaleString(),
        });
        document.getElementById("depositAmount").value = "";
        document.getElementById("depositDesc").value = "";
        loadTransactionDropdowns();
    });
}

function handleWithdraw(e) {
    e.preventDefault();
    const accountEl = document.getElementById("withdrawAccount");
    const amount = parseFloat(document.getElementById("withdrawAmount").value);
    const desc = document.getElementById("withdrawDesc").value || "Cash Withdrawal";
    const accountName = accountEl.options[accountEl.selectedIndex].text;

    showConfirmation("Confirm Withdrawal", "You are about to withdraw funds", {
        "Account": accountName,
        "Description": desc,
        "Amount": formatCurrency(amount),
    }, async () => {
        const data = await apiFetch("/transactions/withdraw", {
            method: "POST",
            body: JSON.stringify({
                account_id: parseInt(accountEl.value),
                amount,
                description: desc,
            }),
        });
        showReceipt(amount, {
            "Type": "Withdrawal",
            "Account": accountName,
            "Description": desc,
            "Status": "Completed",
            "Date": new Date().toLocaleString(),
        });
        document.getElementById("withdrawAmount").value = "";
        document.getElementById("withdrawDesc").value = "";
        loadTransactionDropdowns();
    });
}

function handleTransfer(e) {
    e.preventDefault();
    const fromEl = document.getElementById("transferFrom");
    const toId = document.getElementById("transferTo").value;
    const amount = parseFloat(document.getElementById("transferAmount").value);
    const desc = document.getElementById("transferDesc").value || "Fund Transfer";
    const fromName = fromEl.options[fromEl.selectedIndex].text;

    showConfirmation("Confirm Transfer", "Please verify the transfer details", {
        "From": fromName,
        "To Account ID": toId,
        "Description": desc,
        "Amount": formatCurrency(amount),
    }, async () => {
        const data = await apiFetch("/transactions/transfer", {
            method: "POST",
            body: JSON.stringify({
                sender_account_id: parseInt(fromEl.value),
                receiver_account_id: parseInt(toId),
                amount,
                description: desc,
            }),
        });
        showReceipt(amount, {
            "Type": "Transfer",
            "From": fromName,
            "To Account": `#${toId}`,
            "Description": desc,
            "Status": "Completed",
            "Date": new Date().toLocaleString(),
        });
        document.getElementById("transferAmount").value = "";
        document.getElementById("transferTo").value = "";
        document.getElementById("transferDesc").value = "";
        loadTransactionDropdowns();
    });
}

// ══════════════════════════════════════════════════════════
//  TRANSACTION HISTORY — Search, Pagination, Export
// ══════════════════════════════════════════════════════════

async function loadHistory() {
    const container = document.getElementById("historyTable");
    container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div>Loading...</div>';

    try {
        const typeFilter = document.getElementById("historyTypeFilter").value;
        const url = `/transactions/history?limit=500${typeFilter ? `&type=${typeFilter}` : ""}`;
        allTransactions = await apiFetch(url);
        currentPage = 1;
        filterHistory();
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3><p>${err.message}</p></div>`;
        document.getElementById("historyPagination").style.display = "none";
    }
}

function filterHistory() {
    const searchTerm = (document.getElementById("historySearch")?.value || "").toLowerCase();
    const dateFrom = document.getElementById("historyDateFrom")?.value || "";
    const dateTo = document.getElementById("historyDateTo")?.value || "";

    filteredTransactions = allTransactions.filter(txn => {
        // Search filter
        if (searchTerm) {
            const text = `${txn.narrative || ""} ${txn.type || ""} ${txn.amount} ${txn.account_number || ""}`.toLowerCase();
            if (!text.includes(searchTerm)) return false;
        }
        // Date filter
        if (dateFrom && txn.transaction_date) {
            const txnDate = txn.transaction_date.split(" ")[0];
            if (txnDate < dateFrom) return false;
        }
        if (dateTo && txn.transaction_date) {
            const txnDate = txn.transaction_date.split(" ")[0];
            if (txnDate > dateTo) return false;
        }
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
    paginationEl.style.display = totalPages > 1 ? "flex" : "none";
    document.getElementById("pageInfo").textContent = `Showing ${start + 1}–${end} of ${totalItems}`;
    document.getElementById("prevPageBtn").disabled = currentPage <= 1;
    document.getElementById("nextPageBtn").disabled = currentPage >= totalPages;
}

function changePage(delta) {
    const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE) || 1;
    currentPage = Math.max(1, Math.min(currentPage + delta, totalPages));
    renderHistoryPage();
}

// ── CSV Export ────────────────────────────────────────────

function exportTransactionsCSV() {
    const data = filteredTransactions.length > 0 ? filteredTransactions : allTransactions;
    if (!data || data.length === 0) {
        showToast("No transactions to export.", "info");
        return;
    }

    const headers = ["ID", "Date", "Type", "Description", "Account", "Amount", "Balance After", "Status"];
    const rows = data.map(t => [
        t.transaction_id,
        t.transaction_date || "",
        t.type || "",
        `"${(t.narrative || "").replace(/"/g, '""')}"`,
        t.account_number || "",
        t.amount,
        t.balance_after || "",
        t.status || "",
    ]);

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
}

// ══════════════════════════════════════════════════════════
//  ANALYTICS
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
        renderMonthlyTrend(history);

        // Load risk scores
        loadRiskScores();
    } catch (err) {
        showToast("Failed to load analytics: " + err.message, "error");
    }
}

function renderMonthlyTrend(transactions) {
    const ctx = document.getElementById("monthlyTrendChart");
    if (!ctx) return;
    if (monthlyTrendInstance) monthlyTrendInstance.destroy();

    if (!transactions || transactions.length === 0) {
        ctx.parentElement.innerHTML = '<div class="empty-state"><div class="icon">📈</div><h3>No data</h3><p>Transactions will appear here.</p></div>';
        return;
    }

    // Group by month
    const monthlyData = {};
    for (const t of transactions) {
        if (!t.transaction_date) continue;
        const month = t.transaction_date.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };
        if (t.amount > 0) monthlyData[month].income += t.amount;
        else monthlyData[month].expense += Math.abs(t.amount);
    }

    const labels = Object.keys(monthlyData).sort();
    const incomeData = labels.map(m => monthlyData[m].income);
    const expenseData = labels.map(m => monthlyData[m].expense);

    monthlyTrendInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels.map(m => {
                const d = new Date(m + "-01");
                return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
            }),
            datasets: [
                {
                    label: "Income",
                    data: incomeData,
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
                    data: expenseData,
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
                    labels: { color: "#94a3b8", padding: 16, usePointStyle: true },
                },
                tooltip: {
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    titleColor: "#f1f5f9",
                    bodyColor: "#94a3b8",
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
                    },
                },
            },
            scales: {
                x: {
                    ticks: { color: "#64748b", font: { size: 11 } },
                    grid: { display: false },
                },
                y: {
                    ticks: {
                        color: "#64748b",
                        font: { size: 11 },
                        callback: v => "$" + v.toLocaleString(),
                    },
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
    const btn = e.target.querySelector(".btn");
    if (btn) { btn.classList.add("loading"); btn.disabled = true; }

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
        loadProfile();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        if (btn) { btn.classList.remove("loading"); btn.disabled = false; }
    }
}
