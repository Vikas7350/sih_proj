from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from .schemas import PHCProfileUpdate
from .service import get_profile, update_profile, list_phc_registry

router = APIRouter()


@router.get("/registry")
def get_phc_registry():
    """Public endpoint: Return registered DEMO facilities for onboarding/registration."""
    return list_phc_registry()


@router.get("/profile")
def get_phc_profile(user: dict = Depends(get_current_user)):
    phc_id = user.get("phc_id") or user.get("phcId")
    return get_profile(phc_id)


@router.put("/profile")
def update_phc_profile(data: PHCProfileUpdate, user: dict = Depends(get_current_user)):
    phc_id = user.get("phc_id") or user.get("phcId")
    return update_profile(phc_id, data)