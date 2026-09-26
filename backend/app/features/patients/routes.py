from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from .schemas import PatientCreate, PatientResponse
from .service import create_patient, get_patient, list_patients, get_patient_screenings
from app.core.auth import get_current_user

router = APIRouter()


@router.post("", response_model=PatientResponse, status_code=201)
def create_patient_endpoint(data: PatientCreate, user: dict = Depends(get_current_user)):
    phc_id = user.get("phc_id") or user.get("phcId")
    patient = create_patient(data.model_dump(), phc_id=phc_id)
    return patient


@router.get("")
def list_patients_endpoint(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    phc_id = user.get("phc_id") or user.get("phcId")
    items, total = list_patients(search=search, page=page, limit=limit, phc_id=phc_id)
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, -(-total // limit)),
    }


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient_endpoint(patient_id: str):
    patient = get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail={"code": "PATIENT_NOT_FOUND", "message": "Patient not found"})
    return patient


@router.get("/{patient_id}/screenings")
def get_patient_screenings_endpoint(patient_id: str):
    patient = get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail={"code": "PATIENT_NOT_FOUND", "message": "Patient not found"})
    return get_patient_screenings(patient_id)