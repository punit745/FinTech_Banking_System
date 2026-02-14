"""
LedgerGPT Interactive CLI
==========================
A terminal-based chatbot that lets auditors query the banking database
using natural language instead of writing SQL.

Usage:
    python app.py

Example Questions:
    > Show all transactions for alice
    > Find transfers over $500
    > Show flagged transactions
    > Check ledger integrity
    > What is the balance for bob
"""

import sys
from tabulate import tabulate
from colorama import init, Fore, Style
from query_engine import QueryEngine

init(autoreset=True)  # Enable colorama

BANNER = f"""
{Fore.CYAN}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   {Fore.WHITE}LedgerGPT 🧠  {Fore.CYAN}— Natural Language Banking Auditor          ║
║   {Fore.LIGHTBLACK_EX}Ask questions in plain English. I'll query the database.{Fore.CYAN}   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝{Style.RESET_ALL}

{Fore.YELLOW}Example questions:{Style.RESET_ALL}
  • Show all accounts for alice
  • List recent transactions
  • Find transfers over $500
  • Show flagged transactions
  • Check ledger integrity
  • How many total transactions?
  • Show balance sheet
  • Show risk scores

{Fore.LIGHTBLACK_EX}Type 'quit' or 'exit' to leave.{Style.RESET_ALL}
{Fore.LIGHTBLACK_EX}Type 'help' for more examples.{Style.RESET_ALL}
"""

HELP_TEXT = f"""
{Fore.YELLOW}═══ Supported Questions ═══{Style.RESET_ALL}

{Fore.GREEN}Accounts:{Style.RESET_ALL}
  • Show accounts for [username]
  • What is the balance for [username]
  • List all users

{Fore.GREEN}Transactions:{Style.RESET_ALL}
  • Show transactions for [username]
  • List recent transactions
  • Find transfers over $[amount]
  • How many total transactions?
  • Total money transferred

{Fore.GREEN}AI Risk Scores:{Style.RESET_ALL}
  • Show flagged transactions
  • Show risk scores
  • List suspicious transactions

{Fore.GREEN}System Health:{Style.RESET_ALL}
  • Check ledger integrity
  • Show balance sheet
  • Show audit logs

{Fore.LIGHTBLACK_EX}Tip: If you have an OpenAI API key set, you can ask ANY question!{Style.RESET_ALL}
"""


def print_results(result: dict, query_info: dict):
    """Pretty print query results in a table format."""
    
    # Print the method used
    method_color = Fore.GREEN if query_info["method"] == "llm" else Fore.YELLOW
    print(f"\n{method_color}[{query_info['method'].upper()}]{Style.RESET_ALL} {query_info['description']}")
    
    # Print the generated SQL
    print(f"{Fore.LIGHTBLACK_EX}SQL: {query_info['sql']}{Style.RESET_ALL}\n")

    if result.get("error"):
        print(f"{Fore.RED}❌ Error: {result['error']}{Style.RESET_ALL}")
        return

    if not result["rows"]:
        print(f"{Fore.YELLOW}📭 No results found.{Style.RESET_ALL}")
        return

    # Format and print table
    table = tabulate(result["rows"], headers=result["columns"], tablefmt="rounded_grid", 
                     floatfmt=".4f", numalign="right")
    print(table)
    print(f"\n{Fore.LIGHTBLACK_EX}({result['row_count']} rows){Style.RESET_ALL}")


def main():
    print(BANNER)

    engine = QueryEngine()
    print(f"\n{Fore.GREEN}✓ Connected. Ready for queries.{Style.RESET_ALL}\n")
    print("─" * 60)

    while True:
        try:
            question = input(f"\n{Fore.CYAN}ledger>{Style.RESET_ALL} ").strip()

            if not question:
                continue

            if question.lower() in ("quit", "exit", "q"):
                print(f"\n{Fore.LIGHTBLACK_EX}Goodbye! 👋{Style.RESET_ALL}")
                break

            if question.lower() == "help":
                print(HELP_TEXT)
                continue

            # Convert to SQL
            query_info = engine.natural_language_to_sql(question)

            if not query_info["sql"]:
                print(f"\n{Fore.YELLOW}🤔 {query_info['description']}{Style.RESET_ALL}")
                continue

            # Validate safety
            is_safe, reason = engine.validate_sql(query_info["sql"])
            if not is_safe:
                print(f"\n{Fore.RED}🛑 {reason}{Style.RESET_ALL}")
                continue

            # Execute and display results
            result = engine.execute_sql(query_info["sql"])
            print_results(result, query_info)

        except KeyboardInterrupt:
            print(f"\n\n{Fore.LIGHTBLACK_EX}Goodbye! 👋{Style.RESET_ALL}")
            break
        except Exception as e:
            print(f"\n{Fore.RED}Error: {e}{Style.RESET_ALL}")


if __name__ == "__main__":
    main()
