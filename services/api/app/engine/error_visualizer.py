import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np

logger = logging.getLogger(__name__)


def map_coords(
    bbox: List[float],
    src_w: float,
    src_h: float,
    target_w: int,
    target_h: int
) -> Tuple[int, int, int, int]:
    """
    Map bounding box from perception coordinate space to target raster image space.
    """
    bx1, by1, bx2, by2 = bbox
    # Normalize if inverted
    x_min, x_max = min(bx1, bx2), max(bx1, bx2)
    y_min, y_max = min(by1, by2), max(by1, by2)

    # 1. Already normalized (0.0 - 1.0)
    if x_max <= 1.0 and y_max <= 1.0:
        return int(x_min * target_w), int(y_min * target_h), int(x_max * target_w), int(y_max * target_h)

    # 2. Coordinates already in target image space
    if x_max <= target_w * 1.05 and y_max <= target_h * 1.05 and (abs(src_w - target_w) < 2 or src_w <= 0):
        return int(x_min), int(y_min), int(x_max), int(y_max)

    # 3. Scale from perception resolution (e.g. 2000x1400 or 9934x7016) to rendered raster image
    sx = target_w / max(float(src_w), 1.0)
    sy = target_h / max(float(src_h), 1.0)

    x1 = max(0, min(target_w - 1, int(x_min * sx)))
    y1 = max(0, min(target_h - 1, int(y_min * sy)))
    x2 = max(0, min(target_w - 1, int(x_max * sx)))
    y2 = max(0, min(target_h - 1, int(y_max * sy)))

    # Ensure minimum visible box size
    if x2 - x1 < 18:
        x2 = min(target_w - 1, x1 + 18)
        x1 = max(0, x1 - 9)
    if y2 - y1 < 18:
        y2 = min(target_h - 1, y1 + 18)
        y1 = max(0, y1 - 9)

    return x1, y1, x2, y2


def _draw_corner_reticles(
    img: np.ndarray,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    color: Tuple[int, int, int],
    thickness: int = 3,
    length: int = 14
):
    """
    Draw modern high-tech engineering CAD corner reticles / brackets on a bounding box.
    """
    l = min(length, max(5, (x2 - x1) // 3), max(5, (y2 - y1) // 3))
    # Top-Left
    cv2.line(img, (x1, y1), (x1 + l, y1), color, thickness)
    cv2.line(img, (x1, y1), (x1, y1 + l), color, thickness)
    # Top-Right
    cv2.line(img, (x2, y1), (x2 - l, y1), color, thickness)
    cv2.line(img, (x2, y1), (x2, y1 + l), color, thickness)
    # Bottom-Left
    cv2.line(img, (x1, y2), (x1 + l, y2), color, thickness)
    cv2.line(img, (x1, y2), (x1, y2 - l), color, thickness)
    # Bottom-Right
    cv2.line(img, (x2, y2), (x2 - l, y2), color, thickness)
    cv2.line(img, (x2, y2), (x2, y2 - l), color, thickness)


def _draw_badge_pill(
    img: np.ndarray,
    x1: int,
    y1: int,
    x2: int,
    text: str,
    border_color: Tuple[int, int, int],
    bg_color: Tuple[int, int, int] = (24, 20, 24),
    text_color: Tuple[int, int, int] = (255, 255, 255),
    font_scale: float = 0.44,
    thickness: int = 1
):
    """
    Draw a clean, floating CAD inspection badge pill with an indicator connector.
    """
    font = cv2.FONT_HERSHEY_SIMPLEX
    (text_w, text_h), baseline = cv2.getTextSize(text, font, font_scale, thickness)

    pad_x = 8
    pad_y = 5
    pill_w = text_w + pad_x * 2
    pill_h = text_h + pad_y * 2 + baseline

    # Position badge above component; if too close to image top, place below
    pill_x1 = max(6, min(img.shape[1] - pill_w - 6, x1))
    if y1 > pill_h + 12:
        pill_y1 = y1 - pill_h - 6
        connector_start = ((x1 + x2) // 2, y1)
        connector_end = ((x1 + x2) // 2, pill_y1 + pill_h)
    else:
        pill_y1 = y1 + 10
        connector_start = ((x1 + x2) // 2, y1)
        connector_end = ((x1 + x2) // 2, pill_y1)

    pill_x2 = pill_x1 + pill_w
    pill_y2 = pill_y1 + pill_h

    # Draw small connector stem
    cv2.line(img, connector_start, connector_end, border_color, 1)

    # Draw solid background pill
    cv2.rectangle(img, (pill_x1, pill_y1), (pill_x2, pill_y2), bg_color, -1)
    # Draw colored pill border
    cv2.rectangle(img, (pill_x1, pill_y1), (pill_x2, pill_y2), border_color, 1)
    # Draw label text
    text_pos = (pill_x1 + pad_x, pill_y2 - pad_y - baseline + 1)
    cv2.putText(img, text, text_pos, font, font_scale, text_color, thickness, cv2.LINE_AA)


def extract_error_hotspots(
    page_number: int,
    report_data: Dict[str, Any],
    perception_dict: Optional[Dict[str, Any]] = None,
    resolved_tags: Optional[List[Dict[str, Any]]] = None,
    src_w: float = 2000.0,
    src_h: float = 1400.0
) -> List[Dict[str, Any]]:
    """
    Build a comprehensive list of all error hotspots on a given P&ID sheet,
    with pixel and normalized [0..1] coordinates for frontend interactive pins.
    """
    hotspots: List[Dict[str, Any]] = []

    # Map tags to bbox and page
    tags_map: Dict[str, Dict[str, Any]] = {}
    for t in (resolved_tags or []):
        norm = t.get("normalized_tag", "").upper().replace(" ", "-")
        tags_map[norm] = t
        tags_map[norm.replace("-", "")] = t
        if "id" in t:
            tags_map[t["id"]] = t

    # Also extract text boxes from perception.json for fallback
    if perception_dict:
        pages = perception_dict.get("pages", [])
        page_perc = next((p for p in pages if p.get("page_number") == page_number), None)
        if page_perc:
            src_w = float(page_perc.get("width", src_w))
            src_h = float(page_perc.get("height", src_h))
            for text_it in page_perc.get("text_items", []):
                txt_clean = text_it.get("text", "").strip().upper()
                if txt_clean and txt_clean not in tags_map:
                    tags_map[txt_clean] = {
                        "bbox": text_it.get("bbox"),
                        "page": page_number,
                        "type": "text_tag"
                    }

    # 1. Connection Diagnostics (P1 Critical, P2 Operational, P3 Low Accuracy)
    conn_val = report_data.get("connection_validation") or {}
    diagnostics = conn_val.get("diagnostics", [])
    for d in diagnostics:
        diag_page = d.get("page", 1)
        if diag_page != page_number:
            continue

        status = d.get("status", "WRONG")
        if status == "CORRECT":
            continue

        elem_id = d.get("element_id", "UNKNOWN")
        pri = d.get("priority", "P1" if status == "WRONG" else "P2")
        bbox = d.get("bbox")

        # Resolve bbox if missing
        if not bbox or bbox == [0, 0, 0, 0]:
            tag_entry = tags_map.get(elem_id.upper()) or tags_map.get(elem_id.upper().replace("-", ""))
            if tag_entry and tag_entry.get("bbox"):
                bbox = tag_entry["bbox"]

        if not bbox or bbox == [0, 0, 0, 0]:
            continue

        bx1, by1, bx2, by2 = bbox
        norm_bbox = [
            round(min(bx1, bx2) / max(src_w, 1.0), 4),
            round(min(by1, by2) / max(src_h, 1.0), 4),
            round(max(bx1, bx2) / max(src_w, 1.0), 4),
            round(max(by1, by2) / max(src_h, 1.0), 4),
        ]

        hotspots.append({
            "id": f"conn_{elem_id}_{len(hotspots)}",
            "tag": elem_id,
            "type": "P1_CRITICAL" if pri == "P1" else "P2_WARNING" if pri == "P2" else "P3_AUDIT",
            "priority": pri,
            "priority_label": d.get("priority_label", f"{pri} Error"),
            "rule": d.get("rule", "CONNECTION_ERROR"),
            "message": d.get("message", "Discrepancy detected in connection topology."),
            "recommendation": d.get("time_savings_action", d.get("recommendation", "Review connection.")),
            "bbox": [float(bx1), float(by1), float(bx2), float(by2)],
            "normalized_bbox": norm_bbox,
            "page": page_number,
        })

    # 2. Missing in IO List (Physical devices on sheet missing electrical DCS channel)
    missing_in_io = report_data.get("missing_in_io_list", [])
    for m in missing_in_io:
        tag_str = m.get("tag", "")
        tag_entry = tags_map.get(tag_str.upper()) or tags_map.get(tag_str.upper().replace("-", ""))
        if not tag_entry:
            tag_entry = tags_map.get(m.get("tag_id", ""))

        if tag_entry and tag_entry.get("page", 1) == page_number and tag_entry.get("bbox"):
            bx1, by1, bx2, by2 = tag_entry["bbox"]
            norm_bbox = [
                round(min(bx1, bx2) / max(src_w, 1.0), 4),
                round(min(by1, by2) / max(src_h, 1.0), 4),
                round(max(bx1, bx2) / max(src_w, 1.0), 4),
                round(max(by1, by2) / max(src_h, 1.0), 4),
            ]
            hotspots.append({
                "id": f"io_missing_{tag_str}_{len(hotspots)}",
                "tag": tag_str,
                "type": "MISSING_IN_IO",
                "priority": "P2",
                "priority_label": "P2 - Missing in DCS I/O List",
                "rule": "MISSING_IN_IO_LIST",
                "message": f"Physical {tag_entry.get('type', 'component')} '{tag_str}' on sheet lacks registered DCS I/O channel.",
                "recommendation": "Assign available DCS controller I/O point to this field device.",
                "bbox": [float(bx1), float(by1), float(bx2), float(by2)],
                "normalized_bbox": norm_bbox,
                "page": page_number,
            })

    # 3. Type & Signal Mismatches (e.g. Analog transmitter configured as Digital Input)
    type_mismatches = report_data.get("type_mismatches", [])
    for tm in type_mismatches:
        tag_str = tm.get("tag", "")
        tag_entry = tags_map.get(tag_str.upper()) or tags_map.get(tag_str.upper().replace("-", ""))
        if tag_entry and tag_entry.get("page", 1) == page_number and tag_entry.get("bbox"):
            bx1, by1, bx2, by2 = tag_entry["bbox"]
            norm_bbox = [
                round(min(bx1, bx2) / max(src_w, 1.0), 4),
                round(min(by1, by2) / max(src_h, 1.0), 4),
                round(max(bx1, bx2) / max(src_w, 1.0), 4),
                round(max(by1, by2) / max(src_h, 1.0), 4),
            ]
            hotspots.append({
                "id": f"sig_mismatch_{tag_str}_{len(hotspots)}",
                "tag": tag_str,
                "type": "SIGNAL_MISMATCH",
                "priority": "P2",
                "priority_label": "P2 - Signal Type Mismatch",
                "rule": "SIGNAL_TYPE_MISMATCH",
                "message": f"Drawing indicates '{tm.get('drawing_type')}', but DCS registers '{tm.get('io_signal')}'.",
                "recommendation": "Correct signal type in DCS marshalling database.",
                "bbox": [float(bx1), float(by1), float(bx2), float(by2)],
                "normalized_bbox": norm_bbox,
                "page": page_number,
            })

    return hotspots


def generate_error_overlay(
    bg_img: np.ndarray,
    page_number: int,
    report_data: Dict[str, Any],
    perception_dict: Optional[Dict[str, Any]] = None,
    resolved_tags: Optional[List[Dict[str, Any]]] = None,
    out_path: Optional[str] = None
) -> np.ndarray:
    """
    Render a high-resolution visual error overlay directly onto the input P&ID diagram.
    Highlights:
      - P1 Critical Safety Hazards (Vivid Red glow, corner reticles, actionable badge)
      - P2 Operational Hazards (Vivid Amber/Orange glow, corner reticles)
      - Missing in DCS IO List (Coral/Red-Orange marker)
      - Signal Type Mismatches (Magenta marker)
      - Missing in Blueprint (Floating HUD warning drawer at top of sheet)
      - Clean Engineering Legend Bar at bottom
    """
    img = bg_img.copy()
    target_h, target_w = img.shape[:2]

    # Resolve dimensions of source perception drawing
    src_w = float(target_w)
    src_h = float(target_h)
    if perception_dict:
        pages = perception_dict.get("pages", [])
        page_perc = next((p for p in pages if p.get("page_number") == page_number), None)
        if page_perc:
            src_w = float(page_perc.get("width", src_w))
            src_h = float(page_perc.get("height", src_h))

    # Extract all hotspots for this page
    hotspots = extract_error_hotspots(
        page_number=page_number,
        report_data=report_data,
        perception_dict=perception_dict,
        resolved_tags=resolved_tags,
        src_w=src_w,
        src_h=src_h
    )

    # Layer 1: Semi-transparent tinted highlight boxes
    overlay_mask = img.copy()

    for h in hotspots:
        x1, y1, x2, y2 = map_coords(h["bbox"], src_w, src_h, target_w, target_h)
        htype = h["type"]

        if htype == "P1_CRITICAL":
            # Vivid Red (BGR)
            fill_color = (50, 50, 245)
        elif htype == "P2_WARNING":
            # Vivid Amber / Orange
            fill_color = (0, 165, 255)
        elif htype == "MISSING_IN_IO":
            # Red-Orange / Coral
            fill_color = (40, 100, 255)
        elif htype == "SIGNAL_MISMATCH":
            # Magenta / Violet
            fill_color = (210, 60, 210)
        else:
            # Indigo / Purple
            fill_color = (220, 120, 110)

        cv2.rectangle(overlay_mask, (x1, y1), (x2, y2), fill_color, -1)

    # Blend semi-transparent highlight layer (22% alpha)
    cv2.addWeighted(overlay_mask, 0.22, img, 0.78, 0, img)

    # Layer 2: Sharp high-visibility borders, corner reticles, and badge pills
    for h in hotspots:
        x1, y1, x2, y2 = map_coords(h["bbox"], src_w, src_h, target_w, target_h)
        htype = h["type"]

        if htype == "P1_CRITICAL":
            border_color = (45, 45, 235)    # Vivid Red
            badge_text = f"P1 CRITICAL: {h['tag']} | {h['rule']}"
            thickness = 3
        elif htype == "P2_WARNING":
            border_color = (0, 160, 245)    # Amber
            badge_text = f"P2 WARNING: {h['tag']} | {h['rule']}"
            thickness = 3
        elif htype == "MISSING_IN_IO":
            border_color = (30, 95, 245)    # Red-Orange
            badge_text = f"MISSING IN IO: {h['tag']}"
            thickness = 3
        elif htype == "SIGNAL_MISMATCH":
            border_color = (200, 50, 200)   # Magenta
            badge_text = f"SIGNAL MISMATCH: {h['tag']}"
            thickness = 3
        else:
            border_color = (200, 110, 100)  # Indigo
            badge_text = f"AUDIT: {h['tag']}"
            thickness = 2

        # Draw outer bounding box
        cv2.rectangle(img, (x1, y1), (x2, y2), border_color, thickness)

        # Draw CAD corner target reticles
        _draw_corner_reticles(img, x1, y1, x2, y2, border_color, thickness=thickness + 1, length=14)

        # Draw floating badge pill
        _draw_badge_pill(
            img,
            x1, y1, x2,
            text=badge_text,
            border_color=border_color,
            bg_color=(20, 18, 25),
            text_color=(255, 255, 255),
            font_scale=0.42
        )

    # Layer 3: HUD Card for Missing in Blueprint Components (Tags in IO list, missing from drawing)
    missing_in_draw = report_data.get("missing_in_drawing", [])
    if missing_in_draw:
        hud_x1 = 28
        hud_y1 = 28
        hud_w = min(680, target_w - 56)
        line_count = min(len(missing_in_draw), 4)
        hud_h = 36 + line_count * 22 + 10
        hud_x2 = hud_x1 + hud_w
        hud_y2 = hud_y1 + hud_h

        # Semi-transparent dark ruby HUD background
        hud_overlay = img.copy()
        cv2.rectangle(hud_overlay, (hud_x1, hud_y1), (hud_x2, hud_y2), (18, 14, 30), -1)
        cv2.addWeighted(hud_overlay, 0.90, img, 0.10, 0, img)

        # Crisp Red/White border
        cv2.rectangle(img, (hud_x1, hud_y1), (hud_x2, hud_y2), (50, 50, 235), 2)

        # Header title
        header_text = f"P&ID DISCREPANCY: {len(missing_in_draw)} COMPONENT(S) MISSING IN BLUEPRINT"
        cv2.putText(
            img,
            header_text,
            (hud_x1 + 14, hud_y1 + 22),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.50,
            (60, 80, 255),
            2,
            cv2.LINE_AA
        )

        # List missing items
        cur_y = hud_y1 + 44
        for item in missing_in_draw[:4]:
            tag_name = item.get("io_tag", "UNKNOWN")
            desc = item.get("description", "Defined in DCS IO List, absent on sheet.")
            # Trim description if too long
            if len(desc) > 58:
                desc = desc[:55] + "..."
            item_str = f" [X] {tag_name}: {desc}"
            cv2.putText(
                img,
                item_str,
                (hud_x1 + 14, cur_y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.40,
                (240, 240, 255),
                1,
                cv2.LINE_AA
            )
            cur_y += 22

    # Layer 4: Clean Engineering Legend Bar at Bottom Left
    leg_x1 = 28
    leg_y1 = target_h - 48
    leg_w = min(820, target_w - 56)
    leg_h = 32
    leg_x2 = leg_x1 + leg_w
    leg_y2 = leg_y1 + leg_h

    leg_overlay = img.copy()
    cv2.rectangle(leg_overlay, (leg_x1, leg_y1), (leg_x2, leg_y2), (18, 20, 25), -1)
    cv2.addWeighted(leg_overlay, 0.88, img, 0.12, 0, img)
    cv2.rectangle(img, (leg_x1, leg_y1), (leg_x2, leg_y2), (70, 75, 85), 1)

    legend_items = [
        ("P1 Critical", (45, 45, 235)),
        ("P2 Warning", (0, 160, 245)),
        ("Missing in IO", (30, 95, 245)),
        ("Signal Mismatch", (200, 50, 200)),
        ("Missing in Blueprint", (255, 60, 80)),
    ]
    cur_lx = leg_x1 + 16
    for name, color in legend_items:
        cv2.rectangle(img, (cur_lx, leg_y1 + 9), (cur_lx + 12, leg_y1 + 21), color, -1)
        cv2.rectangle(img, (cur_lx, leg_y1 + 9), (cur_lx + 12, leg_y1 + 21), (255, 255, 255), 1)
        cv2.putText(
            img,
            name,
            (cur_lx + 18, leg_y1 + 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.38,
            (225, 230, 240),
            1,
            cv2.LINE_AA
        )
        cur_lx += 150

    if out_path:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        cv2.imwrite(out_path, img)

    return img
