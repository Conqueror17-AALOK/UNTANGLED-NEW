import math
from typing import List, Optional

import cv2
import numpy as np

from services.perception.perception.config import PerceptionConfig, default_config
from services.perception.perception.models import SymbolItem, TextItem


class BubbleDetector:
    def __init__(self, config: PerceptionConfig = default_config):
        self.config = config

    def detect_bubbles(
        self,
        binary_image: np.ndarray,
        page_num: int = 1,
        text_items: Optional[List[TextItem]] = None
    ) -> List[SymbolItem]:
        """
        Detect instrument bubbles (circular and square) via contour geometry,
        classify mounting type via internal line check, and assign connection ports.
        """
        # Invert so lines/shapes are white on black
        inv = cv2.bitwise_not(binary_image)
        contours, hierarchy = cv2.findContours(inv, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        bubbles: List[SymbolItem] = []
        idx = 1

        for cnt in contours:
            area = cv2.contourArea(cnt)
            perimeter = cv2.arcLength(cnt, True)
            if perimeter <= 0:
                continue

            circularity = 4.0 * math.pi * area / (perimeter * perimeter)
            x, y, w, h = cv2.boundingRect(cnt)
            radius = (w + h) / 4.0

            if not (self.config.bubble_min_radius <= radius <= self.config.bubble_max_radius):
                continue

            # Aspect ratio check
            aspect = float(w) / max(float(h), 1.0)
            if not (0.75 <= aspect <= 1.35):
                continue

            bubble_shape = "circle"
            is_bubble = False

            if circularity >= self.config.bubble_circularity_thresh:
                is_bubble = True
                bubble_shape = "circle"
            else:
                # Check polygon approximation for square / diamond bubble
                approx = cv2.approxPolyDP(cnt, 0.04 * perimeter, True)
                if len(approx) == 4:
                    is_bubble = True
                    bubble_shape = "square"

            if not is_bubble:
                continue

            # Check for horizontal internal line (ISA-5.1 panel-mounted vs field-mounted)
            cx, cy = x + w // 2, y + h // 2
            roi_y1 = max(0, cy - 3)
            roi_y2 = min(binary_image.shape[0], cy + 3)
            roi_x1 = max(0, cx - int(radius * 0.7))
            roi_x2 = min(binary_image.shape[1], cx + int(radius * 0.7))

            center_stripe = inv[roi_y1:roi_y2, roi_x1:roi_x2]
            has_line = bool(np.mean(center_stripe) > 60) if center_stripe.size > 0 else False

            # Port location: bottom of bubble [cx, y + h]
            ports = [[float(cx), float(y + h)]]

            # Find matching text inside bubble
            text_inside = ""
            if text_items:
                for t in text_items:
                    tx1, ty1, tx2, ty2 = t.bbox
                    tcx, tcy = (tx1 + tx2) / 2.0, (ty1 + ty2) / 2.0
                    if x <= tcx <= x + w and y <= tcy <= y + h:
                        text_inside = t.text if not text_inside else f"{text_inside} {t.text}"

            bubbles.append(
                SymbolItem(
                    id=f"p{page_num}_bubble_{idx:04d}",
                    symbol_class="instrument_bubble",
                    bbox=[float(x), float(y), float(x + w), float(y + h)],
                    confidence=round(min(1.0, max(0.85, circularity)), 3),
                    ports=ports,
                    metadata={
                        "bubble_shape": bubble_shape,
                        "has_line": has_line,
                        "text_inside": text_inside
                    }
                )
            )
            idx += 1

        return bubbles
