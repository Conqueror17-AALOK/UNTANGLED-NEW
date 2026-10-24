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


def test_confidence_calculation_with_topology():
    # Test valid topology score improves confidence and adds to breakdown
    score_no_topo, breakdown_no_topo, _ = calculate_confidence(
        ocr_score=0.90,
        symbol_score=0.85,
        io_score=0.90,
        grammar_score=0.90,
        llm_score=0.90,
    )
    score_with_topo, breakdown_with_topo, status = calculate_confidence(
        ocr_score=0.90,
        symbol_score=0.85,
        io_score=0.90,
        grammar_score=0.90,
        llm_score=0.90,
        topology_score=1.0,
    )
    assert "topology" in breakdown_with_topo
    assert breakdown_with_topo["topology"] == 1.0
    assert score_with_topo >= score_no_topo
    assert status == "resolved"


def test_confidence_report_summary_metrics():
    from services.api.app.engine.cross_validator import cross_validate_drawing_and_io
    from services.api.app.engine.io_parser import IoItem

    tags = [
        {
            "id": "t1",
            "normalized_tag": "PT-101",
            "type": "Transmitter",
            "category": "instrument",
            "confidence": 0.96,
            "conf_breakdown": {"ocr": 0.98, "symbol": 0.95, "io_match": 1.0, "grammar": 1.0, "llm": 0.95},
            "status": "resolved",
            "source": "auto",
        },
        {
            "id": "t2",
            "normalized_tag": "V-101",
            "type": "Valve",
            "category": "valve",
            "confidence": 0.75,
            "conf_breakdown": {"ocr": 0.70, "symbol": 0.80, "io_match": 0.5, "grammar": 0.8, "llm": 0.75},
            "status": "needs_review",
            "source": "llm",
        },
    ]
    io_items = [
        IoItem(tag="PT-101", description="Pressure Transmitter", signal_type="4-20 mA AI"),
    ]

    report = cross_validate_drawing_and_io(tags, io_items)
    summary = report.summary

    assert summary.tags_total == 2
    assert summary.average_confidence == 85.5
    assert summary.high_confidence_count == 1
    assert summary.medium_confidence_count == 1
    assert summary.low_confidence_count == 0
    assert "ocr" in summary.confidence_breakdown_avg
    assert summary.confidence_breakdown_avg["ocr"] == 84.0
