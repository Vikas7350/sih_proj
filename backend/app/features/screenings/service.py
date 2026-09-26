from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple
from app.core.database import get_db
from app.utils.mongo_utils import strip_id


def _generate_screening_id() -> str:
    db = get_db()
    while True:
        counter = db.counters.find_one_and_update(
            {"_id": "screening_id"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True,
        )
        sid = f"SCR-{counter['seq']:04d}"
        if not db.screenings.find_one({"screening_id": sid}):
            return sid


from bson import ObjectId


def create_screening(patient_id: str, eye: str, phc_id: Optional[str] = None) -> Dict:
    db = get_db()
    screening_id = _generate_screening_id()
    screening = {
        "screening_id": screening_id,
        "patient_id": patient_id,
        "eye": eye,
        "status": "created",
        "image_path": None,
        "image_url": None,
        "image_quality": None,
        "prediction": None,
        "explanation": None,
        "risk": None,
        "phc_id": str(phc_id) if phc_id else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.screenings.insert_one(screening)
    return screening


def get_screening(screening_id: str) -> Optional[Dict]:
    db = get_db()
    screening = db.screenings.find_one({"screening_id": screening_id})
    return strip_id(screening) if screening else None


def update_screening(screening_id: str, update_data: Dict) -> None:
    db = get_db()
    db.screenings.update_one({"screening_id": screening_id}, {"$set": update_data})


def list_screenings(
    patient_id: Optional[str] = None,
    risk: Optional[str] = None,
    grade: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    phc_id: Optional[str] = None,
) -> Tuple[List[Dict], int]:
    db = get_db()
    if not phc_id:
        return [], 0
    query = {"phc_id": str(phc_id)}
    if patient_id:
        query["patient_id"] = patient_id
    if grade is not None:
        query["prediction.grade"] = grade
    if risk:
        query["risk.level"] = risk
    if date_from:
        query.setdefault("created_at", {})["$gte"] = date_from
    if date_to:
        query.setdefault("created_at", {})["$lte"] = date_to
    from app.utils.mongo_utils import strip_id
    total = db.screenings.count_documents(query)
    skip = (page - 1) * limit
    items = [strip_id(doc) for doc in db.screenings.find(query).skip(skip).limit(limit).sort("created_at", -1)]
    return items, total


def get_patients_batch(patient_ids: List[str]) -> Dict[str, Dict]:
    """Fetch multiple patients in one query — avoids N+1 in list enrichment."""
    if not patient_ids:
        return {}
    db = get_db()
    unique_ids = list(set(patient_ids))
    docs = db.patients.find({"patient_id": {"$in": unique_ids}}, {"_id": 0})
    return {doc["patient_id"]: doc for doc in docs}