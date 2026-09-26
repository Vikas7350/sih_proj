import io
import os
import time

os.environ.setdefault("SMTP_DISABLED", "1")  # tests never hit the real Brevo SMTP server

import sys
import pytest
import numpy as np
import cv2
from fastapi.testclient import TestClient
from jose import jwt, jwk
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.main import app
from app.core.database import get_db, connect_db
from app.core.security import create_access_token
from app.core.rate_limiter import general_limiter

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_db():
    connect_db()
    db = get_db()
    # in-memory sliding window is process-global; isolate per test
    general_limiter._requests.clear()
    client.cookies.clear()
    db.patients.delete_many({})
    db.screenings.delete_many({})
    db.users.delete_many({})
    db.phcs.delete_many({})
    db.otps.delete_many({})
    db.counters.delete_many({})
    yield
    db.patients.delete_many({})
    db.screenings.delete_many({})
    db.users.delete_many({})
    db.phcs.delete_many({})
    db.otps.delete_many({})
    db.counters.delete_many({})


def _auth_headers(name="My PHC", code="PHC-A"):
    db = get_db()
    existing_user = db.users.find_one({"email": "phc-test@example.com"})
    if existing_user:
        user_id = str(existing_user["_id"])
        phc_id = existing_user.get("phc_id")
        if not phc_id:
            phc_id_obj = db.phcs.insert_one({
                "name": name, "code": code, "state": "MH", "district": "Pune",
                "address": "Street 1", "contact_number": "9876543210",
                "healthcare_worker_name": "Worker",
            }).inserted_id
            phc_id = str(phc_id_obj)
            db.users.update_one({"_id": existing_user["_id"]}, {"$set": {"phc_id": phc_id}})
        else:
            phc_id = str(phc_id)
    else:
        phc_id_obj = db.phcs.insert_one({
            "name": name, "code": code, "state": "MH", "district": "Pune",
            "address": "Street 1", "contact_number": "9876543210",
            "healthcare_worker_name": "Worker",
        }).inserted_id
        phc_id = str(phc_id_obj)
        user_id_obj = db.users.insert_one({
            "name": "Test User", "email": "phc-test@example.com",
            "password_hash": "x", "provider": "credentials", "role": "phc_staff",
            "phc_id": phc_id, "is_verified": True,
        }).inserted_id
        user_id = str(user_id_obj)
    token = create_access_token({
        "id": user_id, "email": "phc-test@example.com", "name": "Test User",
        "role": "phc_staff", "phcId": phc_id, "phc_id": phc_id, "provider": "credentials",
    })
    return {"Authorization": f"Bearer {token}"}


def _auth_headers2(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# --- Google id_token fixtures (self-signed RS256, JWKS monkeypatched) ---

GOOGLE_AUD = "test-client-id.apps.googleusercontent.com"

_crypto = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_google_priv_pem = _crypto.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
)
_google_pub_jwk = jwk.construct(_google_priv_pem, algorithm="RS256").to_dict()
_google_pub_jwk["kid"] = "test-key-1"


def _sign_id_token(sub, email, name="Google User", aud=GOOGLE_AUD):
    now = int(time.time())
    _tok = jwt.encode(
        {
            "iss": "https://accounts.google.com",
            "aud": aud,
            "sub": sub,
            "email": email,
            "email_verified": True,
            "name": name,
            "iat": now,
            "exp": now + 3600,
        },
        _google_priv_pem,
        algorithm="RS256",
        headers={"kid": "test-key-1"},
    )
    return _tok


@pytest.fixture()
def google_oauth(monkeypatch):
    """Code-flow fixtures: JWKS + client id at the test key, token exchange stubbed."""
    import app.features.auth.google as g
    import app.features.auth.routes as routes
    monkeypatch.setattr(g, "_fetch_jwks", lambda: {"keys": [_google_pub_jwk]})
    monkeypatch.setattr(g, "GOOGLE_CLIENT_ID", GOOGLE_AUD)
    monkeypatch.setattr(g, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", GOOGLE_AUD)
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
    holder = {"token": None, "code": None}
    monkeypatch.setattr(g, "exchange_code_for_tokens", lambda code: {"id_token": holder["token"]})
    monkeypatch.setattr(routes, "exchange_code_for_tokens", lambda code: {"id_token": holder["token"]})
    return holder


def _google_callback(google_oauth, sub, email, name="Google User"):
    """Drive the OAuth redirect flow: /login -> Google -> /callback, returns the callback response."""
    from urllib.parse import urlparse, parse_qs, quote
    start = client.get("/api/auth/oauth/google/login?redirect=/dashboard", follow_redirects=False)
    assert start.status_code in (302, 307)
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    assert start.cookies.get("oauth_state") == state.split("|")[0]  # cookie mirrors the URL nonce
    google_oauth["token"] = _sign_id_token(sub, email, name)
    return client.get(
        f"/api/auth/oauth/google/callback?code=test-code&state={quote(state)}",
        follow_redirects=False,
    )


def _make_test_image_bytes(width=800, height=800):
    """Synthetic fundus-like image: black corners, large reddish disk, texture."""
    rng = np.random.RandomState(42)
    img = np.zeros((height, width, 3), dtype=np.uint8)
    cv2.circle(img, (width // 2, height // 2), 340, (35, 80, 170), -1)
    cv2.circle(img, (width // 2, height // 2), 220, (45, 95, 195), -1)
    cv2.circle(img, (width // 2, height // 2), 120, (60, 110, 220), -1)
    mask = np.zeros((height, width, 1), np.uint8)
    cv2.circle(mask, (width // 2, height // 2), 340, 255, -1)
    noise = rng.randint(-28, 28, (height, width, 3), dtype=np.int16)
    img = np.clip(img.astype(np.int16) + noise * (mask.astype(bool).astype(np.int16)), 0, 255).astype(np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


# Real, Stage-0-verified fixtures from backend/storage/uploads (probed with
# checkFundusImage):
#   SCR-0044.jpg -> FUNDUS, GOOD quality, grade 0, action PROCEED
#   SCR-0002.jpg -> NON_FUNDUS, rejected at Stage 0
#   SCR-0062.jpg -> FUNDUS, GOOD, grade 4 (referable), action SPECIALIST REFERRAL
_UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "uploads")
_FUNDUS_GOOD = "SCR-0044.jpg"
_FUNDUS_REFERRABLE = "SCR-0062.jpg"
_NON_FUNDUS = "SCR-0002.jpg"


def _real_fixture_bytes(filename):
    with open(os.path.join(_UPLOADS_DIR, filename), "rb") as f:
        return f.read()


def _make_blurry_image_bytes():
    img = np.zeros((600, 600, 3), dtype=np.uint8)
    img[100:500, 100:500] = [50, 50, 50]
    blur = cv2.GaussianBlur(img, (51, 51), 0)
    _, buf = cv2.imencode(".jpg", blur)
    return buf.tobytes()


def _make_dark_image_bytes():
    img = np.zeros((600, 600, 3), dtype=np.uint8)
    img[:] = [5, 5, 5]
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def _create_patient(name="Test Patient", headers=None):
    if headers is None:
        headers = _auth_headers()
    return client.post("/api/patients", json={"name": name, "age": 50, "gender": "male"}, headers=headers).json()


def _create_screening(patient_id, eye="left", headers=None):
    if headers is None:
        headers = _auth_headers()
    return client.post("/api/screenings", json={"patient_id": patient_id, "eye": eye}, headers=headers).json()


def _upload_image(screening_id, image_bytes=None, headers=None):
    if headers is None:
        headers = _auth_headers()
    if image_bytes is None:
        image_bytes = _make_test_image_bytes()
    return client.post(
        f"/api/screenings/{screening_id}/image",
        files={"file": ("test.jpg", image_bytes, "image/jpeg")},
        headers=headers,
    )


# ── Health ──

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ── Patients ──

def test_create_patient():
    headers = _auth_headers()
    r = client.post("/api/patients", json={"name": "John", "age": 50, "gender": "male"}, headers=headers)
    assert r.status_code == 201
    data = r.json()
    assert data["patient_id"].startswith("P-")
    assert data["name"] == "John"
    assert data["created_at"]


def test_list_patients_pagination():
    headers = _auth_headers()
    for i in range(5):
        client.post("/api/patients", json={"name": f"Patient {i}", "age": 40 + i, "gender": "male"}, headers=headers)
    r = client.get("/api/patients?page=1&limit=2", headers=headers)
    data = r.json()
    assert len(data["items"]) == 2
    assert data["total"] == 5
    assert data["pages"] == 3


def test_list_patients_search():
    headers = _auth_headers()
    client.post("/api/patients", json={"name": "Alice Smith", "age": 45, "gender": "female"}, headers=headers)
    client.post("/api/patients", json={"name": "Bob Jones", "age": 55, "gender": "male"}, headers=headers)
    r = client.get("/api/patients?search=alice", headers=headers)
    data = r.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Alice Smith"


def test_get_patient():
    headers = _auth_headers()
    p = _create_patient("Jane", headers=headers)
    r = client.get(f"/api/patients/{p['patient_id']}", headers=headers)
    assert r.status_code == 200
    assert r.json()["name"] == "Jane"


def test_get_patient_not_found():
    r = client.get("/api/patients/P-9999", headers=_auth_headers())
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "PATIENT_NOT_FOUND"


def test_patient_screenings():
    headers = _auth_headers()
    p = _create_patient("Bob", headers=headers)
    _create_screening(p["patient_id"], headers=headers)
    _create_screening(p["patient_id"], "right", headers=headers)
    r = client.get(f"/api/patients/{p['patient_id']}/screenings", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_patient_screenings_not_found():
    r = client.get("/api/patients/P-9999/screenings")
    assert r.status_code == 404


# ── Screenings ──

def test_create_screening():
    p = _create_patient()
    r = client.post("/api/screenings", json={"patient_id": p["patient_id"], "eye": "right"}, headers=_auth_headers())
    assert r.status_code == 201
    assert r.json()["eye"] == "right"
    assert r.json()["status"] == "created"


def test_create_screening_invalid_eye():
    p = _create_patient()
    r = client.post("/api/screenings", json={"patient_id": p["patient_id"], "eye": "center"}, headers=_auth_headers())
    assert r.status_code == 422


def test_create_screening_patient_not_found():
    r = client.post("/api/screenings", json={"patient_id": "P-9999", "eye": "left"}, headers=_auth_headers())
    assert r.status_code == 404


def test_list_screenings_pagination():
    p = _create_patient()
    for _ in range(5):
        _create_screening(p["patient_id"])
    r = client.get("/api/screenings?page=1&limit=2", headers=_auth_headers())
    data = r.json()
    assert len(data["items"]) == 2
    assert data["total"] == 5
    assert data["pages"] == 3


def test_list_screenings_filter_by_patient():
    p1 = _create_patient("A")
    p2 = _create_patient("B")
    _create_screening(p1["patient_id"])
    _create_screening(p1["patient_id"])
    _create_screening(p2["patient_id"])
    r = client.get(f"/api/screenings?patient_id={p1['patient_id']}", headers=_auth_headers())
    assert r.json()["total"] == 2


def test_list_screenings_filter_by_grade():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    _upload_image(s["screening_id"])
    client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=_auth_headers())
    r = client.get("/api/screenings?grade=0", headers=_auth_headers())
    assert r.status_code == 200


# ── Image Upload ──

def test_upload_valid_image():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    r = _upload_image(s["screening_id"])
    assert r.status_code == 200
    assert r.json()["image_uploaded"] is True
    assert r.json()["image_url"].startswith("/storage/uploads/")


def test_upload_rejects_text_file():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    r = client.post(
        f"/api/screenings/{s['screening_id']}/image",
        files={"file": ("test.txt", b"not an image", "text/plain")},
        headers=_auth_headers(),
    )
    assert r.status_code == 415
    assert r.json()["detail"]["code"] == "UNSUPPORTED_TYPE"


def test_upload_rejects_too_large():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    big = b"\xff" * (11 * 1024 * 1024)
    r = client.post(
        f"/api/screenings/{s['screening_id']}/image",
        files={"file": ("big.jpg", big, "image/jpeg")},
        headers=_auth_headers(),
    )
    assert r.status_code == 413


def test_upload_screening_not_found():
    r = client.post(
        "/api/screenings/SCR-9999/image",
        files={"file": ("t.jpg", _make_test_image_bytes(), "image/jpeg")},
        headers=_auth_headers(),
    )
    assert r.status_code == 404


# ── Quality ──

def test_quality_good_image():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    _upload_image(s["screening_id"])
    r = client.post(f"/api/screenings/{s['screening_id']}/quality", headers=_auth_headers())
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "good"
    assert data["score"] >= 0.75
    assert all(data["checks"].values())


def test_quality_blurry_image():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    _upload_image(s["screening_id"], _make_blurry_image_bytes())
    r = client.post(f"/api/screenings/{s['screening_id']}/quality", headers=_auth_headers())
    data = r.json()
    assert data["checks"]["blur"] is False


def test_quality_screening_not_found():
    r = client.post("/api/screenings/SCR-9999/quality", headers=_auth_headers())
    assert r.status_code == 404


def test_quality_no_image():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    r = client.post(f"/api/screenings/{s['screening_id']}/quality", headers=_auth_headers())
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "NO_IMAGE"


# ── Analyze ──

def test_analyze_good_image():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    _upload_image(s["screening_id"], _real_fixture_bytes(_FUNDUS_GOOD))
    r = client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=_auth_headers())
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "completed"
    assert data["prediction"]["grade"] in range(5)
    assert data["prediction"]["label"]
    assert 0.0 <= data["prediction"]["confidence"] <= 1.0
    assert data["explanation"]["heatmap_url"].startswith("/storage/heatmaps/")
    assert data["risk"]["level"] in ["low", "monitor", "high", "urgent"]
    assert data["risk"]["recommendation"]


def test_analyze_screening_not_found():
    r = client.post("/api/screenings/SCR-9999/analyze", headers=_auth_headers())
    assert r.status_code == 404


def test_analyze_no_image():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    r = client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=_auth_headers())
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "NO_IMAGE"


def test_analyze_matlab_timeout_returns_504_without_fake_prediction(monkeypatch):
    from app.services import matlab_service

    def _timeout(*a, **k):
        raise matlab_service.MatlabExecutionTimeoutError("MATLAB timed out")

    monkeypatch.setattr(matlab_service, "run_matlab_pipeline", _timeout)
    headers = _auth_headers()
    p = _create_patient(headers=headers)
    s = _create_screening(p["patient_id"], headers=headers)
    _upload_image(s["screening_id"], _real_fixture_bytes(_FUNDUS_GOOD), headers=headers)
    r = client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=headers)
    assert r.status_code == 504
    assert r.json()["detail"]["code"] == "AI_SERVICE_TIMEOUT"
    stored = get_db().screenings.find_one({"screening_id": s["screening_id"]})
    assert stored["status"] == "failed"
    assert stored.get("prediction") is None


def test_analyze_matlab_execution_error_returns_502_without_fake_prediction(monkeypatch):
    from app.services import matlab_service

    def _boom(*a, **k):
        raise matlab_service.MatlabExecutionError("MATLAB pipeline failed")

    monkeypatch.setattr(matlab_service, "run_matlab_pipeline", _boom)
    headers = _auth_headers()
    p = _create_patient(headers=headers)
    s = _create_screening(p["patient_id"], headers=headers)
    _upload_image(s["screening_id"], _real_fixture_bytes(_FUNDUS_GOOD), headers=headers)
    r = client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=headers)
    assert r.status_code == 502
    assert r.json()["detail"]["code"] == "AI_SERVICE_ERROR"
    stored = get_db().screenings.find_one({"screening_id": s["screening_id"]})
    assert stored["status"] == "failed"
    assert stored.get("prediction") is None


def test_analyze_returns_quality_check_result():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    _upload_image(s["screening_id"], _real_fixture_bytes(_FUNDUS_GOOD))
    r = client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=_auth_headers())
    data = r.json()
    assert "image_quality" in data
    assert data["image_quality"]["status"] == "good"


# ── Get Result ──

def test_get_result():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    _upload_image(s["screening_id"], _real_fixture_bytes(_FUNDUS_GOOD))
    client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=_auth_headers())
    r = client.get(f"/api/screenings/{s['screening_id']}", headers=_auth_headers())
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "completed"
    assert data["screening_id"] == s["screening_id"]
    assert data["patient_id"] == p["patient_id"]
    assert data["eye"] == "left"
    assert data["prediction"]
    assert data["explanation"]
    assert data["risk"]


def test_get_screening_not_found():
    r = client.get("/api/screenings/SCR-9999", headers=_auth_headers())
    assert r.status_code == 404


def test_result_has_all_fields():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    _upload_image(s["screening_id"])
    client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=_auth_headers())
    r = client.get(f"/api/screenings/{s['screening_id']}")
    data = r.json()
    required = ["screening_id", "patient_id", "eye", "status", "image_url",
                 "image_quality", "prediction", "explanation", "risk"]
    for field in required:
        assert field in data, f"Missing field: {field}"


# ── Reports ──

def test_reports_summary():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    _upload_image(s["screening_id"], _real_fixture_bytes(_FUNDUS_GOOD))
    client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=_auth_headers())
    r = client.get("/api/reports/summary", headers=_auth_headers())
    assert r.status_code == 200
    data = r.json()
    assert data["total_patients"] == 1
    assert data["total_screenings"] == 1
    assert data["completed_screenings"] == 1
    assert isinstance(data["grade_distribution"], dict)
    assert isinstance(data["risk_distribution"], dict)


def test_reports_summary_empty():
    r = client.get("/api/reports/summary", headers=_auth_headers())
    assert r.status_code == 200
    data = r.json()
    assert data["total_patients"] == 0
    assert data["total_screenings"] == 0
    assert data["completed_screenings"] == 0


# ── PHC ──

def test_phc_get_profile_scoped_to_user():
    headers = _auth_headers(name="My PHC", code="PHC-A")
    r = client.get("/api/phc/profile", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "My PHC"
    assert data["code"] == "PHC-A"
    assert data["contactNumber"] == "9876543210"


def test_phc_get_profile_requires_auth():
    assert client.get("/api/phc/profile").status_code == 401


def test_phc_update_profile():
    headers = _auth_headers(name="My PHC", code="PHC-A")
    r = client.put("/api/phc/profile", headers=headers,
                   json={"name": "Renamed PHC", "district": "Nagpur"})
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Renamed PHC"
    assert data["district"] == "Nagpur"
    assert data["code"] == "PHC-A"


# ── Static files ──

def test_uploaded_image_accessible():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    up = _upload_image(s["screening_id"]).json()
    r = client.get(up["image_url"], headers=_auth_headers())
    assert r.status_code == 200
    assert len(r.content) > 0


def test_heatmap_accessible():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    _upload_image(s["screening_id"], _real_fixture_bytes(_FUNDUS_GOOD))
    analyze = client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=_auth_headers()).json()
    heatmap_url = analyze["explanation"]["heatmap_url"]
    r = client.get(heatmap_url, headers=_auth_headers())
    assert r.status_code == 200
    assert len(r.content) > 0


# ── Full Pipeline Integration ──

def test_full_pipeline_e2e():
    headers = _auth_headers()
    p = _create_patient("E2E Patient", headers=headers)
    s = _create_screening(p["patient_id"], "right", headers=headers)
    _upload_image(s["screening_id"], _real_fixture_bytes(_FUNDUS_GOOD), headers=headers)
    result = client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=headers).json()
    assert result["status"] == "completed"
    final = client.get(f"/api/screenings/{s['screening_id']}", headers=headers).json()
    assert final["status"] == "completed"
    assert final["prediction"]["grade"] in range(5)
    assert final["explanation"]["heatmap_url"]
    assert final["risk"]["level"]
    patient_screenings = client.get(f"/api/patients/{p['patient_id']}/screenings", headers=headers).json()
    assert len(patient_screenings) == 1
    summary = client.get("/api/reports/summary", headers=headers).json()
    assert summary["total_patients"] == 1
    assert summary["completed_screenings"] == 1


# ── LLM layer (patient explanation + precautions) ──

def _analyzed_screening(headers=None):
    if headers is None:
        headers = _auth_headers()
    p = _create_patient("LLM Patient", headers=headers)
    s = _create_screening(p["patient_id"], headers=headers)
    _upload_image(s["screening_id"], _real_fixture_bytes(_FUNDUS_REFERRABLE), headers=headers)
    result = client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=headers).json()
    assert result["status"] == "completed"
    return s["screening_id"]


def test_ai_explanation_falls_back_without_api_key(monkeypatch):
    import app.features.screenings.llm as llm
    monkeypatch.setattr(llm, "GEMINI_API_KEY", "")

    headers = _auth_headers()
    sid = _analyzed_screening(headers=headers)
    r = client.post(f"/api/screenings/{sid}/ai-explanation", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["screening_id"] == sid
    assert data["source"] == "fallback"
    assert data["explanation"]
    assert len(data["precautions"]) == 4
    assert all(isinstance(p, str) and p for p in data["precautions"])


def test_ai_explanation_uses_llm_and_tolerates_bad_output(monkeypatch):
    import app.features.screenings.llm as llm
    monkeypatch.setattr(llm, "GEMINI_API_KEY", "test-key")

    sid = _analyzed_screening()

    monkeypatch.setattr(llm, "_call_gemini", lambda prompt: '{"explanation": "Friendly text", "precautions": ["A", "B", "C", "D"]}')
    r = client.post(f"/api/screenings/{sid}/ai-explanation", headers=_auth_headers())
    assert r.status_code == 200
    assert r.json()["source"] == "llm"
    assert r.json()["explanation"] == "Friendly text"
    assert r.json()["precautions"] == ["A", "B", "C", "D"]

    # garbage from the LLM must fall back, not 500
    monkeypatch.setattr(llm, "_call_gemini", lambda prompt: "not json at all")
    r2 = client.post(f"/api/screenings/{sid}/ai-explanation", headers=_auth_headers())
    assert r2.status_code == 200
    assert r2.json()["source"] == "fallback"


def test_ai_explanation_requires_analyzed_screening():
    p = _create_patient("NoLLM Patient")
    s = _create_screening(p["patient_id"])
    r = client.post(f"/api/screenings/{s['screening_id']}/ai-explanation", headers=_auth_headers())
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "NOT_ANALYZED"
    assert client.post("/api/screenings/SCR-9999/ai-explanation", headers=_auth_headers()).status_code == 404


# ── Auth flow: backend is now the only DB writer ──

def _register_user(monkeypatch, email="staff@example.com", otp="246810"):
    monkeypatch.setattr("app.features.auth.otp.generate_otp", lambda: otp)
    payload = {
        "name": "Staff User",
        "email": email,
        "password": "password123",
        "phc_name": "Test PHC",
        "phc_code": "PHC-T1",
        "state": "MH",
        "district": "Pune",
        "address": "Street 5",
        "contact_number": "9876543210",
    }
    r = client.post("/api/auth/register", json=payload)
    return r, payload, otp


def test_auth_register_verify_login_me(monkeypatch):
    from datetime import datetime, timezone
    r, payload, otp = _register_user(monkeypatch, email="e2e-auth@example.com")
    assert r.status_code == 201

    db = get_db()
    user = db.users.find_one({"email": payload["email"]})
    assert user is not None and user["is_verified"] is False
    phc = db.phcs.find_one({"code": "PHC-T1"})
    assert phc is not None and user["phc_id"] == phc["_id"]

    # unverified users cannot log in
    r = client.post("/api/auth/login", json={"email": payload["email"], "password": payload["password"]})
    assert r.status_code == 403

    # wrong code rejected
    r = client.post("/api/auth/verify-otp", json={"email": payload["email"], "otp": "000000", "purpose": "email_verification"})
    assert r.status_code == 400

    # correct code verifies the account
    r = client.post("/api/auth/verify-otp", json={"email": payload["email"], "otp": otp, "purpose": "email_verification"})
    assert r.status_code == 200
    assert db.users.find_one({"email": payload["email"]})["is_verified"] is True

    # login returns a backend token accepted by /api/auth/me
    r = client.post("/api/auth/login", json={"email": payload["email"], "password": payload["password"]})
    assert r.status_code == 200
    data = r.json()
    assert data["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"})
    assert me.status_code == 200
    assert me.json()["id"] == data["user"]["id"]
    assert me.json()["role"] == "phc_staff"


def test_register_duplicate_verified_user(monkeypatch):
    r, payload, otp = _register_user(monkeypatch, email="dup@example.com")
    client.post("/api/auth/verify-otp", json={"email": payload["email"], "otp": otp, "purpose": "email_verification"})
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 400


def test_verify_otp_expired(monkeypatch):
    from datetime import datetime, timedelta, timezone
    r, payload, otp = _register_user(monkeypatch, email="expired@example.com")
    assert r.status_code == 201
    db = get_db()
    db.otps.update_many(
        {"email": payload["email"]},
        {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}},
    )
    r = client.post("/api/auth/verify-otp", json={"email": payload["email"], "otp": otp, "purpose": "email_verification"})
    assert r.status_code == 400


def test_verify_otp_attempt_limit(monkeypatch):
    r, payload, otp = _register_user(monkeypatch, email="attempts@example.com")
    assert r.status_code == 201
    for _ in range(5):
        client.post("/api/auth/verify-otp", json={"email": payload["email"], "otp": "000000", "purpose": "email_verification"})
    # 6th failure deletes the record; even the correct code now fails
    r = client.post("/api/auth/verify-otp", json={"email": payload["email"], "otp": otp, "purpose": "email_verification"})
    assert r.status_code == 400


def test_password_reset_flow(monkeypatch):
    r, payload, otp = _register_user(monkeypatch, email="reset@example.com")
    client.post("/api/auth/verify-otp", json={"email": payload["email"], "otp": otp, "purpose": "email_verification"})

    assert client.post("/api/auth/forgot-password", json={"email": payload["email"]}).status_code == 200
    r = client.post("/api/auth/reset-password", json={"email": payload["email"], "otp": otp, "password": "newpassword123"})
    assert r.status_code == 200

    assert client.post("/api/auth/login", json={"email": payload["email"], "password": "newpassword123"}).status_code == 200
    assert client.post("/api/auth/login", json={"email": payload["email"], "password": payload["password"]}).status_code == 401


def test_google_oauth_start_redirects_to_google(google_oauth):
    r = client.get("/api/auth/oauth/google/login", follow_redirects=False)
    assert r.status_code == 307
    loc = r.headers["location"]
    assert loc.startswith("https://accounts.google.com/o/oauth2/v2/auth")
    assert "response_type=code" in loc
    assert f"client_id={GOOGLE_AUD}" in loc
    assert "redirect_uri=" in loc
    assert "scope=openid" in loc


def test_google_oauth_upsert(google_oauth):
    r1 = _google_callback(google_oauth, "sub-1", "google.user@example.com", "Google User")
    assert r1.status_code == 303
    assert "http://localhost:3000/onboarding" in r1.headers["location"]
    assert get_db().users.find_one({"email": "google.user@example.com"})["provider"] == "google"

    # second login upserts rather than duplicating (profile still incomplete -> onboarding again)
    r2 = _google_callback(google_oauth, "sub-1", "google.user@example.com")
    assert "http://localhost:3000/onboarding" in r2.headers["location"]
    assert get_db().users.count_documents({"email": "google.user@example.com"}) == 1


def test_google_callback_rejects_bad_token_and_bad_state(google_oauth):
    from app.core.config import SESSION_COOKIE_NAME
    from urllib.parse import urlparse, parse_qs
    # wrong audience (would fail verification) -> bounce back to the SPA login, no user
    start = client.get("/api/auth/oauth/google/login", follow_redirects=False)
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    google_oauth["token"] = _sign_id_token("sub-x", "evil@gmail.com", aud="other-client.apps.googleusercontent.com")
    bad = client.get(f"/api/auth/oauth/google/callback?code=test-code&state={state}", follow_redirects=False)
    assert bad.status_code == 303
    assert "error=google_failed" in bad.headers["location"]
    assert get_db().users.count_documents({}) == 0
    assert SESSION_COOKIE_NAME not in client.cookies
    # state mismatch / CSRF (different from the oauth_state cookie) -> 400
    mismatch = client.get("/api/auth/oauth/google/callback?code=test-code&state=evilstate", follow_redirects=False)
    assert mismatch.status_code == 400
    # forger uses no state at all
    assert client.get("/api/auth/oauth/google/callback?code=test-code", follow_redirects=False).status_code == 400
    # user cancels at Google
    denied = client.get("/api/auth/oauth/google/callback?error=access_denied", follow_redirects=False)
    assert denied.status_code == 303 and "error=google_denied" in denied.headers["location"]


def test_google_two_accounts_stay_distinct_and_persist(google_oauth):
    _google_callback(google_oauth, "sub-a", "a@gmail.com", "A")
    _google_callback(google_oauth, "sub-b", "b@gmail.com", "B")
    assert get_db().users.count_documents({}) == 2
    assert get_db().users.find_one({"email": "a@gmail.com"})["google_id"] == "sub-a"

    # same Google account (same sub) again → same record, no duplicate
    _google_callback(google_oauth, "sub-a", "a@gmail.com", "A")
    assert get_db().users.count_documents({"email": "a@gmail.com"}) == 1
    assert get_db().users.count_documents({}) == 2


def test_google_new_user_needs_profile_then_completes(google_oauth):
    r = _google_callback(google_oauth, "sub-profile", "profile.new@gmail.com", "New P")
    assert r.status_code == 303
    assert "http://localhost:3000/onboarding" in r.headers["location"]
    token = r.cookies["dr_token"]
    assert get_db().users.find_one({"email": "profile.new@gmail.com"})["needs_profile"] is True

    body = {"name": "New P", "phc_name": "Alandi PHC", "phc_code": "PHC-N1",
            "state": "Maharashtra", "district": "Pune", "address": "1 Main Road", "contact_number": "9876543210"}
    r2 = client.post("/api/auth/complete-profile",
                     headers=_auth_headers2(token), json=body)
    assert r2.status_code == 200
    u = r2.json()["user"]
    assert u["needs_profile"] is False
    assert u["phc_id"]

    doc = get_db().users.find_one({"email": "profile.new@gmail.com"})
    from bson import ObjectId
    assert str(doc["phc_id"]) == u["phc_id"]
    assert get_db().phcs.find_one({"_id": doc["phc_id"]})

    # Returning Google account: straight to dashboard, no second onboarding.
    back = _google_callback(google_oauth, "sub-profile", "profile.new@gmail.com", "New P")
    assert back.status_code == 303 and "http://localhost:3000/dashboard" in back.headers["location"]
    assert get_db().users.find_one({"email": "profile.new@gmail.com"})["needs_profile"] is False


def test_google_existing_registered_user_is_not_flagged(google_oauth):
    from app.core.security import hash_password
    db = get_db()
    # Registered credentials users always carry a PHC (see auth.service.register);
    # signing in with the same email via Google links the account without
    # re-flagging them for profile completion.
    phc = db.phcs.insert_one({
        "name": "Reg PHC", "code": "PHC-REG", "state": "MH", "district": "Pune",
        "address": "Street 1", "contact_number": "9876543210",
        "healthcare_worker_name": "Worker",
    })
    db.users.insert_one({
        "name": "Old Reg", "email": "same.person@gmail.com",
        "password_hash": hash_password("SomePass123"), "provider": "credentials",
        "role": "phc_staff", "phc_id": phc.inserted_id, "is_verified": True,
    })
    r = _google_callback(google_oauth, "sub-same", "same.person@gmail.com", "Old Reg")
    assert r.status_code == 303 and "http://localhost:3000/dashboard" in r.headers["location"]
    assert get_db().users.count_documents({"email": "same.person@gmail.com"}) == 1
    linked = get_db().users.find_one({"email": "same.person@gmail.com"})
    assert linked["needs_profile"] is False
    assert linked["google_id"] == "sub-same"


def test_cookie_session_round_trip(google_oauth):
    """Backend owns the session: the google callback sets an httpOnly dr_token cookie."""
    from app.core.config import SESSION_COOKIE_NAME

    r = _google_callback(google_oauth, "sub-cookie", "cookie.user@gmail.com", "C")
    assert SESSION_COOKIE_NAME in r.cookies
    cookie = r.cookies[SESSION_COOKIE_NAME]
    assert r.headers.get("set-cookie") and "; httponly" in str(r.headers.get("set-cookie")).lower()

    # /me works with the cookie alone, no Authorization header
    client.cookies.clear()
    client.cookies.set(SESSION_COOKIE_NAME, cookie)
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "cookie.user@gmail.com"

    # complete-profile refreshes the cookie + clears the needs_profile claim
    body = {"name": "Cookie", "phc_name": "Cookie PHC", "phc_code": "PHC-C1",
            "state": "MH", "district": "Pune", "address": "1 Main Road", "contact_number": "9876543210"}
    r2 = client.post("/api/auth/complete-profile", json=body)
    assert r2.status_code == 200
    new_cookie = r2.cookies[SESSION_COOKIE_NAME]
    assert new_cookie != cookie

    client.cookies.clear()
    client.cookies.set(SESSION_COOKIE_NAME, new_cookie)
    me2 = client.get("/api/auth/me")
    assert me2.status_code == 200 and me2.json()["needs_profile"] is False

    # logout clears the cookie; /me then requires auth
    lo = client.post("/api/auth/logout")
    assert lo.status_code == 200
    client.cookies.clear()
    assert client.get("/api/auth/me").status_code == 401


def test_credentials_login_sets_session_cookie():
    from app.core.config import SESSION_COOKIE_NAME
    r = client.post("/api/auth/register", json={
        "name": "Sess User", "email": "sess.user@example.com", "password": "StrongPass123",
        "phc_name": "Sess PHC", "phc_code": "PHC-SESS", "state": "MH", "district": "Pune",
        "address": "1 Main Road", "contact_number": "9876543210",
    })
    assert r.status_code == 201
    uid = r.json()["id"]
    db = get_db()
    db.users.update_one({"_id": db.users.find_one({"email": "sess.user@example.com"})["_id"]}, {"$set": {"is_verified": True}})

    r2 = client.post("/api/auth/login", json={"email": "sess.user@example.com", "password": "StrongPass123"})
    assert r2.status_code == 200
    assert SESSION_COOKIE_NAME in r2.cookies
    client.cookies.clear()
    client.cookies.set(SESSION_COOKIE_NAME, r2.cookies[SESSION_COOKIE_NAME])
    me = client.get("/api/auth/me")
    assert me.status_code == 200 and me.json()["id"] == uid


def test_smtp_disabled_logs_otp_and_does_not_pretend_to_send(monkeypatch, caplog):
    from app.features.auth.email import send_email

    monkeypatch.setenv("SMTP_DISABLED", "1")
    monkeypatch.delenv("NODE_ENV", raising=False)
    with caplog.at_level("INFO"):
        ok = send_email("to@example.com", "s", "<p>verify</p>", otp_for_dev_only="999999")
    assert ok is False
    assert "999999" in caplog.text


# ── Storage gate (Step 11): signed URL or token required ──

def test_storage_rejects_unauthenticated():
    assert client.get("/storage/uploads/whatever.jpg").status_code == 401
    assert client.get("/storage/heatmaps/whatever.png").status_code == 401


def test_storage_signed_url_serves_without_token():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    up = _upload_image(s["screening_id"]).json()
    assert up["image_url"].startswith("/storage/uploads/") and "sig=" in up["image_url"]
    assert client.get(up["image_url"]).status_code == 200


def test_heatmap_url_is_signed():
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    _upload_image(s["screening_id"], _real_fixture_bytes(_FUNDUS_GOOD))
    analyze = client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=_auth_headers()).json()
    url = analyze["explanation"]["heatmap_url"]
    assert url.startswith("/storage/heatmaps/") and "sig=" in url
    assert client.get(url).status_code == 200


# ── Fundus plausibility gate (check_fundus_structure) ──

def _make_non_fundus_bytes():
    img = np.full((600, 600, 3), 225, np.uint8)
    cv2.circle(img, (200, 200), 60, (30, 120, 240), -1)
    cv2.rectangle(img, (300, 300), (360, 360), (30, 180, 50), -1)
    cv2.circle(img, (450, 150), 40, (40, 40, 40), -1)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def test_quality_good_image_includes_fundus_structure():
    headers = _auth_headers()
    p = _create_patient(headers=headers)
    s = _create_screening(p["patient_id"], headers=headers)
    _upload_image(s["screening_id"], headers=headers)
    data = client.post(f"/api/screenings/{s['screening_id']}/quality", headers=headers).json()
    assert data["status"] == "good"
    assert data["checks"]["fundus_structure"] is True


def test_quality_rejects_non_fundus_image():
    headers = _auth_headers()
    p = _create_patient(headers=headers)
    s = _create_screening(p["patient_id"], headers=headers)
    _upload_image(s["screening_id"], _make_non_fundus_bytes(), headers=headers)
    data = client.post(f"/api/screenings/{s['screening_id']}/quality", headers=headers).json()
    assert data["status"] == "poor"
    assert data["action"] == "recapture"
    assert data["checks"]["fundus_structure"] is False
    assert "Image does not appear to be a retinal fundus photograph" in data["issues"]


def test_analyze_rejects_non_fundus_without_running_inference():
    # Real Stage-0 fundus gate: a non-fundus image is rejected before any model
    # inference runs. MATLAB halts at STAGE_0_FUNDUS_VALIDATION (action REJECT);
    # every non-fundus path must surface as status "rejected" with no
    # prediction/explanation.
    headers = _auth_headers()
    p = _create_patient(headers=headers)
    s = _create_screening(p["patient_id"], headers=headers)
    _upload_image(s["screening_id"], _real_fixture_bytes(_NON_FUNDUS), headers=headers)
    result = client.post(f"/api/screenings/{s['screening_id']}/analyze", headers=headers).json()

    assert result["status"] == "rejected"
    assert result["stage"] == "STAGE_0_FUNDUS_VALIDATION"
    assert result["action"] == "REJECT"
    assert result["risk"]["level"] == "recapture"
    assert result["prediction"] is None
    assert result["explanation"] is None
    stored = get_db().screenings.find_one({"screening_id": s["screening_id"]})
    assert stored["status"] == "rejected"
    assert stored["image_quality"]["checks"]["fundus_structure"] is False
    assert stored.get("prediction") is None


def test_red_ball_on_dark_heuristic_boundary():
    # A uniformly dark, perfectly round red object is indistinguishable from a
    # fundus by these plausibility heuristics (dark corners, red-dominant,
    # round), so fundus_structure passes by design; it is still rejected
    # downstream by the blur/brightness checks. Pins current behaviour so any
    # future tightening of check_fundus_structure is noticed here.
    img = np.zeros((600, 600, 3), np.uint8)
    cv2.circle(img, (300, 300), 200, (20, 40, 215), -1)
    _, buf = cv2.imencode(".jpg", img)
    p = _create_patient()
    s = _create_screening(p["patient_id"])
    _upload_image(s["screening_id"], buf.tobytes())
    data = client.post(f"/api/screenings/{s['screening_id']}/quality", headers=_auth_headers()).json()
    assert data["checks"]["fundus_structure"] is True
    assert data["status"] == "poor"
    assert data["issues"]


def test_send_email_smtp_key_falls_back_to_dev_logging(monkeypatch):
    from app.features.auth.email import send_email
    monkeypatch.delenv("BREVO_API_KEY", raising=False)
    monkeypatch.delenv("SMTP_DISABLED", raising=False)
    monkeypatch.setenv("EMAIL_SERVER_PASSWORD", "xsmtpsib-1234567890abcdef")
    monkeypatch.setenv("NODE_ENV", "development")
    # Should fall back to terminal logging instead of attempting REST API call with SMTP password
    assert send_email("test@example.com", "Test Subject", "<p>OTP</p>", "123456") is False


def test_send_email_valid_api_key_http_error(monkeypatch):
    from app.features.auth.email import send_email
    from fastapi import HTTPException
    monkeypatch.delenv("SMTP_DISABLED", raising=False)
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test-valid-format-key")
    
    # Mock urllib.request.urlopen to simulate 401 Unauthorized from Brevo
    import urllib.request
    from unittest.mock import MagicMock
    
    def _mock_urlopen(req, timeout=15):
        raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized", {}, None)
        
    monkeypatch.setattr(urllib.request, "urlopen", _mock_urlopen)
    
    with pytest.raises(HTTPException) as exc_info:
        send_email("test@example.com", "Test Subject", "<p>OTP</p>", "123456")
    assert exc_info.value.status_code == 502
    assert "BREVO_API_KEY must be a valid 'xkeysib-...' API key" in exc_info.value.detail

