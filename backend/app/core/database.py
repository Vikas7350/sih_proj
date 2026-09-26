import certifi
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import PyMongoError
from app.core.config import MONGODB_URL, DATABASE_NAME
from app.core.logging import logger

client: MongoClient = None
db = None


def connect_db():
    global client, db
    client_kwargs = {
        "serverSelectionTimeoutMS": 5000,
    }
    try:
        client_kwargs["tlsCAFile"] = certifi.where()
    except Exception:
        pass
    client = MongoClient(MONGODB_URL, **client_kwargs)
    db = client[DATABASE_NAME]
    try:
        _ensure_indexes()
        logger.info("Successfully connected to MongoDB")
    except PyMongoError as err:
        logger.error(
            "--------------------------------------------------------------------------------\n"
            "DATABASE CONNECTION ERROR:\n"
            f"{err}\n\n"
            "ACTION REQUIRED FOR MONGODB ATLAS:\n"
            "1. Log in to MongoDB Atlas (https://cloud.mongodb.com/)\n"
            "2. Go to Security -> Network Access\n"
            "3. Click '+ Add IP Address' -> Add Current IP Address (or Allow Access from Anywhere: 0.0.0.0/0)\n"
            "--------------------------------------------------------------------------------"
        )
    return db


def _ensure_indexes():
    """Create indexes for performance on commonly queried fields."""
    db.patients.create_index([("patient_id", ASCENDING)], unique=True, name="idx_patient_id")
    db.patients.create_index([("name", ASCENDING)], name="idx_patient_name")
    db.screenings.create_index([("patient_id", ASCENDING)], name="idx_screening_patient_id")
    db.screenings.create_index([("created_at", DESCENDING)], name="idx_screening_created_at")
    db.screenings.create_index([("prediction.grade", ASCENDING)], name="idx_screening_grade")
    db.screenings.create_index([("risk.level", ASCENDING)], name="idx_screening_risk_level")
    db.screenings.create_index([("status", ASCENDING)], name="idx_screening_status")


def get_db():
    global db
    if db is None:
        connect_db()
    return db


def close_db():
    global client
    if client:
        client.close()
