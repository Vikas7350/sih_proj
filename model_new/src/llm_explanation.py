"""Optional local LLM explanation client.

Only structured model evidence is sent. The fundus image and patient data are
never sent to the LLM. The client uses an OpenAI-compatible local endpoint,
with Ollama as the default.
"""

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "http://127.0.0.1:11434/v1/chat/completions"
DEFAULT_MODEL = "llama3.2:latest"
DEFAULT_TIMEOUT = 120


SYSTEM_PROMPT = (
    "You are a cautious diabetic-retinopathy screening assistant. "
    "Explain only the supplied model evidence. Do not claim to see lesions, "
    "diagnose disease, prescribe treatment, or replace an ophthalmologist. "
    "For No DR or Mild DR, emphasize prevention, diabetes control, and routine "
    "screening. For Moderate, Severe, or Proliferative DR, explain the model "
    "evidence and recommend appropriate eye-care follow-up. Mention that "
    "Grad-CAM is an influence map, not a lesion mask. Keep the answer concise."
)


def _endpoint() -> str:
    return os.getenv("LOCAL_LLM_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def _model() -> str:
    return os.getenv("LOCAL_LLM_MODEL", DEFAULT_MODEL)


def _timeout() -> float:
    return float(os.getenv("LOCAL_LLM_TIMEOUT", str(DEFAULT_TIMEOUT)))


def _language_instruction(language: str) -> str:
    if language == "hindi":
        return "Write the explanation in Hindi, keeping DR class names in English."
    if language == "bilingual":
        return "Write English first, followed by a Hindi translation."
    return "Write the explanation in English."


def generate_llm_explanation(
    prediction: dict,
    language: str = "english",
) -> dict:
    """Generate an explanation from structured evidence using a local LLM."""
    evidence = {
        "grade": prediction["grade"],
        "class": prediction["class"],
        "confidence": prediction["confidence"],
        "probabilities": prediction["probabilities"],
        "clinical_explanation": prediction["clinical_explanation"],
    }
    payload = {
        "model": _model(),
        "temperature": 0.1,
        "max_tokens": 300,
        "stream": False,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"{_language_instruction(language)}\n"
                    "Use this JSON evidence and do not invent additional findings:\n"
                    f"{json.dumps(evidence, ensure_ascii=False)}"
                ),
            },
        ],
    }
    request = Request(
        _endpoint(),
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=_timeout()) as response:
            response_data = json.loads(response.read().decode("utf-8"))
        text = response_data["choices"][0]["message"]["content"].strip()
        return {
            "status": "success",
            "provider": "local_openai_compatible",
            "endpoint": _endpoint(),
            "model": _model(),
            "language": language,
            "text": text,
        }
    except (HTTPError, URLError, TimeoutError, OSError, KeyError, IndexError, json.JSONDecodeError) as error:
        return {
            "status": "unavailable",
            "provider": "local_openai_compatible",
            "endpoint": _endpoint(),
            "model": _model(),
            "language": language,
            "text": None,
            "error": str(error),
            "fallback": "deterministic_clinical_explanation",
        }
