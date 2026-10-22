import pytest
from services.api.app.engine.cleanup import normalize_tag, resolve_ocr_confusion
from services.api.app.engine.isa51_rules import parse_isa51_tag


def test_isa51_tag_validation():
    # Valid ISA-5.1 tags
    valid_tags = [
        ("PT-101", "Pressure Transmitter", "instrument"),
        ("FT-101", "Flow Transmitter", "instrument"),
        ("TK-101", "Storage Tank", "equipment"),
        ("P-101A", "Centrifugal Pump", "equipment"),
        ("CV-101", "Pneumatic Control Valve", "valve"),
        ("HV-77", "Manual Hand Valve", "valve"),
    ]
    for tag, expected_type, expected_cat in valid_tags:
        is_valid, desc_type, cat, score = parse_isa51_tag(tag)
        assert is_valid is True
        assert desc_type is not None and (expected_type in desc_type or desc_type in expected_type)
        assert cat == expected_cat
        assert score >= 0.8


def test_ocr_confusion_resolution():
    # Test OCR noise resolution for PT10l -> PT-101
    candidates = resolve_ocr_confusion("PT10l")
    assert any(c[0] == "PT-101" for c in candidates)
    best_cand = candidates[0]
    assert best_cand[0] == "PT-101"

    # Test normalization of space: "FIC 101" -> "FIC-101"
    norm = normalize_tag("FIC 101")
    assert norm == "FIC-101"
