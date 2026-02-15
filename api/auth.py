"""
FastAPI Banking Application — Authentication Module
=====================================================
Handles user registration, login, JWT tokens, and role-based access.
"""

import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from functools import wraps

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS
from database import get_connection

security = HTTPBearer()


# ── Password Hashing ──────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT Token Management ──────────────────────────────────

def create_access_token(user_id: int, username: str, role: str) -> str:
    """Create a JWT access token."""
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


# ── FastAPI Dependencies ──────────────────────────────────

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    FastAPI dependency: Extract and validate the current user from the JWT.
    Returns dict with user_id, username, role.
    """
    payload = decode_token(credentials.credentials)
    return {
        "user_id": payload["sub"],
        "username": payload["username"],
        "role": payload["role"],
    }


def require_role(*roles):
    """
    Factory for role-based access control.
    Usage: Depends(require_role("admin", "auditor"))
    """
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(roles)}",
            )
        return current_user
    return role_checker


# ── User Database Operations ──────────────────────────────

def register_user(username: str, password: str, email: str, full_name: str,
                  date_of_birth: str, phone_number: str = None) -> dict:
    """Register a new user in the database."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        # Check if username or email already exists
        cursor.execute("SELECT user_id FROM users WHERE username = %s OR email = %s",
                       (username, email))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email already exists",
            )

        # Hash the password and insert
        pw_hash = hash_password(password)
        cursor.execute(
            """INSERT INTO users (username, password_hash, email, full_name, 
               date_of_birth, phone_number, kyc_status, role)
               VALUES (%s, %s, %s, %s, %s, %s, 'pending', 'customer')""",
            (username, pw_hash, email, full_name, date_of_birth, phone_number),
        )
        conn.commit()
        user_id = cursor.lastrowid
        cursor.close()

        return {
            "user_id": user_id,
            "username": username,
            "role": "customer",
        }
    finally:
        if conn.is_connected():
            conn.close()


def authenticate_user(username: str, password: str) -> dict:
    """Authenticate a user by username and password."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT user_id, username, password_hash, role, is_active FROM users WHERE username = %s",
            (username,),
        )
        user = cursor.fetchone()
        cursor.close()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )

        if not user["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )

        if not verify_password(password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )

        return {
            "user_id": user["user_id"],
            "username": user["username"],
            "role": user["role"],
        }
    finally:
        if conn.is_connected():
            conn.close()


def get_user_profile(user_id: int) -> dict:
    """Fetch full user profile from the database."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT user_id, username, email, full_name, phone_number,
                      date_of_birth, kyc_status, role, is_active, created_at
               FROM users WHERE user_id = %s""",
            (user_id,),
        )
        user = cursor.fetchone()
        cursor.close()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Convert datetime/date objects to strings for JSON
        if user.get("date_of_birth"):
            user["date_of_birth"] = str(user["date_of_birth"])
        if user.get("created_at"):
            user["created_at"] = str(user["created_at"])

        return user
    finally:
        if conn.is_connected():
            conn.close()
