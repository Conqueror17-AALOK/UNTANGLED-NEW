import re
from typing import List, Optional, Tuple

# OCR Character Confusion Mappings
CHAR_TO_DIGIT = {
    "l": "1",
    "I": "1",
    "i": "1",
    "|": "1",
    "O": "0",
    "o": "0",
    "D": "0",
}

DIGIT_TO_CHAR = {
    "0": "O",
    "1": "I",
    "5": "S",
    "8": "B",
    "2": "Z",
}


def normalize_tag(raw: str) -> str:
    """
    Standardize tag formatting:
    - Uppercase, strip whitespace
    - Standardize separators to hyphens (collapsing multiple spaces and hyphens)
    - Insert hyphen between prefix letters and loop numbers if omitted (e.g. PT101 -> PT-101)
    """
    cleaned = raw.strip().upper()
    cleaned = re.sub(r"[\s_-]+", "-", cleaned)
    
    # If no hyphen, e.g. PT101 or TK101, insert it
    m = re.match(r"^([A-Z]{1,4})(\d+[A-Z]?)$", cleaned)
    if m:
        cleaned = f"{m.group(1)}-{m.group(2)}"

    return cleaned


def resolve_ocr_confusion(raw_tag: str) -> List[Tuple[str, float, str]]:
    """
    Generate resolved candidate tags from common OCR character confusions.
    Returns: List of (candidate_tag, rule_confidence, reasoning)
    """
    candidates = []
    normalized = normalize_tag(raw_tag)

    # 1. Base clean
    candidates.append((normalized, 0.85, "Standard normalized format"))

    # 2. Check for numeric suffix confusion, e.g. PT10l -> PT-101 or 631-FIT-042l -> 631-FIT-0421
    parts = normalized.split("-")
    if len(parts) >= 2:
        prefix = "-".join(parts[:-1])
        suffix = parts[-1]
        
        # Suffix should generally be numbers with optional single letter suffix
        fixed_suffix = list(suffix)
        modified = False
        reasonings = []

        # If last char of suffix is 'l', 'I', 'i' and preceded by digits, it's almost certainly digit '1'
        for i in range(len(fixed_suffix)):
            ch = fixed_suffix[i]
            # If at the end and preceded by digits
            if i > 0 and fixed_suffix[i-1].isdigit():
                if ch in CHAR_TO_DIGIT:
                    fixed_suffix[i] = CHAR_TO_DIGIT[ch]
                    modified = True
                    reasonings.append(f"Fixed OCR '{ch}' -> '{CHAR_TO_DIGIT[ch]}'")
            elif i == 0 and ch in CHAR_TO_DIGIT and len(fixed_suffix) > 1 and fixed_suffix[1].isdigit():
                fixed_suffix[i] = CHAR_TO_DIGIT[ch]
                modified = True
                reasonings.append(f"Fixed OCR '{ch}' -> '{CHAR_TO_DIGIT[ch]}'")

        if modified:
            fixed_tag = f"{prefix}-{''.join(fixed_suffix)}"
            candidates.insert(0, (fixed_tag, 0.95, "; ".join(reasonings)))

    # 3. Direct trailing 'l' check if hyphen wasn't present originally: e.g. "PT10l"
    raw_clean = raw_tag.strip()
    if raw_clean.endswith("l") or raw_clean.endswith("I"):
        base = raw_clean[:-1]
        # Check if base ends with digits
        m = re.match(r"^([A-Za-z]+)(\d+)$", base)
        if m:
            cand = f"{m.group(1).upper()}-{m.group(2)}1"
            if not any(c[0] == cand for c in candidates):
                candidates.insert(0, (cand, 0.96, "Trailing 'l'/'I' resolved to digit '1'"))

    return candidates


def extract_pid_tags(text_items: List[dict], io_tags: Optional[List[str]] = None) -> List[dict]:
    """
    Spatially identify true P&ID tags (instruments, equipment, valves) from raw text items.
    Handles single-token tags (TK-101, 631-AY-0421), split instrument bubble tokens ('PT' + '101'),
    and matches against known IO List tags if provided.
    Filters out non-tag generic text (drawing title blocks, notes, scale labels).
    """
    import math
    tags = []
    used = set()

    # Known non-tag vocabulary to ignore
    ignored_words = {
        "UNTANGLE", "DEMO", "PROCESS", "FEED", "PRETREATMENT", "PUMPING", "SYSTEM",
        "DWG", "DWG:", "DWG-UNT-001", "REV", "REV:", "01", "DATE", "DATE:", "SHEET",
        "SHEET:", "1", "OF", "SCALE", "SCALE:", "NONE", "STORAGE", "15,000", "L",
        "RAW", "CRUDE", "INLET", "DUTY", "STANDBY", "PRE-HEATER", "TO", "UNIT", "200",
        "DWG-UNT-002", "&"
    }

    normalized_io_set = set()
    if io_tags:
        for it in io_tags:
            normalized_io_set.add(normalize_tag(it))

    # Regex patterns for engineering tags:
    # 1. Standard: PT-101, CV-101, P-101A, HV-77
    # 2. Multi-part / Unit-prefixed: 631-AY-0421, 631-FIT-0421, 631-XSH-0421, 631-G-0119A, 631-D-0118
    # 3. Compact: PT101, TK101
    tag_patterns = [
        re.compile(r"^[A-Z]{1,4}-\d+[A-Z]?$"),
        re.compile(r"^[A-Z]{2,4}\d{2,5}[A-Za-z]?$"),
        re.compile(r"^(\d{1,5}|[A-Z]{1,3})-[A-Z]{1,4}-\d{1,5}[A-Z]?$"),
        re.compile(r"^(\d{1,5}|[A-Z]{1,3})-[A-Z]{1,3}-\d{1,5}[A-Z]?$"),
    ]

    # 1. Single-token tags
    for i, t in enumerate(text_items):
        text = t.get("text", "").strip()
        if text in ignored_words or len(text) < 2:
            continue
        norm = normalize_tag(text)
        if norm in normalized_io_set or any(pat.match(norm) for pat in tag_patterns):
            tags.append(t)
            used.add(i)

    # 2. Spatially adjacent / stacked split tags (e.g. 'PT' above '101', '14FIC' above '15701', or '631-FIT' above '0421')
    known_prefixes = {
        "PT", "FT", "FIC", "FQIC", "LT", "LIC", "LAX", "LZALL", "LZI",
        "TT", "TI", "TIC", "PI", "PIC", "PSV", "XV", "CV", "FV", "PV",
        "LV", "TV", "HV", "CK", "AY", "XSH", "XSL", "XIH", "XIL", "HS", "ML", "ZC"
    }
    for i, t in enumerate(text_items):
        if i in used:
            continue
        text = t.get("text", "").strip().upper()
        
        m_unit = re.match(r"^(\d{1,4})([A-Z]{2,5})$", text)
        is_prefix_match = (
            text in known_prefixes
            or any(text.endswith(f"-{kp}") for kp in known_prefixes)
            or (m_unit is not None and m_unit.group(2) in known_prefixes)
        )

        if is_prefix_match:
            bx = t.get("bbox", [0, 0, 0, 0])
            bcx, bcy = (bx[0] + bx[2]) / 2.0, (bx[1] + bx[3]) / 2.0

            # Find closest numeric suffix token
            closest_idx = -1
            min_dist = float("inf")
            for j, t2 in enumerate(text_items):
                if j in used or i == j:
                    continue
                text2 = t2.get("text", "").strip()
                if re.match(r"^\d+[A-Za-z]?$", text2) or text2 in ["10l", "101", "101A", "101B"]:
                    bx2 = t2.get("bbox", [0, 0, 0, 0])
                    bcx2, bcy2 = (bx2[0] + bx2[2]) / 2.0, (bx2[1] + bx2[3]) / 2.0
                    dist = math.sqrt((bcx - bcx2) ** 2 + (bcy - bcy2) ** 2)
                    if dist < 180 and dist < min_dist:
                        min_dist = dist
                        closest_idx = j

            if closest_idx != -1:
                t2 = text_items[closest_idx]
                bx2 = t2.get("bbox", [0, 0, 0, 0])
                suffix_val = t2.get('text', '').strip()
                if m_unit:
                    combined_text = f"{m_unit.group(1)}-{m_unit.group(2)}-{suffix_val}"
                else:
                    combined_text = f"{text}-{suffix_val}"

                combined_bbox = [
                    min(bx[0], bx2[0]),
                    min(bx[1], bx2[1]),
                    max(bx[2], bx2[2]),
                    max(bx[3], bx2[3])
                ]
                ocr_c = min(t.get("ocr_confidence", 0.95), t2.get("ocr_confidence", 0.95))
                tags.append({
                    "id": t.get("id"),
                    "text": combined_text,
                    "bbox": combined_bbox,
                    "ocr_confidence": ocr_c,
                    "rotation": t.get("rotation", 0),
                    "source": t.get("source", "vector")
                })
                used.add(i)
                used.add(closest_idx)

    return tags

