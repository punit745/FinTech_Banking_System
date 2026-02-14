"""
FinTech Banking — Monitoring Dashboard
=======================================
A Streamlit-powered visual dashboard for monitoring the banking system.

Run:
    streamlit run app.py

Features:
    - KPI Overview (total users, accounts, volume, flagged transactions)
    - Account Balances (bar chart by user)
    - Transaction History (interactive table)
    - AI Risk Scores (scatter plot + risk distribution)
    - Customer Statement Lookup
    - System Health (ledger integrity check)
"""

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import db

# ============================================================
# PAGE CONFIG
# ============================================================
st.set_page_config(
    page_title="FinTech Banking Dashboard",
    page_icon="🏦",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ============================================================
# CUSTOM CSS
# ============================================================
st.markdown("""
<style>
    /* Dark professional theme overrides */
    .stMetric {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        padding: 20px;
        border-radius: 12px;
        border: 1px solid #0f3460;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }
    .stMetric label {
        color: #a0aec0 !important;
        font-size: 0.85rem !important;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    .stMetric [data-testid="stMetricValue"] {
        color: #e2e8f0 !important;
        font-size: 1.8rem !important;
        font-weight: 700;
    }
    div[data-testid="stSidebar"] {
        background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
    }
    .block-container {
        padding-top: 2rem;
    }
    h1 { color: #e2e8f0; }
    h2 { color: #cbd5e1; border-bottom: 1px solid #334155; padding-bottom: 8px; }
    h3 { color: #94a3b8; }
</style>
""", unsafe_allow_html=True)


# ============================================================
# SIDEBAR NAVIGATION
# ============================================================
with st.sidebar:
    st.markdown("## 🏦 FinTech Banking")
    st.markdown("---")
    page = st.radio(
        "Navigation",
        ["📊 Overview", "💰 Accounts", "📜 Transactions", "🤖 AI Risk Scores", "👤 Customer Lookup", "🛡️ System Health"],
        label_visibility="collapsed"
    )
    st.markdown("---")
    st.markdown("##### 🔄 Auto-refresh")
    auto_refresh = st.checkbox("Enable (every 30s)", value=False)
    if auto_refresh:
        st.markdown("*Dashboard will refresh every 30 seconds*")
        import time
        time.sleep(30)
        st.rerun()


# ============================================================
# PAGE: OVERVIEW
# ============================================================
if page == "📊 Overview":
    st.title("📊 Dashboard Overview")
    st.markdown("Real-time snapshot of the banking system.")

    # KPI Row
    col1, col2, col3, col4, col5 = st.columns(5)
    with col1:
        st.metric("👥 Users", db.get_total_users())
    with col2:
        st.metric("🏧 Active Accounts", db.get_total_accounts())
    with col3:
        vol = db.get_total_volume()
        st.metric("💸 Total Volume", f"${vol:,.2f}")
    with col4:
        st.metric("📄 Transactions", db.get_total_transactions())
    with col5:
        flagged = db.get_flagged_count()
        st.metric("🚨 Flagged", flagged, delta_color="inverse")

    st.markdown("---")

    # Charts Row
    chart_col1, chart_col2 = st.columns(2)

    with chart_col1:
        st.subheader("💰 Balance by User")
        bal_df = db.get_balance_by_user()
        if not bal_df.empty and "error" not in bal_df.columns:
            fig = px.bar(
                bal_df, x="username", y="total_balance",
                color="total_balance",
                color_continuous_scale=["#1e3a5f", "#00d2ff"],
                labels={"username": "User", "total_balance": "Balance ($)"},
            )
            fig.update_layout(
                plot_bgcolor="rgba(0,0,0,0)",
                paper_bgcolor="rgba(0,0,0,0)",
                font_color="#94a3b8",
                showlegend=False,
                coloraxis_showscale=False
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No account data available.")

    with chart_col2:
        st.subheader("📈 Volume by Transaction Type")
        vol_df = db.get_transaction_volume_by_type()
        if not vol_df.empty and "error" not in vol_df.columns:
            fig = px.pie(
                vol_df, values="volume", names="type_code",
                color_discrete_sequence=px.colors.sequential.Tealgrn,
                hole=0.4
            )
            fig.update_layout(
                plot_bgcolor="rgba(0,0,0,0)",
                paper_bgcolor="rgba(0,0,0,0)",
                font_color="#94a3b8"
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No transaction data available.")

    # Recent Transactions
    st.subheader("📜 Recent Transactions")
    txn_df = db.get_recent_transactions(10)
    if not txn_df.empty and "error" not in txn_df.columns:
        st.dataframe(txn_df, use_container_width=True, hide_index=True)
    else:
        st.info("No transactions yet.")


# ============================================================
# PAGE: ACCOUNTS
# ============================================================
elif page == "💰 Accounts":
    st.title("💰 Account Management")

    acct_df = db.get_all_accounts()
    if not acct_df.empty and "error" not in acct_df.columns:
        # Summary
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Total Accounts", len(acct_df))
        with col2:
            st.metric("Total Balance", f"${acct_df['current_balance'].sum():,.2f}")
        with col3:
            st.metric("Account Types", acct_df["account_type"].nunique())

        st.markdown("---")

        # Filter
        acct_type = st.selectbox("Filter by Type", ["All"] + acct_df["account_type"].unique().tolist())
        if acct_type != "All":
            acct_df = acct_df[acct_df["account_type"] == acct_type]

        st.dataframe(acct_df, use_container_width=True, hide_index=True)

        # Chart
        st.subheader("Balance Distribution")
        fig = px.bar(
            acct_df, x="account_number", y="current_balance",
            color="account_type", barmode="group",
            color_discrete_sequence=["#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444"],
            labels={"account_number": "Account", "current_balance": "Balance ($)"}
        )
        fig.update_layout(
            plot_bgcolor="rgba(0,0,0,0)",
            paper_bgcolor="rgba(0,0,0,0)",
            font_color="#94a3b8"
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.warning("Could not load account data.")


# ============================================================
# PAGE: TRANSACTIONS
# ============================================================
elif page == "📜 Transactions":
    st.title("📜 Transaction History")

    txn_df = db.get_recent_transactions(50)
    if not txn_df.empty and "error" not in txn_df.columns:
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Total Shown", len(txn_df))
        with col2:
            completed = len(txn_df[txn_df["status"] == "completed"])
            st.metric("Completed", completed)

        st.markdown("---")

        # Filter by type
        types = txn_df["type"].unique().tolist()
        selected_type = st.selectbox("Filter by Type", ["All"] + types)
        if selected_type != "All":
            txn_df = txn_df[txn_df["type"] == selected_type]

        st.dataframe(txn_df, use_container_width=True, hide_index=True)
    else:
        st.warning("Could not load transaction data.")


# ============================================================
# PAGE: AI RISK SCORES
# ============================================================
elif page == "🤖 AI Risk Scores":
    st.title("🤖 AI Risk Scores")
    st.markdown("Transaction risk assessment by the Isolation Forest model.")

    risk_df = db.get_risk_scores()
    if not risk_df.empty and "error" not in risk_df.columns:
        # KPIs
        col1, col2, col3 = st.columns(3)
        with col1:
            safe = len(risk_df[risk_df["verdict"] == "SAFE"])
            st.metric("🟢 Safe", safe)
        with col2:
            suspicious = len(risk_df[risk_df["verdict"] == "SUSPICIOUS"])
            st.metric("🟡 Suspicious", suspicious)
        with col3:
            critical = len(risk_df[risk_df["verdict"] == "CRITICAL"])
            st.metric("🔴 Critical", critical)

        st.markdown("---")

        # Risk Distribution Chart
        col_chart1, col_chart2 = st.columns(2)

        with col_chart1:
            st.subheader("Risk Score Distribution")
            fig = px.histogram(
                risk_df, x="risk_score", nbins=20,
                color_discrete_sequence=["#06b6d4"],
                labels={"risk_score": "Risk Score"}
            )
            fig.add_vline(x=0.5, line_dash="dash", line_color="#f59e0b", 
                         annotation_text="Suspicious Threshold")
            fig.add_vline(x=0.8, line_dash="dash", line_color="#ef4444",
                         annotation_text="Critical Threshold")
            fig.update_layout(
                plot_bgcolor="rgba(0,0,0,0)",
                paper_bgcolor="rgba(0,0,0,0)",
                font_color="#94a3b8"
            )
            st.plotly_chart(fig, use_container_width=True)

        with col_chart2:
            st.subheader("Verdict Breakdown")
            verdict_counts = risk_df["verdict"].value_counts().reset_index()
            verdict_counts.columns = ["verdict", "count"]
            colors = {"SAFE": "#22c55e", "SUSPICIOUS": "#f59e0b", "CRITICAL": "#ef4444"}
            fig = px.pie(
                verdict_counts, values="count", names="verdict",
                color="verdict",
                color_discrete_map=colors,
                hole=0.45
            )
            fig.update_layout(
                plot_bgcolor="rgba(0,0,0,0)",
                paper_bgcolor="rgba(0,0,0,0)",
                font_color="#94a3b8"
            )
            st.plotly_chart(fig, use_container_width=True)

        # Risk Scores Table
        st.subheader("All Risk Scores")
        st.dataframe(risk_df, use_container_width=True, hide_index=True)
    else:
        st.info("No risk scores yet. Run the AI worker first: `cd ai_worker && python worker.py`")


# ============================================================
# PAGE: CUSTOMER LOOKUP
# ============================================================
elif page == "👤 Customer Lookup":
    st.title("👤 Customer Statement Lookup")

    usernames = db.get_usernames()
    if usernames:
        selected_user = st.selectbox("Select a customer", usernames)

        if selected_user:
            # User accounts
            st.subheader(f"💰 Accounts for {selected_user}")
            accts = db.get_all_accounts()
            if not accts.empty and "error" not in accts.columns:
                user_accts = accts[accts["username"] == selected_user]
                st.dataframe(user_accts, use_container_width=True, hide_index=True)

            # Statement
            st.subheader(f"📜 Transaction Statement")
            stmt = db.get_customer_statement(selected_user)
            if not stmt.empty and "error" not in stmt.columns:
                st.dataframe(stmt, use_container_width=True, hide_index=True)

                # Balance over time chart
                if "balance_after" in stmt.columns and "transaction_date" in stmt.columns:
                    st.subheader("📈 Balance Over Time")
                    fig = px.line(
                        stmt.sort_values("transaction_date"),
                        x="transaction_date", y="balance_after",
                        markers=True,
                        color_discrete_sequence=["#06b6d4"],
                        labels={"transaction_date": "Date", "balance_after": "Balance ($)"}
                    )
                    fig.update_layout(
                        plot_bgcolor="rgba(0,0,0,0)",
                        paper_bgcolor="rgba(0,0,0,0)",
                        font_color="#94a3b8"
                    )
                    st.plotly_chart(fig, use_container_width=True)
            else:
                st.info(f"No transactions found for {selected_user}.")
    else:
        st.warning("No users found in the database.")


# ============================================================
# PAGE: SYSTEM HEALTH
# ============================================================
elif page == "🛡️ System Health":
    st.title("🛡️ System Health Check")

    # Ledger Integrity
    st.subheader("🔍 Ledger Integrity")
    integrity_df = db.get_ledger_integrity()
    if integrity_df.empty or "error" not in integrity_df.columns:
        if len(integrity_df) == 0:
            st.success("✅ **Ledger is CLEAN** — All transactions have zero net sum. The books balance perfectly.")
        else:
            st.error(f"❌ **Integrity Violations Found!** — {len(integrity_df)} transactions have non-zero sums.")
            st.dataframe(integrity_df, use_container_width=True, hide_index=True)
    else:
        st.warning("Could not check integrity.")

    st.markdown("---")

    # Balance Sheet
    st.subheader("📊 Balance Sheet")
    bs_df = db.get_balance_sheet()
    if not bs_df.empty and "error" not in bs_df.columns:
        st.dataframe(bs_df, use_container_width=True, hide_index=True)
    else:
        st.info("No balance sheet data.")

    st.markdown("---")

    # Users
    st.subheader("👥 User Registry")
    users_df = db.get_all_users()
    if not users_df.empty and "error" not in users_df.columns:
        st.dataframe(users_df, use_container_width=True, hide_index=True)
    else:
        st.warning("Could not load users.")


# ============================================================
# FOOTER
# ============================================================
st.markdown("---")
st.markdown(
    "<center style='color: #475569; font-size: 0.8rem;'>"
    "FinTech Banking System — Dashboard v1.0 | "
    "Powered by Streamlit + Plotly"
    "</center>",
    unsafe_allow_html=True
)
