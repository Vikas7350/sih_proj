from fastapi import HTTPException

from app.core.database import get_db
from .schemas import PHCProfileUpdate

from typing import List, Dict, Optional

_PUBLIC_KEYS = (
    "name", "code", "state", "district", "address",
    "contact_number", "healthcare_worker_name", "facility_id", "status", "type", "demo"
)

DEMO_PHC_REGISTRY = [
    {
        "facility_id": "DEMO-PHC-PUNE-001",
        "code": "DEMO-PHC-PUNE-001",
        "name": "Alandi Primary Health Centre",
        "type": "Primary Health Centre",
        "state": "Maharashtra",
        "district": "Pune",
        "address": "Alandi, Pune, Maharashtra - 412105",
        "status": "ACTIVE",
        "demo": True,
    },
    {
        "facility_id": "DEMO-PHC-PUNE-002",
        "code": "DEMO-PHC-PUNE-002",
        "name": "Baramati Primary Health Centre",
        "type": "Primary Health Centre",
        "state": "Maharashtra",
        "district": "Pune",
        "address": "Baramati Rural, Pune, Maharashtra - 413102",
        "status": "ACTIVE",
        "demo": True,
    },
    {
        "facility_id": "DEMO-PHC-PUNE-003",
        "code": "DEMO-PHC-PUNE-003",
        "name": "Shirur Primary Health Centre",
        "type": "Primary Health Centre",
        "state": "Maharashtra",
        "district": "Pune",
        "address": "Shirur, Pune, Maharashtra - 412210",
        "status": "ACTIVE",
        "demo": True,
    },
    {
        "facility_id": "DEMO-PHC-NASHIK-001",
        "code": "DEMO-PHC-NASHIK-001",
        "name": "Nashik Rural Primary Health Centre",
        "type": "Primary Health Centre",
        "state": "Maharashtra",
        "district": "Nashik",
        "address": "Nashik Rural, Nashik, Maharashtra - 422003",
        "status": "ACTIVE",
        "demo": True,
    },
]


def seed_demo_registry(db=None):
    if db is None:
        db = get_db()
    for item in DEMO_PHC_REGISTRY:
        db.phc_registry.update_one(
            {"facility_id": item["facility_id"]},
            {"$set": item},
            upsert=True,
        )


def list_phc_registry() -> List[Dict]:
    db = get_db()
    seed_demo_registry(db)
    cursor = db.phc_registry.find({}, {"_id": 0})
    return list(cursor)


def get_registry_facility(facility_id: str) -> Optional[Dict]:
    db = get_db()
    seed_demo_registry(db)
    fid = facility_id.strip().upper()
    facility = db.phc_registry.find_one({"$or": [{"facility_id": fid}, {"code": fid}]})
    if not facility:
        # Check standard phcs collection as fallback
        facility = db.phcs.find_one({"$or": [{"facility_id": fid}, {"code": fid}]})
    return facility


def _public(doc: dict) -> dict:
    d = {k: v for k, v in doc.items() if k in _PUBLIC_KEYS}
    d["id"] = str(doc["_id"])
    d["contactNumber"] = d.pop("contact_number", "")
    d["healthcareWorkerName"] = d.pop("healthcare_worker_name", "")
    return d


def _require_phc(phc_id):
    if not phc_id:
        raise HTTPException(status_code=404, detail="No PHC associated with this account")
    from bson import ObjectId
    db = get_db()
    obj_id = None
    if isinstance(phc_id, ObjectId):
        obj_id = phc_id
    elif isinstance(phc_id, str) and len(phc_id) == 24:
        try:
            obj_id = ObjectId(phc_id)
        except Exception:
            pass
    
    query = {"$or": [{"_id": phc_id}]}
    if obj_id:
        query["$or"].append({"_id": obj_id})
        
    phc = db.phcs.find_one(query)
    if not phc:
        raise HTTPException(status_code=404, detail="No associated PHC profile found")
    return db, phc


def get_profile(phc_id) -> dict:
    db, phc = _require_phc(phc_id)
    return _public(phc)


def update_profile(phc_id, data: PHCProfileUpdate) -> dict:
    db, phc = _require_phc(phc_id)

    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name.strip()
    if data.code is not None:
        update_data["code"] = data.code.upper().strip()
    if data.state is not None:
        update_data["state"] = data.state.strip()
    if data.district is not None:
        update_data["district"] = data.district.strip()
    if data.address is not None:
        update_data["address"] = data.address.strip()
    if data.contactNumber is not None:
        update_data["contact_number"] = data.contactNumber.strip()
    if data.healthcareWorkerName is not None:
        update_data["healthcare_worker_name"] = data.healthcareWorkerName.strip()

    if update_data:
        db.phcs.update_one({"_id": phc["_id"]}, {"$set": update_data})
    return _public(db.phcs.find_one({"_id": phc["_id"]}))