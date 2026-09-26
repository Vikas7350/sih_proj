import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple
from app.core.database import get_db


def _generate_patient_id() -> str:
    db = get_db()
    while True:
        counter = db.counters.find_one_and_update(
            {"_id": "patient_id"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True,
        )
        pid = f"P-{counter['seq']:04d}"
        if not db.patients.find_one({"patient_id": pid}):
            return pid


from bson import ObjectId


from app.utils.mongo_utils import strip_id


def create_patient(data: Dict, phc_id: Optional[str] = None) -> Dict:
    db = get_db()
    patient_id = _generate_patient_id()
    patient = {
        "patient_id": patient_id,
        "name": data["name"],
        "age": data["age"],
        "gender": data["gender"],
        "diabetes_duration_years": data.get("diabetes_duration_years"),
        "contact_number": data.get("contact_number"),
        "phc_id": str(phc_id) if phc_id else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.patients.insert_one(patient)
    return strip_id(dict(patient))


def get_patient(patient_id: str) -> Optional[Dict]:
    db = get_db()
    patient = db.patients.find_one({"patient_id": patient_id})
    return strip_id(patient) if patient else None


def list_patients(search: Optional[str] = None, page: int = 1, limit: int = 20, phc_id: Optional[str] = None) -> Tuple[List[Dict], int]:
    db = get_db()
    if not phc_id:
        return [], 0
    query = {"phc_id": str(phc_id)}
    if search:
        query["name"] = {"$regex": re.escape(search), "$options": "i"}
    total = db.patients.count_documents(query)
    skip = (page - 1) * limit
    items = [strip_id(doc) for doc in db.patients.find(query).skip(skip).limit(limit)]
    return items, total


def get_patient_screenings(patient_id: str) -> List[Dict]:
    db = get_db()
    return list(db.screenings.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1))