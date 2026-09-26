from typing import Dict


RISK_MAP = {
    0: {
        "level": "low",
        "label": "LOW RISK",
        "description": "No significant retinopathy detected.",
        "recommendation": "Routine follow-up",
        "action_required": "Maintain annual diabetic eye screening and blood glucose control",
        "follow_up_timeframe": "12 Months",
    },
    1: {
        "level": "monitor",
        "label": "MONITOR",
        "description": "Early signs of retinopathy requiring monitoring.",
        "recommendation": "Follow-up recommended",
        "action_required": "Schedule follow-up screening within 6 months at PHC",
        "follow_up_timeframe": "6 Months",
    },
    2: {
        "level": "high",
        "label": "HIGH RISK",
        "description": "Moderate retinopathy requiring specialist evaluation.",
        "recommendation": "Ophthalmologist referral recommended",
        "action_required": "Schedule comprehensive dilated eye examination within 30 days at District Hospital",
        "follow_up_timeframe": "30 Days",
    },
    3: {
        "level": "high",
        "label": "HIGH RISK",
        "description": "Severe retinopathy requiring urgent specialist evaluation.",
        "recommendation": "Priority referral recommended",
        "action_required": "Urgent evaluation by retina specialist at Tertiary Hospital within 14 days",
        "follow_up_timeframe": "14 Days",
    },
    4: {
        "level": "urgent",
        "label": "URGENT",
        "description": "Advanced proliferative retinopathy requiring immediate intervention.",
        "recommendation": "Urgent specialist evaluation recommended",
        "action_required": "Immediate referral to vitreoretinal specialist within 7 days",
        "follow_up_timeframe": "7 Days",
    },
}


def map_grade_to_risk(grade: int) -> Dict:
    if grade in RISK_MAP:
        return RISK_MAP[grade]
    return {
        "level": "unknown",
        "label": "UNKNOWN",
        "description": "Unable to determine risk level.",
        "recommendation": "Consult specialist",
        "action_required": "Consult ophthalmologist for evaluation",
        "follow_up_timeframe": "ASAP",
    }


def get_poor_image_risk() -> Dict:
    return {
        "level": "recapture",
        "label": "RECAPTURE",
        "description": "Image quality insufficient for AI analysis.",
        "recommendation": "Retake retinal image",
        "action_required": "Recapture retinal image with proper positioning and lighting",
        "follow_up_timeframe": "Immediate",
    }