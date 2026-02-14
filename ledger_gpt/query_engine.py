"""
LedgerGPT Query Engine
=======================
Converts natural language questions into safe SQL queries using:
  1. OpenAI GPT (primary) - if API key is configured
  2. Template Matching (fallback) - works offline with common queries

Safety: All generated SQL is validated before execution.
Only SELECT queries are allowed.
"""

import re
import mysql.connector
from config import DB_CONFIG, BLOCKED_KEYWORDS, MAX_ROWS, OPENAI_API_KEY, OPENAI_MODEL
from schema_context import SCHEMA_CONTEXT


# ============================================================
# TEMPLATE ENGINE (Offline Fallback)
# ============================================================
# Maps common natural language patterns to parameterized SQL

QUERY_TEMPLATES = {
    # --- Account Queries ---
    r"(?:show|list|get)\s+(?:all\s+)?accounts?\s+(?:for|of|belonging to)\s+(\w+)": {
        "sql": """SELECT a.account_id, a.account_number, a.account_type, a.currency, 
                         a.current_balance, a.status 
                  FROM accounts a 
                  JOIN users u ON a.user_id = u.user_id 
                  WHERE u.username = '{0}' LIMIT {max_rows}""",
        "description": "List accounts for a specific user"
    },

    r"(?:what is|show|get)\s+(?:the\s+)?balance\s+(?:for|of)\s+(\w+)": {
        "sql": """SELECT u.username, a.account_number, a.account_type, 
                         a.current_balance, a.currency
                  FROM accounts a 
                  JOIN users u ON a.user_id = u.user_id 
                  WHERE u.username = '{0}' LIMIT {max_rows}""",
        "description": "Show balance for a user"
    },

    # --- Transaction Queries ---
    r"(?:show|list|get)\s+(?:all\s+)?transactions?\s+(?:for|of|by)\s+(\w+)": {
        "sql": """SELECT transaction_date, type, narrative, amount, balance_after, status
                  FROM vw_customer_statement 
                  WHERE username = '{0}' 
                  ORDER BY transaction_date DESC LIMIT {max_rows}""",
        "description": "Show transaction history for a user"
    },

    r"(?:show|list|get)\s+(?:all\s+)?(?:recent\s+)?transactions": {
        "sql": """SELECT t.transaction_id, t.reference_id, tt.type_code, t.description, 
                         t.status, t.created_at
                  FROM transactions t
                  JOIN transaction_types tt ON t.type_id = tt.type_id
                  ORDER BY t.created_at DESC LIMIT {max_rows}""",
        "description": "Show recent transactions"
    },

    r"(?:show|find|list)\s+(?:all\s+)?transfers?\s+(?:over|above|greater than|more than)\s+\$?(\d+[\d,.]*)": {
        "sql": """SELECT t.transaction_id, u.username AS sender, t.description,
                         ABS(te.amount) AS amount, t.created_at
                  FROM transactions t
                  JOIN transaction_entries te ON t.transaction_id = te.transaction_id
                  JOIN transaction_types tt ON t.type_id = tt.type_id
                  LEFT JOIN users u ON t.initiated_by_user_id = u.user_id
                  WHERE tt.type_code = 'TRANSFER' AND te.amount < 0 
                        AND ABS(te.amount) > {0}
                  ORDER BY ABS(te.amount) DESC LIMIT {max_rows}""",
        "description": "Find transfers above a certain amount"
    },

    # --- Risk & Fraud Queries ---
    r"(?:show|list|get|find)\s+(?:all\s+)?(?:flagged|suspicious|critical|risky)\s+transactions?": {
        "sql": """SELECT transaction_id, reference_id, txn_status, risk_score, verdict, 
                         initiated_by, txn_time
                  FROM vw_flagged_transactions 
                  ORDER BY risk_score DESC LIMIT {max_rows}""",
        "description": "Show AI-flagged transactions"
    },

    r"(?:show|list|get)\s+(?:all\s+)?risk\s+scores?": {
        "sql": """SELECT rs.transaction_id, rs.risk_score, rs.verdict, rs.features_used, 
                         rs.scored_at
                  FROM transaction_risk_scores rs
                  ORDER BY rs.risk_score DESC LIMIT {max_rows}""",
        "description": "Show all AI risk scores"
    },

    # --- System Queries ---
    r"(?:check|verify|show)\s+(?:ledger\s+)?integrity": {
        "sql": """SELECT transaction_id, reference_id, net_sum, entries_count 
                  FROM vw_ledger_integrity_check LIMIT {max_rows}""",
        "description": "Check ledger integrity (should return 0 rows)"
    },

    r"(?:show|get)\s+(?:the\s+)?balance\s+sheet": {
        "sql": """SELECT category, total_amount, currency 
                  FROM vw_balance_sheet""",
        "description": "Show the balance sheet"
    },

    r"(?:show|list|get)\s+(?:all\s+)?users?": {
        "sql": """SELECT user_id, username, full_name, email, kyc_status, role, is_active 
                  FROM users LIMIT {max_rows}""",
        "description": "List all users"
    },

    r"(?:show|list|get)\s+(?:all\s+)?audit\s+logs?": {
        "sql": """SELECT log_id, entity_type, entity_id, action_type, created_at 
                  FROM system_audit_logs 
                  ORDER BY created_at DESC LIMIT {max_rows}""",
        "description": "Show recent audit logs"
    },

    r"(?:how many|count)\s+(?:total\s+)?transactions?": {
        "sql": """SELECT COUNT(*) AS total_transactions, 
                         SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
                         SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
                         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending
                  FROM transactions""",
        "description": "Count all transactions by status"
    },

    r"(?:total|sum)\s+(?:money|amount|volume)\s+(?:transferred|moved)": {
        "sql": """SELECT SUM(ABS(amount)) AS total_volume, COUNT(*) AS total_entries
                  FROM transaction_entries 
                  WHERE amount < 0""",
        "description": "Total money transferred in the system"
    },
}


class QueryEngine:
    def __init__(self):
        self.use_llm = bool(OPENAI_API_KEY)
        if self.use_llm:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=OPENAI_API_KEY)
                print("[LedgerGPT] Mode: OpenAI GPT (LLM)")
            except ImportError:
                print("[LedgerGPT] OpenAI package not installed. Falling back to templates.")
                self.use_llm = False
        else:
            print("[LedgerGPT] Mode: Template Matching (No API key set)")

    def natural_language_to_sql(self, question: str) -> dict:
        """
        Convert a natural language question to a SQL query.
        
        Returns:
            dict with 'sql', 'method' ('llm' or 'template'), 'description'
        """
        # Try LLM first if available
        if self.use_llm:
            result = self._llm_generate(question)
            if result:
                return result

        # Fallback to template matching
        result = self._template_match(question)
        if result:
            return result

        return {
            "sql": None,
            "method": "none",
            "description": "Could not understand the question. Try rephrasing or use one of the example queries."
        }

    def _llm_generate(self, question: str) -> dict:
        """Use OpenAI GPT to generate SQL from natural language."""
        try:
            response = self.client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": SCHEMA_CONTEXT},
                    {"role": "user", "content": question}
                ],
                temperature=0.1,  # Low temperature for deterministic SQL
                max_tokens=500
            )
            sql = response.choices[0].message.content.strip()

            # Clean up markdown code blocks if LLM wraps it
            sql = re.sub(r'^```(?:sql)?\s*', '', sql)
            sql = re.sub(r'\s*```$', '', sql)

            # Check for CANNOT_ANSWER
            if "CANNOT_ANSWER" in sql:
                return {
                    "sql": None,
                    "method": "llm",
                    "description": sql.replace("-- CANNOT_ANSWER:", "").strip()
                }

            return {
                "sql": sql,
                "method": "llm",
                "description": f"AI-generated query for: {question}"
            }
        except Exception as e:
            print(f"[LedgerGPT] LLM Error: {e}")
            return None

    def _template_match(self, question: str) -> dict:
        """Match the question against predefined SQL templates."""
        question_lower = question.lower().strip()

        for pattern, template in QUERY_TEMPLATES.items():
            match = re.search(pattern, question_lower)
            if match:
                groups = match.groups()
                sql = template["sql"].format(*groups, max_rows=MAX_ROWS)
                return {
                    "sql": sql,
                    "method": "template",
                    "description": template["description"]
                }
        return None

    def validate_sql(self, sql: str) -> tuple:
        """
        Safety check: ensure the query is READ-ONLY.
        Returns (is_safe, reason)
        """
        if not sql:
            return False, "Empty query"

        sql_upper = sql.upper().strip()

        for keyword in BLOCKED_KEYWORDS:
            # Check if keyword appears as a standalone word (not inside a string)
            if re.search(rf'\b{keyword}\b', sql_upper):
                return False, f"BLOCKED: Query contains forbidden keyword '{keyword}'"

        if not sql_upper.startswith("SELECT"):
            return False, "BLOCKED: Only SELECT queries are allowed"

        return True, "Query is safe"

    def execute_sql(self, sql: str) -> dict:
        """Execute a validated SQL query and return results."""
        is_safe, reason = self.validate_sql(sql)
        if not is_safe:
            return {"error": reason, "rows": [], "columns": []}

        try:
            conn = mysql.connector.connect(**DB_CONFIG)
            cursor = conn.cursor()
            cursor.execute(sql)

            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchall()

            cursor.close()
            conn.close()

            return {
                "error": None,
                "columns": columns,
                "rows": rows,
                "row_count": len(rows)
            }
        except mysql.connector.Error as e:
            return {"error": f"MySQL Error: {e}", "rows": [], "columns": []}
