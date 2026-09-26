from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from .service import get_report_summary

router = APIRouter()


@router.get("/summary")
def reports_summary_endpoint(user: dict = Depends(get_current_user)):
    phc_id = user.get("phc_id") or user.get("phcId")
    return get_report_summary(phc_id=phc_id)