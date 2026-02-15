/**
 * FinTech Banking System — Frontend Application
 * ================================================
 * Single Page Application logic: API calls, DOM manipulation,
 * Chart.js integration, and JWT token management.
 */

// ── Config ────────────────────────────────────────────────
const API_BASE = window.location.origin;
let authToken = localStorage.getItem("fintech_token") || null;
let currentUser = JSON.parse(localStorage.getItem("fintech_user") || "null");

// Chart instances (to destroy before re-creating)
let balanceChartInstance = null;

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
//  AUTH FUNCTIONS
// ══════════════════════════════════════════════════════════

function showAuth() {
    document.getElementById("authPage").style.display = "flex";
    document.getElementById("appPage").style.display = "none";
}

function showApp() {
    document.getElementById("authPage").style.display = "none";
    document.getElementById("appPage").style.display = "flex";
    updateSidebarUser();
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
    btn.disabled = true;
    btn.textContent = "Signing in...";

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
        btn.disabled = false;
        btn.textContent = "Sign In";
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById("registerBtn");
    btn.disabled = true;
    btn.textContent = "Creating...";

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
        btn.disabled = false;
        btn.textContent = "Create Account";
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
//  NAVIGATION
// ══════════════════════════════════════════════════════════

function navigateTo(page) {
    // Update nav items
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item.dataset.page === page);
    });

    // Show target page section
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
    try {
        // Load accounts + spending summary in parallel
        const [accounts, summary, history] = await Promise.all([
            apiFetch("/accounts/"),
            apiFetch("/analytics/spending-summary").catch(() => null),
            apiFetch("/transactions/history?limit=5").catch(() => []),
        ]);

        // KPIs
        const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);
        document.getElementById("kpiTotalBalance").textContent = formatCurrency(totalBalance);
        document.getElementById("kpiAccountCount").textContent = accounts.length;

        if (summary) {
            document.getElementById("kpiTotalIncome").textContent = formatCurrency(summary.total_income);
            document.getElementById("kpiTotalExpenses").textContent = formatCurrency(summary.total_expenses);
        }

        // Balance Chart
        renderBalanceChart(accounts);

        // Recent Activity
        renderRecentActivity(history);

    } catch (err) {
        showToast("Failed to load dashboard: " + err.message, "error");
    }
}

function renderBalanceChart(accounts) {
    const ctx = document.getElementById("balanceChart");
    if (!ctx) return;

    if (balanceChartInstance) {
        balanceChartInstance.destroy();
    }

    if (accounts.length === 0) {
        ctx.parentElement.innerHTML = '<div class="empty-state"><div class="icon">📊</div><h3>No accounts yet</h3><p>Create your first account to see charts.</p></div>';
        return;
    }

    const colors = {
        savings: "#10b981",
        checking: "#06b6d4",
        wallet: "#8b5cf6",
        loan: "#f43f5e",
    };

    balanceChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: accounts.map(a => `${a.account_number}`),
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
        hideCreateAccountModal();
        loadAccounts();
    } catch (err) {
        showToast(err.message, "error");
    }
}

// ══════════════════════════════════════════════════════════
//  TRANSACTIONS
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
    try {
        const data = await apiFetch("/transactions/deposit", {
            method: "POST",
            body: JSON.stringify({
                account_id: parseInt(document.getElementById("depositAccount").value),
                amount: parseFloat(document.getElementById("depositAmount").value),
                description: document.getElementById("depositDesc").value || "Cash Deposit",
            }),
        });
        showToast(data.message, "success");
        document.getElementById("depositAmount").value = "";
        document.getElementById("depositDesc").value = "";
        loadTransactionDropdowns();
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function handleWithdraw(e) {
    e.preventDefault();
    try {
        const data = await apiFetch("/transactions/withdraw", {
            method: "POST",
            body: JSON.stringify({
                account_id: parseInt(document.getElementById("withdrawAccount").value),
                amount: parseFloat(document.getElementById("withdrawAmount").value),
                description: document.getElementById("withdrawDesc").value || "Cash Withdrawal",
            }),
        });
        showToast(data.message, "success");
        document.getElementById("withdrawAmount").value = "";
        document.getElementById("withdrawDesc").value = "";
        loadTransactionDropdowns();
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function handleTransfer(e) {
    e.preventDefault();
    try {
        const data = await apiFetch("/transactions/transfer", {
            method: "POST",
            body: JSON.stringify({
                sender_account_id: parseInt(document.getElementById("transferFrom").value),
                receiver_account_id: parseInt(document.getElementById("transferTo").value),
                amount: parseFloat(document.getElementById("transferAmount").value),
                description: document.getElementById("transferDesc").value || "Fund Transfer",
            }),
        });
        showToast(data.message, "success");
        document.getElementById("transferAmount").value = "";
        document.getElementById("transferTo").value = "";
        document.getElementById("transferDesc").value = "";
        loadTransactionDropdowns();
    } catch (err) {
        showToast(err.message, "error");
    }
}

// ══════════════════════════════════════════════════════════
//  TRANSACTION HISTORY
// ══════════════════════════════════════════════════════════

async function loadHistory() {
    const container = document.getElementById("historyTable");
    container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div>Loading...</div>';

    try {
        const typeFilter = document.getElementById("historyTypeFilter").value;
        const url = `/transactions/history?limit=100${typeFilter ? `&type=${typeFilter}` : ""}`;
        const transactions = await apiFetch(url);

        if (transactions.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">📜</div><h3>No transactions found</h3><p>Adjust your filters or make a transaction first.</p></div>';
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

        for (const txn of transactions) {
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
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3><p>${err.message}</p></div>`;
    }
}

// ══════════════════════════════════════════════════════════
//  ANALYTICS
// ══════════════════════════════════════════════════════════

async function loadAnalytics() {
    try {
        const [prediction, summary] = await Promise.all([
            apiFetch("/analytics/spending-prediction").catch(() => null),
            apiFetch("/analytics/spending-summary").catch(() => null),
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

        // Load risk scores
        loadRiskScores();
    } catch (err) {
        showToast("Failed to load analytics: " + err.message, "error");
    }
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

        // Detail fields
        document.getElementById("profileUserId").textContent = profile.user_id;
        document.getElementById("profileUsername").textContent = profile.username;
        document.getElementById("profileRole").textContent = profile.role;
        document.getElementById("profileStatus").textContent = profile.is_active ? "Active" : "Inactive";
        document.getElementById("profileCreated").textContent = profile.created_at || "—";

        // Pre-fill edit form
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
        loadProfile();
    } catch (err) {
        showToast(err.message, "error");
    }
}
