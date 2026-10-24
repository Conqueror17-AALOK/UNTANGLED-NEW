import pytest
from unittest.mock import AsyncMock, patch
from services.api.app.engine.llm_resolver import (
    fuzzy_match_io,
    _extract_json_object,
    resolve_tag_with_llm_or_heuristics,
    CandidateResolution,
    clear_resolution_cache
)


@pytest.fixture(autouse=True)
def reset_cache():
    clear_resolution_cache()
    yield
    clear_resolution_cache()


def test_fuzzy_match_io():
    io_tags = ["PT-101", "FT-102", "TT-103", "P-101A"]

    # Exact match
    tag, score = fuzzy_match_io("PT-101", io_tags)
    assert tag == "PT-101"
    assert score == 1.0

    # No hyphen match
    tag, score = fuzzy_match_io("PT101", io_tags)
    assert tag == "PT-101"
    assert score >= 0.98

    # Trailing OCR 'l' -> '1'
    tag, score = fuzzy_match_io("PT-10l", io_tags)
    assert tag == "PT-101"
    assert score >= 0.95

    # No match
    tag, score = fuzzy_match_io("ZZ-999", io_tags)
    assert score < 0.6


def test_extract_json_object():
    # Direct valid JSON
    assert _extract_json_object('{"resolved_tag": "PT-101", "confidence": 0.95}') == {
        "resolved_tag": "PT-101",
        "confidence": 0.95
    }

    # Markdown fenced code block
    fenced = '```json\n{"resolved_tag": "FT-101", "confidence": 0.92, "reasoning": "OCR fix"}\n```'
    assert _extract_json_object(fenced) == {
        "resolved_tag": "FT-101",
        "confidence": 0.92,
        "reasoning": "OCR fix"
    }

    # Text with embedded JSON
    embedded = 'Here is the result:\n{"resolved_tag": "TT-101", "confidence": 0.9}\nHope that helps!'
    assert _extract_json_object(embedded) == {
        "resolved_tag": "TT-101",
        "confidence": 0.9
    }

    # Invalid JSON
    assert _extract_json_object("No JSON here") is None


@pytest.mark.asyncio
async def test_resolve_with_mocked_nvidia_llm():
    io_tags = ["PT-101", "FT-102"]

    with patch("services.api.app.config.Settings.effective_nvidia_api_key", "nvapi-mock-key"), \
         patch("services.api.app.engine.llm_resolver.call_nvidia_llm") as mock_llm:
        mock_llm.return_value = {
            "resolved_tag": "PT-101",
            "confidence": 0.95,
            "reasoning": "Corrected OCR l to 1 to match transmitter on IO list"
        }

        res = await resolve_tag_with_llm_or_heuristics(
            raw_text="PT-10l",
            normalized_candidate="PT-101",
            symbol_class="transmitter",
            io_tags=io_tags
        )

        assert isinstance(res, CandidateResolution)
        assert res.resolved_tag == "PT-101"
        assert res.confidence == 0.95
        assert "[NVIDIA: NeMoTron-3-Ultra-550B]" in res.reasoning
        assert res.io_score == 1.0


@pytest.mark.asyncio
async def test_resolve_fallback_when_nvidia_times_out():
    io_tags = ["PT-101", "FT-102"]

    # When NVIDIA call raises exception or times out, it gracefully falls back
    with patch("services.api.app.config.Settings.effective_nvidia_api_key", "nvapi-mock-key"), \
         patch("services.api.app.engine.llm_resolver.call_nvidia_llm", side_effect=Exception("Read timed out")):
        res = await resolve_tag_with_llm_or_heuristics(
            raw_text="PT-10l",
            normalized_candidate="PT-101",
            symbol_class="transmitter",
            io_tags=io_tags,
            rule_reasoning="Character confusion fix"
        )

        assert isinstance(res, CandidateResolution)
        assert res.resolved_tag == "PT-101"
        assert res.confidence >= 0.85
        assert "Matched IO List entry 'PT-101'" in res.reasoning


@pytest.mark.asyncio
async def test_resolve_rescue_tier_when_primary_models_fail():
    io_tags = ["PT-101", "FT-102"]

    # Mock call_nvidia_llm to fail on first call (Ultra 550B), but succeed on 2nd (NeMoTron-Bolt)
    side_effects = [
        Exception("NeMoTron-3 Ultra 550B timeout"),
        {
            "resolved_tag": "PT-101",
            "confidence": 0.94,
            "reasoning": "NeMoTron-Bolt resolved tag correctly"
        }
    ]

    with patch("services.api.app.config.Settings.effective_nvidia_api_key", "nvapi-mock-key"), \
         patch("services.api.app.engine.llm_resolver.call_nvidia_llm", side_effect=side_effects):
        res = await resolve_tag_with_llm_or_heuristics(
            raw_text="PT-10l",
            normalized_candidate="PT-101",
            symbol_class="transmitter",
            io_tags=io_tags
        )

        assert isinstance(res, CandidateResolution)
        assert res.resolved_tag == "PT-101"
        assert res.confidence == 0.94
        assert "[NVIDIA: NeMoTron-Bolt]" in res.reasoning
        assert res.io_score == 1.0
