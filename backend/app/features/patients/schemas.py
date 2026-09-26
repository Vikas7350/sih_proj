from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PatientCreate(BaseModel):
    name: str
    age: int
    gender: str
    diabetes_duration_years: Optional[int] = None
    contact_number: Optional[str] = None


class PatientResponse(BaseModel):
    patient_id: str
    name: str
    age: int
    gender: str
    diabetes_duration_years: Optional[int] = None
    contact_number: Optional[str] = None
    created_at: str