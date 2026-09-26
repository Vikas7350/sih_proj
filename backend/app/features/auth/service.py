from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from app.core.database import get_db
from app.core.security import hash_password, verify_and_update_password, create_access_token
from app.core.logging import logger
from app.utils.mongo_utils import strip_id
from .schemas import OtpPurpose, UserCreate, CompleteProfileBody, EMAIL_RE
from . import otp as otp_service


def _user_public(doc: dict) -> dict:
    user_id = doc["_id"]
    d = strip_id(dict(doc))
    phc_id = str(d["phc_id"]) if d.get("phc_id") else None
    return {
        "id": str(user_id),
        "name": d.get("name", ""),
        "email": d["email"],
        "provider": d.get("provider", "credentials"),
        "role": d.get("role", "phc_staff"),
        "phc_id": phc_id,
        "is_verified": d.get("is_verified", False),
        "needs_profile": bool(d.get("needs_profile", False)) or (phc_id is None),
        "created_at": d.get("created_at"),
    }


def _to_claims(doc: dict) -> dict:
    phc_id = str(doc["phc_id"]) if doc.get("phc_id") else None
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "name": doc.get("name", ""),
        "role": doc.get("role", "phc_staff"),
        "phcId": phc_id,
        "phc_id": phc_id,
        "provider": doc.get("provider", "credentials"),
        "needs_profile": bool(doc.get("needs_profile", False)) or (phc_id is None),
    }


def register(data: UserCreate) -> dict:
    db = get_db()
    email = data.email

    existing = db.users.find_one({"email": email})
    if existing and existing.get("is_verified"):
        raise HTTPException(400, "A user with this email address already exists.")

    facility_id = data.facility_id or data.phc_code
    if not facility_id:
        raise HTTPException(400, "Please select a registered PHC facility.")

    from app.features.phc.service import get_registry_facility
    facility = get_registry_facility(facility_id)
    if not facility:
        raise HTTPException(400, f"Facility ID '{facility_id}' is invalid or not registered in the Demo PHC Registry.")

    if str(facility.get("status", "")).upper() != "ACTIVE":
        raise HTTPException(400, f"Facility '{facility.get('name')}' is currently INACTIVE. Registration is disabled.")

    verified_code = (facility.get("facility_id") or facility.get("code")).strip().upper()
    verified_name = facility.get("name")
    verified_state = facility.get("state")
    verified_district = facility.get("district")
    verified_address = facility.get("address")

    # Look up or insert official verified PHC record
    phc = db.phcs.find_one({"$or": [{"facility_id": verified_code}, {"code": verified_code}]})
    if not phc:
        res = db.phcs.insert_one({
            "facility_id": verified_code,
            "code": verified_code,
            "name": verified_name,
            "state": verified_state,
            "district": verified_district,
            "address": verified_address,
            "contact_number": data.contact_number,
            "healthcare_worker_name": data.name,
            "status": "ACTIVE",
            "demo": facility.get("demo", True),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        phc = {"_id": res.inserted_id}
    else:
        # Ensure official fields are updated
        db.phcs.update_one({"_id": phc["_id"]}, {"$set": {
            "name": verified_name,
            "facility_id": verified_code,
            "state": verified_state,
            "district": verified_district,
            "address": verified_address,
            "contact_number": data.contact_number,
            "healthcare_worker_name": data.name,
        }})

    if existing and not existing.get("is_verified"):
        db.users.update_one({"_id": existing["_id"]}, {"$set": {
            "name": data.name,
            "password_hash": hash_password(data.password),
            "phc_id": phc["_id"],
        }})
        user_id = existing["_id"]
    else:
        res = db.users.insert_one({
            "name": data.name,
            "email": email,
            "password_hash": hash_password(data.password),
            "provider": "credentials",
            "role": "phc_staff",
            "phc_id": phc["_id"],
            "is_verified": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        user_id = res.inserted_id

    otp_service.create_and_send_otp(email, OtpPurpose.register)
    return {"id": str(user_id), "email": email, "phc_id": str(phc["_id"])}


def verify_otp(email: str, otp: str, purpose: OtpPurpose):
    db = get_db()
    email = email.lower().strip()
    if not otp_service.verify_otp(email, otp, purpose):
        raise HTTPException(400, "Invalid, expired, or too many failed verification attempts.")

    if purpose in (OtpPurpose.register, OtpPurpose.email_verification):
        user = db.users.find_one({"email": email})
        if not user:
            raise HTTPException(404, "User account not found")
        db.users.update_one({"_id": user["_id"]}, {"$set": {"is_verified": True}})
        return "Email verified successfully! You can now log in."
    return "OTP verified successfully. Proceed to reset password."


def resend_otp(email: str, purpose: OtpPurpose) -> str:
    db = get_db()
    email = email.lower().strip()
    user = db.users.find_one({"email": email})

    if not user and purpose not in (OtpPurpose.reset_password, OtpPurpose.password_reset):
        raise HTTPException(404, "No user found with this email address")
    if not user and purpose in (OtpPurpose.reset_password, OtpPurpose.password_reset):
        return "If an account exists with this email, a new verification code has been sent."

    if purpose in (OtpPurpose.register, OtpPurpose.email_verification) and user.get("is_verified"):
        raise HTTPException(400, "This email is already verified. You can log in.")

    recent = db.otps.find_one({"email": email, "purpose": purpose.value})
    if recent and recent.get("last_sent_at"):
        elapsed = (datetime.now(timezone.utc) - recent["last_sent_at"]).total_seconds()
        if elapsed < otp_service.RESEND_COOLDOWN_SECONDS:
            remaining = int(otp_service.RESEND_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(429, f"Please wait {remaining} seconds before requesting another code.")

    otp_service.create_and_send_otp(email, purpose)
    return "A new 6-digit verification code has been sent to your email."


def login(email: str, password: str) -> dict:
    db = get_db()
    user = db.users.find_one({"email": email.lower().strip()})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid email or password")
    ok, new_hash = verify_and_update_password(password, user.get("password_hash", ""))
    if not ok:
        raise HTTPException(401, "Invalid email or password")
    if new_hash:
        # Transparently rehash (rounds 12 -> 10) so slow logins on existing
        # accounts speed up after their first successful sign-in.
        db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": new_hash}})
    if not user.get("is_verified"):
        raise HTTPException(403, "Please verify your email address before logging in.")
    return {
        "access_token": create_access_token(_to_claims(user)),
        "token_type": "bearer",
        "user": _user_public(user),
    }


def google_login(google_id: str, email: str, name: str) -> dict:
    db = get_db()
    email = (email or "").strip().lower()
    google_id = (google_id or "").strip()

    if not email or not EMAIL_RE.match(email):
        logger.warning(f"google_login rejected: missing/invalid email (google_id={google_id!r})")
        raise HTTPException(400, "Google account email is missing or invalid. Try again or use email registration.")

    # Resolve by Google's verified account id first so each actual Google account
    # maps to its own record; fall back to email for accounts created before the
    # google_id field existed.
    user = db.users.find_one({"provider": "google", "google_id": google_id})
    if user is None:
        logger.info(f"google_login: no doc for sub {google_id!r}; matching by email {email}")
        user = db.users.find_one({"email": email})

    if user:
        phc_id = user.get("phc_id")
        needs_profile = True if not phc_id else bool(user.get("needs_profile", False))
        fields = {
            "name": name or user.get("name", ""),
            "is_verified": True,
            "google_id": google_id,
            "needs_profile": needs_profile,
        }
        if user.get("provider") != "google":
            fields["provider"] = "google"
        db.users.update_one({"_id": user["_id"]}, {"$set": fields})
        user.update(fields)
        is_new = False
    else:
        res = db.users.insert_one({
            "name": name or "Google User",
            "email": email,
            "password_hash": "",
            "provider": "google",
            "role": "phc_staff",
            "phc_id": None,
            "is_verified": True,
            "needs_profile": True,
            "google_id": google_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        user = {"_id": res.inserted_id, "email": email, "name": name or "Google User",
                "provider": "google", "role": "phc_staff", "phc_id": None, "is_verified": True,
                "needs_profile": True}
        is_new = True

    logger.info(f"google_login ok: sub={google_id} email={email} user_id={user['_id']} is_new={is_new}")
    return {
        "access_token": create_access_token(_to_claims(user)),
        "token_type": "bearer",
        "user": _user_public(user),
        "is_new": is_new,
    }


def complete_profile(user_claims: dict, data: CompleteProfileBody) -> dict:
    """Finish onboarding for a user created via Google OAuth (no PHC yet).

    Creates-or-links their PHC and marks the profile complete. Returns a fresh
    token so the new phc_id/needs_profile claims take effect immediately.
    """
    db = get_db()
    doc = db.users.find_one({"_id": ObjectId(user_claims["id"])})
    if not doc:
        raise HTTPException(404, "User account not found")
    if doc.get("provider") != "google":
        raise HTTPException(400, "Profile completion is only for Google sign-in users.")

    phc = db.phcs.find_one({"code": data.phc_code})
    if not phc:
        res = db.phcs.insert_one({
            "name": data.phc_name,
            "code": data.phc_code,
            "state": data.state,
            "district": data.district,
            "address": data.address,
            "contact_number": data.contact_number,
            "healthcare_worker_name": data.name or doc.get("name", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        phc = {"_id": res.inserted_id}

    fields = {"phc_id": phc["_id"], "needs_profile": False, "name": data.name or doc.get("name", "")}
    db.users.update_one({"_id": doc["_id"]}, {"$set": fields})
    doc.update(fields)
    return {
        "access_token": create_access_token(_to_claims(doc)),
        "token_type": "bearer",
        "user": _user_public(doc),
    }


def forgot_password(email: str) -> str:
    db = get_db()
    email = email.lower().strip()
    generic = "If an account exists with this email address, a 6-digit password reset code has been sent."
    user = db.users.find_one({"email": email})
    if not user or user.get("provider") == "google" or not user.get("password_hash"):
        return generic
    otp_service.create_and_send_otp(email, OtpPurpose.reset_password)
    return generic


def reset_password(email: str, otp: str, password: str) -> str:
    db = get_db()
    email = email.lower().strip()
    if not otp_service.verify_otp(email, otp, OtpPurpose.reset_password):
        raise HTTPException(400, "Invalid, expired, or too many failed reset attempts.")
    user = db.users.find_one({"email": email})
    if not user:
        raise HTTPException(404, "User account not found")
    db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(password)}})
    db.otps.delete_many({"email": email, "purpose": OtpPurpose.reset_password.value})
    return "Password updated successfully! You can now log in with your new password."