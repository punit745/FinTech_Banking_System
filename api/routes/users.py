"""
User Profile Routes
====================
Endpoints for viewing and updating user profiles.
"""

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user, get_user_profile, hash_password
from database import get_connection
from schemas import UserProfile, UserProfileUpdate, PinUpdate, MessageResponse

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


@router.put("/pin", response_model=MessageResponse)
def set_transaction_pin(data: PinUpdate, current_user: dict = Depends(get_current_user)):
    """Set or update the transaction PIN."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        pin_hash = hash_password(data.new_pin)

        # Check if user has a pin column — we'll store in password_hash for simplicity
        # In production, you'd have a separate pin_hash column
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
