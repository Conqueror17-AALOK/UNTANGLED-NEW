import pytest
from services.api.app.engine.confidence import calculate_confidence


def test_confidence_calculation_auto_accept():
    # High confidence: all signals near 1.0
    score, breakdown, status = calculate_confidence(
        ocr_score=0.98,
        symbol_score=0.95,
        io_score=1.0,
        grammar_score=1.0,
        llm_score=0.95
    )
    assert score >= 0.85
    assert status == "resolved"
    assert breakdown["ocr"] == 0.98
    assert breakdown["io_match"] == 1.0


def test_confidence_calculation_review_queue():
    # Low confidence OCR (0.40), no IO match (0.0)
    score, breakdown, status = calculate_confidence(
        ocr_score=0.40,
        symbol_score=0.50,
        io_score=0.0,
        grammar_score=0.50,
        llm_score=0.50
    )
    assert score < 0.60
    assert status in ["needs_review", "rejected"]
