import os
from typing import Any, Dict, List

import cv2
import numpy as np

from services.perception.perception.config import PerceptionConfig, default_config
from services.perception.perception.models import SymbolItem
from services.perception.perception.tiling import nms_bboxes


class SymbolMatcher:
    def __init__(
        self,
        template_dir: str = "services/perception/perception/symbols/templates",
        config: PerceptionConfig = default_config
    ):
        self.config = config
        self.template_dir = template_dir
        self.templates: Dict[str, np.ndarray] = {}
        self._load_templates()

    def _load_templates(self) -> None:
        if not os.path.exists(self.template_dir):
            return

        for filename in os.listdir(self.template_dir):
            if filename.endswith(".png"):
                sym_name = filename[:-4]
                path = os.path.join(self.template_dir, filename)
                tpl = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
                if tpl is not None:
                    self.templates[sym_name] = tpl

    def _calculate_ports(self, sym_class: str, bbox: List[float]) -> List[List[float]]:
        x1, y1, x2, y2 = bbox
        w = x2 - x1
        h = y2 - y1

        if sym_class in ("valve_manual", "check_valve", "filter"):
            return [
                [round(x1, 2), round(y1 + h / 2.0, 2)],
                [round(x2, 2), round(y1 + h / 2.0, 2)],
            ]
        elif sym_class == "valve_control":
            return [
                [round(x1, 2), round(y1 + h * 0.65, 2)],
                [round(x2, 2), round(y1 + h * 0.65, 2)],
                [round(x1 + w / 2.0, 2), round(y1, 2)],
            ]
        elif sym_class == "pump":
            return [
                [round(x1, 2), round(y1 + h / 2.0, 2)],
                [round(x1 + w / 2.0, 2), round(y1, 2)],
            ]
        elif sym_class == "tank":
            return [
                [round(x1 + w / 2.0, 2), round(y1, 2)],
                [round(x2, 2), round(y2 - 20.0, 2)],
            ]
        elif sym_class == "heat_exchanger":
            return [
                [round(x1, 2), round(y1 + h / 2.0, 2)],
                [round(x2, 2), round(y1 + h / 2.0, 2)],
                [round(x1 + w / 2.0, 2), round(y1, 2)],
                [round(x1 + w / 2.0, 2), round(y2, 2)],
            ]
        elif sym_class == "safety_valve":
            return [
                [round(x1, 2), round(y2 - 10.0, 2)],
                [round(x1 + w / 2.0, 2), round(y1, 2)],
            ]
        elif sym_class == "instrument_bubble":
            return [
                [round(x1 + w / 2.0, 2), round(y2, 2)]
            ]
        else:
            return [[round(x1 + w / 2.0, 2), round(y1 + h / 2.0, 2)]]

    def match_symbols(
        self,
        gray_image: np.ndarray,
        page_num: int = 1
    ) -> List[SymbolItem]:
        """
        Multi-scale template matching across all loaded symbol templates.
        """
        raw_matches: List[Dict[str, Any]] = []

        for sym_class, tpl in self.templates.items():
            if sym_class == "instrument_bubble":
                # Instrument bubbles are handled with contour geometry classifier in bubbles.py
                continue

            th, tw = tpl.shape[:2]

            for scale in self.config.template_scales:
                scaled_w = int(tw * scale)
                scaled_h = int(th * scale)
                if scaled_w >= gray_image.shape[1] or scaled_h >= gray_image.shape[0]:
                    continue
                if scaled_w < 10 or scaled_h < 10:
                    continue

                scaled_tpl = cv2.resize(tpl, (scaled_w, scaled_h), interpolation=cv2.INTER_AREA)
                res = cv2.matchTemplate(gray_image, scaled_tpl, cv2.TM_CCOEFF_NORMED)

                loc = np.where(res >= self.config.template_match_threshold)
                for pt in zip(*loc[::-1]):
                    score = float(res[pt[1], pt[0]])
                    x1, y1 = float(pt[0]), float(pt[1])
                    x2, y2 = x1 + scaled_w, y1 + scaled_h

                    raw_matches.append({
                        "class": sym_class,
                        "bbox": [x1, y1, x2, y2],
                        "confidence": round(score, 3)
                    })

        # Apply NMS
        filtered = nms_bboxes(raw_matches, iou_threshold=0.35)

        symbol_items: List[SymbolItem] = []
        for idx, m in enumerate(filtered, 1):
            bbox = m["bbox"]
            sym_class = m["class"]
            ports = self._calculate_ports(sym_class, bbox)

            symbol_items.append(
                SymbolItem(
                    id=f"p{page_num}_sym_{idx:04d}",
                    symbol_class=sym_class,
                    bbox=bbox,
                    confidence=m["confidence"],
                    ports=ports,
                    metadata={}
                )
            )

        return symbol_items
