from typing import List, Optional

import cv2
import numpy as np

from services.perception.perception.config import PerceptionConfig, default_config
from services.perception.perception.models import OffPageConnector, TextItem


class OffPageConnectorDetector:
    def __init__(self, config: PerceptionConfig = default_config):
        self.config = config

    def detect_connectors(
        self,
        binary_image: np.ndarray,
        page_num: int = 1,
        text_items: Optional[List[TextItem]] = None
    ) -> List[OffPageConnector]:
        """
        Detect off-page connectors (e.g. pentagonal arrows or labeled boundary boxes)
        and extract target sheet destination.
        """
        inv = cv2.bitwise_not(binary_image)
        contours, _ = cv2.findContours(inv, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        connectors: List[OffPageConnector] = []
        idx = 1

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if not (150.0 <= area <= 15000.0):
                continue

            x, y, w, h = cv2.boundingRect(cnt)
            aspect = float(w) / max(float(h), 1.0)
            if not (self.config.opc_aspect_ratio_min <= aspect <= self.config.opc_aspect_ratio_max):
                continue

            # Polygon approximation
            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)

            # Off-page arrowheads often have 5 vertices (pentagon) or 4 (box)
            if len(approx) in (4, 5):
                # Search for label in enclosed text items
                label = ""
                target_sheet = None

                if text_items:
                    for t in text_items:
                        tx1, ty1, tx2, ty2 = t.bbox
                        tcx, tcy = (tx1 + tx2) / 2.0, (ty1 + ty2) / 2.0
                        if (x - 20) <= tcx <= (x + w + 20) and (y - 20) <= tcy <= (y + h + 20):
                            label = f"{label} {t.text}".strip()
                            upper = t.text.upper()
                            if "SHEET" in upper or "DWG" in upper or "UNIT" in upper or "P-" in upper:
                                target_sheet = t.text

                # If label contains directional keywords or has pentagon shape near boundary
                if any(k in label.upper() for k in ("TO", "FROM", "SHEET", "UNIT", "DWG")) or len(approx) == 5:
                    connector_label = label if label else f"OPC-{idx}"
                    connectors.append(
                        OffPageConnector(
                            id=f"p{page_num}_opc_{idx:04d}",
                            bbox=[float(x), float(y), float(x + w), float(y + h)],
                            label=connector_label,
                            target_sheet=target_sheet
                        )
                    )
                    idx += 1

        # Fallback / Augment: Detect text-based off-page connectors (e.g. TO SHEET 2, FROM SHEET 1)
        if text_items:
            for t in text_items:
                if t.text.upper() in ("TO", "FROM"):
                    nearby = [
                        other for other in text_items
                        if abs(other.bbox[1] - t.bbox[1]) < 200 and abs(other.bbox[0] - t.bbox[0]) < 400
                    ]
                    nearby_sorted = sorted(nearby, key=lambda o: (o.bbox[1], o.bbox[0]))
                    words = [o.text for o in nearby_sorted]
                    phrase = " ".join(words)
                    upper_phrase = phrase.upper()

                    if "SHEET" in upper_phrase:
                        # Extract target sheet
                        target_sheet = None
                        for w_idx, w in enumerate(words):
                            if w.upper() == "SHEET" and w_idx + 1 < len(words):
                                target_sheet = f"Sheet {words[w_idx + 1]}"

                        # Bounding box covering all cluster items
                        bx1 = min(o.bbox[0] for o in nearby_sorted)
                        by1 = min(o.bbox[1] for o in nearby_sorted)
                        bx2 = max(o.bbox[2] for o in nearby_sorted)
                        by2 = max(o.bbox[3] for o in nearby_sorted)

                        # Check if already added via contour
                        already_added = any(
                            abs(c.bbox[0] - bx1) < 100 and abs(c.bbox[1] - by1) < 100
                            for c in connectors
                        )
                        if not already_added:
                            connectors.append(
                                OffPageConnector(
                                    id=f"p{page_num}_opc_{idx:04d}",
                                    bbox=[float(bx1), float(by1), float(bx2), float(by2)],
                                    label=phrase,
                                    target_sheet=target_sheet
                                )
                            )
                            idx += 1

        return connectors
