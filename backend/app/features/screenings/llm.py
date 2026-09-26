"""LLM layer: patient-friendly explanation + precautions for a completed screening.

Calls Gemini (via REST, stdlib only — no SDK dependency) with a strictly
factual prompt derived from the screening's grade/confidence/risk. Falls back
to a deterministic template when no GEMINI_API_KEY is configured or the API
call fails, so the endpoint always works in demos/tests.
"""
import json
import urllib.request
from typing import Dict

from app.core.config import GEMINI_API_KEY, LLM_MODEL
from app.core.logging import logger

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# ponytail: template tiers — one explanation/precaution set per grade band. Add
# per-PHC tailoring later if clinicians ask for it.
_PRECAUTIONS = {
    0: [
        "Continue your regular diabetes eye checks every year.",
        "Keep your blood sugar within your doctor's target range.",
        "Report any sudden change or loss of vision to your doctor immediately.",
    ],
    1: [
        "Get a follow-up screening at your PHC within 6 months.",
        "Keep your blood sugar and blood pressure under control.",
        "Take your diabetes medication exactly as prescribed.",
        "Report any new blurring, spots, or vision changes right away.",
    ],
    2: [
        "See an ophthalmologist within 30 days at the District Hospital.",
        "Schedule a dilated eye examination as advised.",
        "Tighten control of blood sugar, blood pressure, and cholesterol.",
        "Do not wait for symptoms — remember to mention diabetes at every eye visit.",
    ],
    3: [
        "Get priority evaluation by a retina specialist within 14 days.",
        "Follow all medicine and appointment instructions strictly.",
        "Avoid heavy lifting and straining, which can worsen retinal bleeding.",
        "Seek urgent care for sudden vision loss, flashes, or dark spots.",
    ],
    4: [
        "Visit a vitreoretinal specialist within 7 days.",
        "Urgent treatment may be needed to protect your sight.",
        "Do not delay — sudden vision changes need urgent medical attention.",
        "Keep a family member informed and bring your reports to every visit.",
    ],
}


def generate_ai_explanation(screening: Dict) -> Dict:
    prediction = screening.get("prediction") or {}
    risk = screening.get("risk") or {}
    grade = 0
    if isinstance(prediction, dict):
        grade = prediction.get("grade", 0)
    grade_label = prediction.get("label", f"Grade {grade}") if isinstance(prediction, dict) else f"Grade {grade}"

    if not GEMINI_API_KEY:
        return _fallback(grade, grade_label, risk, reason="no API key")

    try:
        context = _build_context(screening, prediction, risk)
        text = _call_gemini(_build_prompt(context))
        data = json.loads(text)
        explanation = str(data.get("explanation", "")).strip()
        precautions = data.get("precautions")
        if not explanation or not isinstance(precautions, list) or not precautions:
            raise ValueError("LLM returned an incomplete response")
        return {
            "explanation": explanation,
            "precautions": [str(p).strip() for p in precautions if str(p).strip()],
            "model": LLM_MODEL,
            "source": "llm",
        }
    except Exception as e:
        logger.warning(f"gemini explanation failed ({e}); using template fallback")
        return _fallback(grade, grade_label, risk, reason=f"llm error: {e}")


def _build_context(screening: Dict, prediction: Dict, risk: Dict) -> str:
    patient = screening.get("patient_name")
    age = screening.get("patient_age")
    diabetes = screening.get("diabetes_duration_years")
    parts = []
    if patient:
        parts.append(f"Patient: {patient}" + (f", age {age}" if age else ""))
    if diabetes is not None:
        parts.append(f"Diabetes duration: {diabetes} years")

    if isinstance(prediction, dict):
        parts.append(f"DR grade: {prediction.get('label', prediction.get('grade'))}")
        if prediction.get("confidence") is not None:
            try:
                conf_val = float(prediction["confidence"])
                conf_pct = conf_val * 100 if conf_val <= 1.0 else conf_val
                parts.append(f"Model confidence: {conf_pct:.0f}%")
            except (ValueError, TypeError):
                pass
    elif isinstance(prediction, str):
        parts.append(f"DR grade: {prediction}")

    if isinstance(risk, dict):
        parts.append(f"Risk: {risk.get('label', risk.get('level'))}")
        if risk.get("action_required"):
            parts.append(f"Clinical action: {risk['action_required']}")
    elif isinstance(risk, str):
        parts.append(f"Risk: {risk}")

    return "; ".join(parts)


def _build_prompt(context: str) -> str:
    return (
        "You are a doctor assisting a Primary Health Centre doctor in rural India. "
        "A screening AI produced the following result:\n"
        f"{context}\n\n"
        "Write, in plain Indian-English a non-technical patient would understand:\n"
        "1. explanation: a 3-5 sentence plain-language explanation of what the finding means and why the next step matters.\n"
        "2. precautions: exactly 4 actionable home/medication/visit precautions.\n"
        'Return ONLY valid JSON: {"explanation": "...", "precautions": ["..."]}. '
        "Do not invent medical facts beyond the risk guidance given. "
        "Never claim a diagnosis as certain."
    )


def _call_gemini(prompt: str) -> str:
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "responseMimeType": "application/json"},
    }).encode("utf-8")
    url = API_URL.format(model=LLM_MODEL) + f"?key={GEMINI_API_KEY}"
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    text = payload["candidates"][0]["content"]["parts"][0]["text"].strip()
    text = text.removeprefix("```json").removesuffix("```").strip()
    return text


def _fallback(grade: int, grade_label: str, risk: Dict, reason: str) -> Dict:
    action = "Consult your doctor for the next steps."
    if isinstance(risk, dict):
        action = risk.get("action_required", action)
    explanation = (
        f"Your retinal screening shows {grade_label}. This is an AI-assisted finding, "
        f"not a final diagnosis. {action} "
        "The model has flagged this so that a doctor decides the next step — keeping your "
        "blood sugar controlled and attending the scheduled follow-up is the most important "
        "thing you can do right now."
    )
    if grade == 0:
        explanation = (
            "Your retinal screening found no significant signs of diabetic retinopathy. "
            "That is good news, but diabetes can affect the eyes over time, so keep your "
            "annual eye check, control your blood sugar, and see a doctor immediately if "
            "your vision changes."
        )
    return {
        "explanation": explanation,
        "precautions": _PRECAUTIONS.get(grade, _PRECAUTIONS[0]),
        "model": "template-fallback",
        "source": "fallback",
        "fallback_reason": reason,
    }