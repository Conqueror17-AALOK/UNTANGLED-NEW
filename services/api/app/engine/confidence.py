from typing import Dict, Literal, Tuple
from services.api.app.config import get_settings


def calculate_confidence(
    ocr_score: float,
    symbol_score: float,
    io_score: float,
    grammar_score: float,
    llm_score: float,
) -> Tuple[float, Dict[str, float], Literal["resolved", "needs_review", "rejected"]]:
    """
    Compute multi-signal confidence score and determine decision tier.
    Formula from docs/ARCHITECTURE.md:
    C_final = w_ocr*C_ocr + w_sym*C_sym + w_io*S_io + w_isa*S_isa + w_llm*C_llm
    """
    settings = get_settings()

    # Clamp all individual scores to [0.0, 1.0]
    c_ocr = max(0.0, min(1.0, float(ocr_score)))
    c_sym = max(0.0, min(1.0, float(symbol_score)))
    s_io = max(0.0, min(1.0, float(io_score)))
    s_isa = max(0.0, min(1.0, float(grammar_score)))
    c_llm = max(0.0, min(1.0, float(llm_score)))

    final_score = (
        settings.W_OCR * c_ocr +
        settings.W_SYM * c_sym +
        settings.W_IO * s_io +
        settings.W_ISA * s_isa +
        settings.W_LLM * c_llm
    )
    final_score = round(max(0.0, min(1.0, final_score)), 3)

    conf_breakdown = {
        "ocr": round(c_ocr, 3),
        "symbol": round(c_sym, 3),
        "io_match": round(s_io, 3),
        "grammar": round(s_isa, 3),
        "llm": round(c_llm, 3),
    }

    # Three-Tier Decision Logic
    if final_score >= settings.CONF_AUTO_THRESHOLD:
        status: Literal["resolved", "needs_review", "rejected"] = "resolved"
    elif final_score >= settings.CONF_REVIEW_THRESHOLD:
        # If strong IO match exists (>= 0.90), auto-resolve with high certainty
        if s_io >= 0.90 and c_llm >= 0.80:
            status = "resolved"
        else:
            status = "needs_review"
    else:
        status = "needs_review" if final_score >= 0.35 else "rejected"

    return final_score, conf_breakdown, status
