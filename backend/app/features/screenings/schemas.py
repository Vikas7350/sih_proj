from typing import Optional, Dict, List, Any
from pydantic import BaseModel


class ScreeningCreate(BaseModel):
    patient_id: str
    eye: str


class ScreeningResponse(BaseModel):
    screening_id: str
    patient_id: str
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    diabetes_duration_years: Optional[int] = None
    eye: str
    status: str
    image_url: Optional[str] = None
    image_quality: Optional[Any] = None
    prediction: Optional[Any] = None
    explanation: Optional[Any] = None
    risk: Optional[Any] = None
    stage: Optional[str] = None
    action: Optional[str] = None
    decision: Optional[str] = None
    fundus: Optional[Any] = None
    quality: Optional[Any] = None
    enhancement: Optional[Any] = None
    evidence: Optional[Any] = None
    reasons: Optional[List[Any]] = None
    matlab_result: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None
