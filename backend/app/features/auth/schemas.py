import re
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class User(BaseModel):
    email: str
    password_hash: str
    provider: str = "credentials"
    role: str = "phc_staff"
    phc_id: Optional[str] = None
    is_verified: bool = False
    needs_profile: bool = False
    created_at: datetime


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    email: str
    password: str = Field(min_length=8, max_length=100)
    facility_id: Optional[str] = None
    phc_name: Optional[str] = None
    phc_code: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    contact_number: str = Field(min_length=8)

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        if not EMAIL_RE.match(v):
            raise ValueError("Please enter a valid email address")
        return v.lower().strip()

    @field_validator("phc_code")
    @classmethod
    def _upper_code(cls, v: Optional[str]) -> Optional[str]:
        return v.upper().strip() if v else v


class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    provider: str
    role: str
    phc_id: Optional[str] = None
    is_verified: bool
    needs_profile: bool = False
    created_at: datetime


class CompleteProfileBody(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=50)
    phc_name: str = Field(min_length=2, max_length=100)
    phc_code: str = Field(min_length=2, max_length=30)
    state: str = Field(min_length=2)
    district: str = Field(min_length=2)
    address: str = Field(min_length=5)
    contact_number: str = Field(min_length=8)

    @field_validator("phc_code")
    @classmethod
    def _upper_code(cls, v: str) -> str:
        return v.upper().strip()


class OtpPurpose(str, Enum):
    register = "register"
    reset_password = "reset_password"
    email_verification = "email_verification"
    password_reset = "password_reset"


class OtpRecord(BaseModel):
    email: str
    otp_hash: str
    purpose: OtpPurpose
    expires_at: datetime
    attempts: int = 0