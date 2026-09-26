from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class Phc(BaseModel):
    name: str
    code: str
    state: str
    district: str
    address: str
    contact_number: str
    healthcare_worker_name: Optional[str] = ""
    created_at: datetime


class PhcCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    code: str = Field(min_length=2, max_length=30)
    state: str = Field(min_length=2)
    district: str = Field(min_length=2)
    address: str = Field(min_length=5)
    contact_number: str = Field(min_length=8)
    healthcare_worker_name: str = ""

    @field_validator("code")
    @classmethod
    def _upper_code(cls, v: str) -> str:
        return v.upper().strip()


class PHCProfileUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    contactNumber: Optional[str] = None
    healthcareWorkerName: Optional[str] = None