
import requests
import random
import string

API_URL = "http://localhost:8000"

def random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase, k=length))

def login(username, password, is_employee=False):
    url = f"{API_URL}/auth/employee/login" if is_employee else f"{API_URL}/auth/login"
    data = {"employee_id": username, "password": password} if is_employee else {"username": username, "password": password}
    response = requests.post(url, json=data)
    if response.status_code == 200:
        return response.json()
    return None

def register_user(username, password):
    data = {
        "username": username,
        "password": password,
        "email": f"{username}@example.com",
        "full_name": f"Test User {username}",
        "date_of_birth": "1990-01-01",
        "phone_number": ''.join(random.choices(string.digits, k=10))
    }
    response = requests.post(f"{API_URL}/auth/register", json=data)
    if response.status_code == 200:
        return response.json()
    print(f"Registration failed: {response.text}")
    return None

def admin_verify_kyc(token, user_id):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.patch(f"{API_URL}/admin/users/{user_id}/kyc?status=verified", headers=headers)
    return response.status_code == 200

def admin_create_account(token, user_id):
    headers = {"Authorization": f"Bearer {token}"}
    data = {"user_id": user_id, "account_type": "savings", "currency": "USD"}
    response = requests.post(f"{API_URL}/admin/accounts/create", json=data, headers=headers)
    return response.json() if response.status_code == 200 else None

def secure_deposit(token, account_id, amount, password):
    headers = {"Authorization": f"Bearer {token}"}
    data = {"account_id": account_id, "amount": amount, "description": "Test Deposit", "password": password}
    response = requests.post(f"{API_URL}/transactions/deposit", json=data, headers=headers)
    return response

def secure_withdraw(token, account_id, amount, password):
    headers = {"Authorization": f"Bearer {token}"}
    data = {"account_id": account_id, "amount": amount, "description": "Test Withdraw", "password": password}
    response = requests.post(f"{API_URL}/transactions/withdraw", json=data, headers=headers)
    return response

def secure_balance(token, account_id, password):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{API_URL}/accounts/balance", json={"account_id": account_id, "password": password}, headers=headers)
    return response

def run_test():
    print("--- Starting End-to-End Verification ---")
    
    # 1. Login as Admin
    print("Logging in as Admin...")
    admin = login("EMP001", "password123", is_employee=True)
    if not admin:
        print("Admin login failed.")
        return
    admin_token = admin["access_token"]
    print("Admin logged in.")

    # 2. Register New User
    username = f"user_{random_string()}"
    password = "password123"
    print(f"Registering user {username}...")
    user_reg = register_user(username, password)
    if not user_reg:
        print("Registration failed.")
        return
    user_id = user_reg["data"]["user_id"]
    print(f"User registered with ID {user_id}")

    # 3. Verify KYC (Admin)
    print("Verifying KYC...")
    if not admin_verify_kyc(admin_token, user_id):
        print("KYC verification failed.")
        return
    print("KYC Verified.")

    # 4. Create Account (Admin)
    print("Creating Account...")
    account_data = admin_create_account(admin_token, user_id)
    if not account_data:
        print("Account creation failed.")
        return
    account_id = account_data["data"]["account_id"]
    print(f"Account created with ID {account_id}")

    # 5. Login as User
    print("Logging in as User...")
    user = login(username, password)
    if not user:
        print("User login failed.")
        return
    user_token = user["access_token"]
    print("User logged in.")

    # 6. Verify Initial Balance (Secure Check)
    print("Checking Balance (Secure)...")
    res = secure_balance(user_token, account_id, password)
    if res.status_code == 200:
        bal = res.json()['current_balance']
        print(f"Balance Check Success: {bal}")
        if bal != 0: print("WARNING: Initial balance not 0")
    else:
        print(f"Balance Check Failed: {res.text}")

    # 7. Deposit (Secure)
    print("Depositing 100 (Secure)...")
    res = secure_deposit(user_token, account_id, 100, password)
    if res.status_code == 200:
        print("Deposit Success.")
    else:
        print(f"Deposit Failed: {res.text}")

    # 8. Withdraw (Secure)
    print("Withdrawing 50 (Secure)...")
    res = secure_withdraw(user_token, account_id, 50, password)
    if res.status_code == 200:
        print("Withdraw Success.")
    else:
        print(f"Withdraw Failed: {res.text}")

    # 9. Verify Final Balance
    res = secure_balance(user_token, account_id, password)
    if res.status_code == 200 and res.json()['current_balance'] == 50.0:
        print("Final Balance Verified: 50.0")
    else:
        print(f"Final Balance Verification Failed. Got {res.json().get('current_balance') if res.status_code==200 else res.text}")
    
    # 10. Verify Wrong Password Cleanly
    res = secure_balance(user_token, account_id, "wrongpass")
    if res.status_code == 401:
        print("Wrong Password Check: Success (401)")
    else:
        print(f"Wrong Password Check: Failed (Expected 401, got {res.status_code})")

if __name__ == "__main__":
    run_test()
