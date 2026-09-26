"""Build evidence-driven, medically cautious prediction explanations."""


# These are clinical definitions, not response paragraphs. The wording shown
# to a user is assembled from the current probability distribution below.
CLASS_CONTEXT = (
    (
        "No DR",
        "no model evidence of diabetic-retinopathy changes",
        "routine eye screening",
    ),
    (
        "Mild DR",
        "early non-proliferative retinal changes",
        "routine dilated eye-care follow-up",
    ),
    (
        "Moderate DR",
        "more extensive non-proliferative retinal vascular damage",
        "ophthalmology assessment soon",
    ),
    (
        "Severe DR",
        "advanced non-proliferative retinal vascular changes",
        "prompt ophthalmology assessment",
    ),
    (
        "Proliferative DR",
        "advanced disease associated with abnormal new vessels and bleeding risk",
        "urgent ophthalmology assessment",
    ),
)


GENERAL_DISCLAIMER = (
    "This is an AI screening aid, not a diagnosis. A qualified eye-care "
    "professional must confirm the result using a clinical examination."
)

HINDI_DISCLAIMER = (
    "यह AI स्क्रीनिंग सहायता है, निदान नहीं। योग्य नेत्र-चिकित्सक को "
    "क्लिनिकल जांच से परिणाम की पुष्टि करनी चाहिए।"
)

PREVENTION_GUIDELINES = (
    "Maintain glycemic control, blood-pressure control, and cholesterol control within the treating clinician's target range.",
    "Maintain the recommended retinal screening schedule and routine eye-care follow-up.",
    "Report sudden blurred vision, floaters, flashes, eye pain, or other visual changes promptly.",
)

HINDI_PREVENTION_GUIDELINES = (
    "मधुमेह, रक्तचाप और कोलेस्ट्रॉल को चिकित्सक के लक्ष्यों के अनुसार नियंत्रित रखें।",
    "नियमित नेत्र स्क्रिनिंग और अनुशंसित नेत्र-देखभाल फॉलो-अप बनाए रखें।",
    "यदि दृष्टि धुंधली हो, फ्लोटर्स, चमकें, आंख में दर्द या अन्य दृश्य परिवर्तन हों तो तुरंत रिपोर्ट करें।",
)


def _get_prevention_guidance(predicted_class: int) -> list[str]:
    """Return clinically cautious prevention advice for the current result."""
    if predicted_class <= 1:
        return list(PREVENTION_GUIDELINES)
    return [
        "Maintain glycemic control, blood-pressure control, and lipid control to reduce additional retinal progression risk while specialist assessment is arranged.",
        "Keep the recommended retinal follow-up schedule and attend all urgent eye-care appointments.",
        "Seek urgent assessment if vision changes suddenly or significant eye pain develops.",
    ]


def _build_hindi_explanation(
    context_name: str,
    follow_up: str,
    top_name: str,
    top_probability: float,
    runner_up_name: str,
    runner_up_probability: float,
    margin: float,
    certainty: str,
    predicted_class: int,
) -> dict:
    """Render the same live evidence for Hindi-speaking users."""
    certainty_names = {
        "high": "उच्च",
        "moderate": "मध्यम",
        "limited": "सीमित",
    }
    if predicted_class <= 1:
        hindi_context = (
            "डायबिटिक रेटिनोपैथी के स्पष्ट संकेत नहीं मिले"
            if predicted_class == 0
            else "शुरुआती नॉन-प्रोलिफेरेटिव रेटिनल बदलाव"
        )
        action = (
            "मधुमेह, रक्तचाप और कोलेस्ट्रॉल को चिकित्सक की सलाह के अनुसार नियंत्रित रखें "
            "और नियमित आंखों की जांच कराएं।"
        )
        mode = "रोकथाम और मधुमेह नियंत्रण"
    else:
        hindi_context = {
            2: "अधिक व्यापक नॉन-प्रोलिफेरेटिव रेटिनल रक्त-वाहिका बदलाव",
            3: "उन्नत नॉन-प्रोलिफेरेटिव रेटिनल रक्त-वाहिका बदलाव",
            4: "असामान्य नई रक्त-वाहिकाओं और रक्तस्राव के जोखिम से जुड़ी उन्नत बीमारी",
        }[predicted_class]
        action = (
            "इस परिणाम की पुष्टि के लिए नेत्र-चिकित्सक से "
            f"{follow_up} कराएं।"
        )
        mode = "क्लिनिकल रूप से महत्वपूर्ण Explainable AI"

    prevention_guidelines = list(HINDI_PREVENTION_GUIDELINES)
    if predicted_class > 1:
        prevention_guidelines = [
            "मधुमेह, रक्तचाप और कोलेस्ट्रॉल को नियंत्रित रखें ताकि अतिरिक्त रेटिनल प्रगति का जोखिम कम रहे।",
            "अनुशंसित रेटिनल फॉलो-अप शेड्यूल बनाए रखें और सभी आंखों की अपॉइंटमेंट पर जाएं।",
            "यदि दृष्टि अचानक बदलती है या गंभीर आंखों में दर्द होता है तो तुरंत मूल्यांकन लें।",
        ]

    return {
        "mode": mode,
        "medical_meaning": (
            f"अनुमानित श्रेणी {context_name} है। चिकित्सकीय रूप से यह "
            f"{hindi_context} से संबंधित है।"
        ),
        "why_this_category": (
            f"मॉडल ने {top_name} के लिए {top_probability:.2%} और "
            f"{runner_up_name} के लिए {runner_up_probability:.2%} संभावना दी। "
            f"अंतर {margin:.2%} है और मॉडल की छवि-आधारित निश्चितता "
            f"{certainty_names[certainty]} है।"
        ),
        "recommended_action": action,
        "prevention_guidelines": prevention_guidelines,
        "urgency": (
            "अचानक या बहुत कम दिखाई देने पर तुरंत आपातकालीन सहायता लें; "
            "अन्यथा सुझाए गए नेत्र-चिकित्सा समय का पालन करें।"
        ),
        "disclaimer": HINDI_DISCLAIMER,
    }


def build_clinical_explanation(
    predicted_class: int,
    probabilities: list[float],
    class_names: list[str],
) -> dict:
    """Explain this prediction using its actual class distribution."""
    if not 0 <= predicted_class < len(probabilities):
        raise ValueError(f"Unsupported DR class: {predicted_class}")
    if len(probabilities) != len(class_names) or len(probabilities) != len(CLASS_CONTEXT):
        raise ValueError("Probabilities, class names, and clinical context must align")

    ranked = sorted(
        enumerate(probabilities),
        key=lambda item: item[1],
        reverse=True,
    )
    top_index, top_probability = ranked[0]
    runner_up_index, runner_up_probability = ranked[1]
    margin = top_probability - runner_up_probability
    context_name, medical_context, follow_up = CLASS_CONTEXT[predicted_class]

    if top_probability >= 0.90 and margin >= 0.70:
        certainty = "high"
    elif top_probability >= 0.60 and margin >= 0.25:
        certainty = "moderate"
    else:
        certainty = "limited"

    distribution = [
        {
            "class": class_names[index],
            "probability": round(float(probability), 6),
        }
        for index, probability in ranked
    ]

    if predicted_class <= 1:
        mode = "prevention and diabetic control"
        recommended_action = (
            "Focus on diabetes, blood-pressure, and lipid control with the "
            "treating clinician, and keep the recommended routine eye-screening "
            "schedule."
        )
    else:
        mode = "clinically meaningful explainable AI"
        recommended_action = (
            f"Use this evidence to prioritize {follow_up}, then have a "
            "qualified eye-care professional confirm the finding."
        )

    prevention_guidelines = _get_prevention_guidance(predicted_class)

    explanation = {
        "mode": mode,
        "medical_meaning": (
            f"The predicted category is {context_name}. In medical terms, "
            f"this category is associated with {medical_context}."
        ),
        "why_this_category": (
            f"The model assigned {top_probability:.2%} probability to "
            f"{class_names[top_index]}, versus {runner_up_probability:.2%} "
            f"for {class_names[runner_up_index]}; the margin is {margin:.2%}. "
            f"This makes the model's image-based certainty {certainty}."
        ),
        "model_evidence": {
            "confidence": round(float(top_probability), 6),
            "runner_up_class": class_names[runner_up_index],
            "runner_up_probability": round(float(runner_up_probability), 6),
            "confidence_margin": round(float(margin), 6),
            "certainty": certainty,
            "class_distribution": distribution,
        },
        "recommended_action": recommended_action,
        "prevention_guidelines": prevention_guidelines,
        "urgency": (
            "Emergency care is appropriate for sudden or severe vision loss; "
            "otherwise follow the recommended eye-care timeframe."
        ),
        "disclaimer": GENERAL_DISCLAIMER,
    }

    explanation["hindi"] = _build_hindi_explanation(
        context_name=context_name,
        follow_up=follow_up,
        top_name=class_names[top_index],
        top_probability=top_probability,
        runner_up_name=class_names[runner_up_index],
        runner_up_probability=runner_up_probability,
        margin=margin,
        certainty=certainty,
        predicted_class=predicted_class,
    )
    return explanation


def add_gradcam_evidence(prediction: dict, gradcam: dict) -> None:
    """Attach numeric saliency evidence when Grad-CAM was generated."""
    evidence = prediction["clinical_explanation"]["model_evidence"]
    evidence["gradcam"] = {
        "active_area_fraction": gradcam["active_area_fraction"],
        "activation_mean": gradcam["activation_mean"],
        "activation_peak": gradcam["activation_peak"],
    }
