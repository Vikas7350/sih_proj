from typing import Optional
from bson import ObjectId
from app.core.database import get_db


def get_report_summary(phc_id: Optional[str] = None) -> dict:
    if not phc_id:
        return {
            "total_patients": 0,
            "total_screenings": 0,
            "completed_screenings": 0,
            "quality_failed_screenings": 0,
            "grade_distribution": {str(g): 0 for g in range(5)},
            "risk_distribution": {l: 0 for l in ["low", "monitor", "high", "urgent", "recapture"]},
        }

    db = get_db()
    q = {"phc_id": str(phc_id)}

    total_patients = db.patients.count_documents(q)
    total_screenings = db.screenings.count_documents(q)

    comp_q = dict(q)
    comp_q["status"] = "completed"
    completed = db.screenings.count_documents(comp_q)

    qf_q = dict(q)
    qf_q["status"] = "quality_failed"
    quality_failed = db.screenings.count_documents(qf_q)

    grade_counts = {}
    for grade in range(5):
        g_q = dict(q)
        g_q["prediction.grade"] = grade
        grade_counts[str(grade)] = db.screenings.count_documents(g_q)

    risk_counts = {}
    for level in ["low", "monitor", "high", "urgent", "recapture"]:
        r_q = dict(q)
        r_q["risk.level"] = level
        risk_counts[level] = db.screenings.count_documents(r_q)

    return {
        "total_patients": total_patients,
        "total_screenings": total_screenings,
        "completed_screenings": completed,
        "quality_failed_screenings": quality_failed,
        "grade_distribution": grade_counts,
        "risk_distribution": risk_counts,
    }