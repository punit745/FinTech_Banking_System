"""
User Profile Routes
====================
Endpoints for viewing and updating user profiles, changing passwords, and managing PINs.
"""

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user, get_user_profile, hash_password, verify_password
from database import get_connection
from schemas import UserProfile, UserProfileUpdate, PinUpdate, PasswordChange, MessageResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/profile", response_model=UserProfile)
def get_profile(current_user: dict = Depends(get_current_user)):
    """Get the logged-in user's full profile."""
    return get_user_profile(current_user["user_id"])


@router.put("/profile", response_model=MessageResponse)
def update_profile(data: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update user profile fields (name, email, phone)."""
    conn = get_connection()
    try:
        cursor = conn.cursor()

        updates = []
        values = []
        if data.full_name:
            updates.append("full_name = %s")
            values.append(data.full_name)
        if data.email:
            updates.append("email = %s")
            values.append(data.email)
        if data.phone_number is not None:
            updates.append("phone_number = %s")
            values.append(data.phone_number)

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        values.append(current_user["user_id"])
        query = f"UPDATE users SET {', '.join(updates)} WHERE user_id = %s"
        cursor.execute(query, tuple(values))
        conn.commit()
        cursor.close()

        return MessageResponse(message="Profile updated successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn.is_connected():
            conn.close()


@router.put("/password", response_model=MessageResponse)
def change_password(data: PasswordChange, current_user: dict = Depends(get_current_user)):
    """Change the user's password. Requires old password for verification."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        # Get current password hash
        cursor.execute(
            "SELECT password_hash FROM users WHERE user_id = %s",
            (current_user["user_id"],),
        )
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Verify old password
        if not verify_password(data.old_password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        # Hash and set new password
        new_hash = hash_password(data.new_password)
        cursor.execute(
            "UPDATE users SET password_hash = %s, updated_at = NOW() WHERE user_id = %s",
            (new_hash, current_user["user_id"]),
        )
        conn.commit()
        cursor.close()

        return MessageResponse(message="Password changed successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn.is_connected():
            conn.close()


@router.put("/pin", response_model=MessageResponse)
def set_transaction_pin(data: PinUpdate, current_user: dict = Depends(get_current_user)):
    """Set or update the transaction PIN."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        pin_hash = hash_password(data.new_pin)

        cursor.execute(
            "UPDATE users SET updated_at = NOW() WHERE user_id = %s",
            (current_user["user_id"],),
        )
        conn.commit()
        cursor.close()

        return MessageResponse(message="Transaction PIN updated successfully")
    finally:
        if conn.is_connected():
            conn.close()
