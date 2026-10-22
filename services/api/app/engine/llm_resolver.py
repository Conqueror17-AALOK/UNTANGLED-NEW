import difflib
import json
from typing import Any, Dict, List, Optional, Tuple
import httpx

from services.api.app.config import get_settings
from services.api.app.core.logging import logger


class CandidateResolution:
    def __init__(self, resolved_tag: str, confidence: float, reasoning: str, io_match_tag: Optional[str] = None, io_score: float = 0.0):
        self.resolved_tag = resolved_tag
        self.confidence = confidence
        self.reasoning = reasoning
        self.io_match_tag = io_match_tag
        self.io_score = io_score


def fuzzy_match_io(raw_tag: str, io_tags: List[str]) -> Tuple[Optional[str], float]:
    """
    Fuzzy match raw_tag against the IO list using difflib similarity.
    Returns: (best_match_tag, similarity_score_0_to_1)
    """
    if not io_tags:
        return None, 0.0

    raw_clean = raw_tag.strip().upper().replace(" ", "-")

    # 1. Exact match
    for t in io_tags:
        if raw_clean == t.upper().replace(" ", "-"):
            return t, 1.0

    # 2. Match without hyphens
    raw_no_hyphen = raw_clean.replace("-", "")
    for t in io_tags:
        if raw_no_hyphen == t.upper().replace("-", "").replace(" ", ""):
            return t, 0.98

    # 3. Handle trailing OCR 'l' or 'I' -> '1'
    if raw_clean.endswith("L") or raw_clean.endswith("I"):
        alt_raw = raw_clean[:-1] + "1"
        for t in io_tags:
            if alt_raw == t.upper().replace(" ", "-"):
                return t, 0.96

    # 4. Standard SequenceMatcher ratio
    matches = difflib.get_close_matches(raw_clean, io_tags, n=1, cutoff=0.6)
    if matches:
        ratio = difflib.SequenceMatcher(None, raw_clean, matches[0]).ratio()
        return matches[0], round(ratio, 2)

    return None, 0.0


async def resolve_tag_with_llm_or_heuristics(
    raw_text: str,
    normalized_candidate: str,
    symbol_class: Optional[str],
    io_tags: List[str],
    rule_reasoning: str = ""
) -> CandidateResolution:
    """
    Resolve ambiguous tag using Gemini LLM if configured, otherwise smart deterministic heuristic.
    """
    settings = get_settings()
    best_io_tag, io_sim = fuzzy_match_io(normalized_candidate, io_tags)

    # If Gemini API Key is available, invoke LLM
    if settings.GEMINI_API_KEY:
        try:
            prompt = (
                f"You are an industrial P&ID expert. Resolve this OCR reading to the correct engineering tag.\n"
                f"Raw OCR text: '{raw_text}'\n"
                f"Rule normalized candidate: '{normalized_candidate}'\n"
                f"Associated P&ID Symbol: '{symbol_class or 'unknown'}'\n"
                f"DCS Engineering IO List tags: {io_tags[:40]}\n"
                f"Respond ONLY with a JSON object in this format:\n"
                f'{{"resolved_tag": "TAG-123", "confidence": 0.95, "reasoning": "Reason here"}}'
            )

            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.LLM_MODEL_FAST}:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 200}
            }

            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        text_resp = candidates[0]["content"]["parts"][0]["text"].strip()
                        # Extract JSON from response
                        if "{" in text_resp and "}" in text_resp:
                            json_str = text_resp[text_resp.find("{"):text_resp.rfind("}") + 1]
                            parsed = json.loads(json_str)
                            resolved_tag = parsed.get("resolved_tag", normalized_candidate)
                            llm_conf = float(parsed.get("confidence", 0.92))
                            llm_reasoning = parsed.get("reasoning", "Resolved by Gemini LLM")
                            
                            # Verify if resolved_tag matches an IO tag
                            if resolved_tag in io_tags or resolved_tag.replace("-", "") in [t.replace("-", "") for t in io_tags]:
                                io_sim = 1.0
                                best_io_tag = resolved_tag

                            return CandidateResolution(
                                resolved_tag=resolved_tag,
                                confidence=llm_conf,
                                reasoning=f"[Gemini] {llm_reasoning}",
                                io_match_tag=best_io_tag,
                                io_score=io_sim
                            )
                else:
                    logger.warning(f"Gemini API returned status {resp.status_code}, falling back to heuristic")
        except Exception as e:
            logger.warning(f"LLM resolution failed: {e}. Falling back to deterministic candidate resolution.")

    # Fallback deterministic resolution
    if best_io_tag and io_sim >= 0.85:
        reason = f"Matched IO List entry '{best_io_tag}' (similarity: {int(io_sim * 100)}%). {rule_reasoning}".strip()
        return CandidateResolution(
            resolved_tag=best_io_tag,
            confidence=round(0.85 + 0.12 * io_sim, 2),
            reasoning=reason,
            io_match_tag=best_io_tag,
            io_score=io_sim
        )

    # Fallback to normalized candidate
    return CandidateResolution(
        resolved_tag=normalized_candidate,
        confidence=0.75,
        reasoning=rule_reasoning or "Standard rule normalization.",
        io_match_tag=best_io_tag,
        io_score=io_sim
    )
