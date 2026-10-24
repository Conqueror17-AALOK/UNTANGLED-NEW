import difflib
import json
import re
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
    Fuzzy match raw_tag against the IO list using canonical normalization and difflib.
    Returns: (best_match_tag, similarity_score_0_to_1)
    """
    if not io_tags:
        return None, 0.0

    raw_clean = re.sub(r"[\s_-]+", "-", raw_tag.strip().upper())
    raw_no_hyphen = re.sub(r"[\s_-]+", "", raw_tag.strip().upper())

    # 1. Exact canonical match (collapses whitespace, hyphens, underscores)
    for t in io_tags:
        t_clean = re.sub(r"[\s_-]+", "-", t.strip().upper())
        if raw_clean == t_clean:
            return t, 1.0

    # 2. Match without delimiters (handles embedded spacing/hyphen variations)
    for t in io_tags:
        t_no_hyphen = re.sub(r"[\s_-]+", "", t.strip().upper())
        if raw_no_hyphen == t_no_hyphen:
            return t, 1.0

    # 3. Handle trailing OCR 'l' or 'I' -> '1'
    if raw_clean.endswith("L") or raw_clean.endswith("I"):
        alt_raw = raw_clean[:-1] + "1"
        for t in io_tags:
            t_clean = re.sub(r"[\s_-]+", "-", t.strip().upper())
            if alt_raw == t_clean:
                return t, 0.96

    # 4. Standard SequenceMatcher ratio
    io_clean_list = [re.sub(r"[\s_-]+", "-", t.strip().upper()) for t in io_tags]
    matches = difflib.get_close_matches(raw_clean, io_clean_list, n=1, cutoff=0.6)
    if matches:
        best_orig = next((t for t in io_tags if re.sub(r"[\s_-]+", "-", t.strip().upper()) == matches[0]), matches[0])
        ratio = difflib.SequenceMatcher(None, raw_clean, matches[0]).ratio()
        return best_orig, round(ratio, 2)

    return None, 0.0


def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    """Helper to safely extract and parse a JSON dictionary from LLM response text."""
    if not text:
        return None

    cleaned = text.strip()
    # Strip markdown code blocks if present
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

    # 1. Direct JSON parse
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # 2. Match standard outer JSON braces
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    # 3. Resilient regex fallback for unclosed or truncated JSON output
    tag_match = re.search(r'"resolved_tag"\s*:\s*"([^"]+)"', text)
    if tag_match:
        conf_match = re.search(r'"confidence"\s*:\s*([0-9.]+)', text)
        reason_match = re.search(r'"reasoning"\s*:\s*"([^"\n\r]*)', text)
        return {
            "resolved_tag": tag_match.group(1).strip(),
            "confidence": float(conf_match.group(1)) if conf_match else 0.95,
            "reasoning": reason_match.group(1).strip() if reason_match else "Resolved from LLM output"
        }

    return None


_RESOLUTION_CACHE: Dict[Tuple[str, str, Tuple[str, ...]], CandidateResolution] = {}


def clear_resolution_cache() -> None:
    """Clear in-memory resolution cache."""
    _RESOLUTION_CACHE.clear()


async def call_nvidia_llm(
    prompt: str,
    model: str,
    api_key: str,
    base_url: str,
    timeout: float = 45.0
) -> Optional[Dict[str, Any]]:
    """
    Call NVIDIA OpenAI-compatible chat completion endpoint.
    Handles NeMoTron-3 Ultra 550B and reasoning models by checking both
    message.content and message.reasoning_content.
    """
    if not api_key:
        return None

    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": (
                    "You are an industrial P&ID instrumentation expert. "
                    "Resolve ambiguous OCR text against ISA-5.1 engineering standards and DCS IO list. "
                    "Respond ONLY with a single JSON object in this exact schema: "
                    '{"resolved_tag": "TAG-123", "confidence": 0.95, "reasoning": "brief reason"}. '
                    "Do NOT include markdown fences, preambles, or long explanations.\n\n"
                    f"{prompt}"
                )
            }
        ],
        "temperature": 0.1,
        "max_tokens": 1024
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code == 200:
            data = resp.json()
            choices = data.get("choices", [])
            if choices:
                msg = choices[0].get("message", {})
                content = msg.get("content") or ""
                reasoning = msg.get("reasoning_content") or ""

                # Try parsing content first
                parsed = _extract_json_object(content)
                if not parsed and reasoning:
                    parsed = _extract_json_object(reasoning)
                return parsed
        else:
            logger.warning(f"NVIDIA API ({model}) returned HTTP {resp.status_code}: {resp.text[:200]}")
            return None


async def resolve_tag_with_llm_or_heuristics(
    raw_text: str,
    normalized_candidate: str,
    symbol_class: Optional[str],
    io_tags: List[str],
    rule_reasoning: str = ""
) -> CandidateResolution:
    """
    Resolve ambiguous tag using NVIDIA NeMoTron-3 Ultra 550B with resilient
    NeMoTron-Bolt and deterministic candidate matching heuristics fallback.
    """
    cache_key = (raw_text.strip(), normalized_candidate.strip(), tuple(io_tags[:30]))
    if cache_key in _RESOLUTION_CACHE:
        return _RESOLUTION_CACHE[cache_key]

    settings = get_settings()
    best_io_tag, io_sim = fuzzy_match_io(normalized_candidate, io_tags)

    # 1. Deterministic Fast-Path: If raw text itself is already an exact canonical match in DCS IO list (no OCR ambiguity), resolve instantly
    raw_canon = re.sub(r"[\s_-]+", "-", raw_text.strip().upper())
    if best_io_tag and raw_canon == re.sub(r"[\s_-]+", "-", best_io_tag.strip().upper()):
        res = CandidateResolution(
            resolved_tag=best_io_tag,
            confidence=0.98,
            reasoning=f"Exact verified match in DCS IO List: '{best_io_tag}'. {rule_reasoning}".strip(),
            io_match_tag=best_io_tag,
            io_score=1.0
        )
        _RESOLUTION_CACHE[cache_key] = res
        return res

    prompt = (
        f"You are an industrial P&ID (Piping and Instrumentation Diagram) expert. "
        f"Resolve this ambiguous OCR reading to the correct ISA-5.1 engineering tag.\n"
        f"Raw OCR text: '{raw_text}'\n"
        f"Rule normalized candidate: '{normalized_candidate}'\n"
        f"Associated P&ID Symbol: '{symbol_class or 'unknown'}'\n"
        f"DCS Engineering IO List tags: {io_tags[:40]}\n\n"
        f"Instructions:\n"
        f"1. Choose or verify the best engineering tag matching the IO list or ISA-5.1 syntax.\n"
        f"2. Return ONLY a valid JSON object in this exact schema:\n"
        f'{{"resolved_tag": "TAG-123", "confidence": 0.95, "reasoning": "Clear explanation of correction"}}'
    )

    api_key = settings.effective_nvidia_api_key
    timeout = getattr(settings, "LLM_TIMEOUT", 45.0)

    # 2. Primary: NVIDIA NeMoTron-3 Ultra 550B
    if settings.LLM_PROVIDER == "nvidia" and api_key and settings.LLM_MODEL:
        try:
            parsed = await call_nvidia_llm(
                prompt=prompt,
                model=settings.LLM_MODEL,
                api_key=api_key,
                base_url=settings.NVIDIA_BASE_URL,
                timeout=timeout
            )
            if parsed and "resolved_tag" in parsed:
                resolved_tag = str(parsed["resolved_tag"]).strip()
                llm_conf = float(parsed.get("confidence", 0.95))
                llm_reason = parsed.get("reasoning", "Resolved by NVIDIA NeMoTron-3 Ultra 550B")

                if resolved_tag in io_tags or resolved_tag.replace("-", "") in [t.replace("-", "") for t in io_tags]:
                    io_sim = 1.0
                    best_io_tag = resolved_tag

                res = CandidateResolution(
                    resolved_tag=resolved_tag,
                    confidence=llm_conf,
                    reasoning=f"[NVIDIA: NeMoTron-3-Ultra-550B] {llm_reason}",
                    io_match_tag=best_io_tag,
                    io_score=io_sim
                )
                _RESOLUTION_CACHE[cache_key] = res
                return res
        except Exception as e:
            err_msg = str(e) or "Request timed out"
            logger.warning(f"NVIDIA NeMoTron-3 Ultra 550B call failed ({type(e).__name__}: {err_msg}). Attempting fast NeMoTron-Bolt fallback...")

    # 3. High-Throughput Fallback: NVIDIA NeMoTron-3.5 Bolt (Low Latency Companion)
    if settings.LLM_PROVIDER == "nvidia" and api_key and settings.LLM_MODEL_FAST:
        try:
            parsed = await call_nvidia_llm(
                prompt=prompt,
                model=settings.LLM_MODEL_FAST,
                api_key=api_key,
                base_url=settings.NVIDIA_BASE_URL,
                timeout=15.0
            )
            if parsed and "resolved_tag" in parsed:
                resolved_tag = str(parsed["resolved_tag"]).strip()
                llm_conf = float(parsed.get("confidence", 0.94))
                llm_reason = parsed.get("reasoning", "Resolved by NVIDIA NeMoTron-Bolt")

                if resolved_tag in io_tags or resolved_tag.replace("-", "") in [t.replace("-", "") for t in io_tags]:
                    io_sim = 1.0
                    best_io_tag = resolved_tag

                res = CandidateResolution(
                    resolved_tag=resolved_tag,
                    confidence=llm_conf,
                    reasoning=f"[NVIDIA: NeMoTron-Bolt] {llm_reason}",
                    io_match_tag=best_io_tag,
                    io_score=io_sim
                )
                _RESOLUTION_CACHE[cache_key] = res
                return res
        except Exception as e:
            err_msg = str(e) or "Request timed out"
            logger.warning(f"NVIDIA NeMoTron-Bolt call failed ({type(e).__name__}: {err_msg}). Falling back to heuristics...")

    # 5. Backward-compatible Gemini fallback (if explicitly configured)
    if settings.GEMINI_API_KEY:
        try:
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
                        parsed = _extract_json_object(text_resp)
                        if parsed and "resolved_tag" in parsed:
                            resolved_tag = str(parsed["resolved_tag"]).strip()
                            llm_conf = float(parsed.get("confidence", 0.92))
                            llm_reason = parsed.get("reasoning", "Resolved by Gemini LLM")
                            if resolved_tag in io_tags or resolved_tag.replace("-", "") in [t.replace("-", "") for t in io_tags]:
                                io_sim = 1.0
                                best_io_tag = resolved_tag
                            res = CandidateResolution(
                                resolved_tag=resolved_tag,
                                confidence=llm_conf,
                                reasoning=f"[Gemini] {llm_reason}",
                                io_match_tag=best_io_tag,
                                io_score=io_sim
                            )
                            _RESOLUTION_CACHE[cache_key] = res
                            return res
        except Exception as e:
            logger.warning(f"Gemini fallback failed: {e}")

    # 6. Fallback deterministic resolution (Heuristic + IO List Matching)
    if best_io_tag and io_sim >= 0.85:
        reason = f"Matched IO List entry '{best_io_tag}' (similarity: {int(io_sim * 100)}%). {rule_reasoning}".strip()
        res = CandidateResolution(
            resolved_tag=best_io_tag,
            confidence=round(0.85 + 0.12 * io_sim, 2),
            reasoning=reason,
            io_match_tag=best_io_tag,
            io_score=io_sim
        )
        _RESOLUTION_CACHE[cache_key] = res
        return res

    # 7. Fallback to normalized candidate
    res = CandidateResolution(
        resolved_tag=normalized_candidate,
        confidence=0.75,
        reasoning=rule_reasoning or "Standard rule normalization.",
        io_match_tag=best_io_tag,
        io_score=io_sim
    )
    _RESOLUTION_CACHE[cache_key] = res
    return res
