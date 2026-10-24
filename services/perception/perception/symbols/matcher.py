import os
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

from services.perception.perception.config import PerceptionConfig, default_config
from services.perception.perception.models import SymbolItem, TextItem
from services.perception.perception.tiling import generate_tiles, map_tile_bbox_to_page, nms_bboxes


class SymbolMatcher:
    """
    Symbol detector supporting both fine-tuned YOLO11 local inference
    and OpenCV multi-scale template matching fallback.
    """

    def __init__(
        self,
        template_dir: str = "services/perception/perception/symbols/templates",
        model_path: Optional[str] = None,
        config: PerceptionConfig = default_config,
    ):
        self.config = config
        self.template_dir = template_dir
        self.templates: Dict[str, np.ndarray] = {}
        self._load_templates()

        self.model_path = model_path or config.yolo_model_path
        self.yolo_detector = None
        self._init_yolo()

    def _init_yolo(self) -> None:
        if self.model_path and os.path.exists(self.model_path):
            try:
                from services.perception.perception.yolo.detector import YOLOSymbolDetector
                self.yolo_detector = YOLOSymbolDetector(
                    model_path=self.model_path,
                    conf_thresh=self.config.yolo_conf_thresh,
                )
            except Exception:
                self.yolo_detector = None

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
        cx = round(x1 + w / 2.0, 2)
        cy = round(y1 + h / 2.0, 2)

        # Instruments (ISA-5.1: 4 cardinal connection ports)
        if "instrument" in sym_class:
            return [
                [cx, round(y2, 2)],  # bottom
                [cx, round(y1, 2)],  # top
                [round(x1, 2), cy],  # left
                [round(x2, 2), cy],  # right
            ]

        # Diaphragm Control Valve (process line + top actuator port)
        elif sym_class in ("valve_control", "valve_control_diaphragm"):
            return [
                [round(x1, 2), round(y1 + h * 0.70, 2)],
                [round(x2, 2), round(y1 + h * 0.70, 2)],
                [cx, round(y1, 2)],
            ]

        # Safety / Relief Valve (inlet bottom, outlet right)
        elif sym_class in ("safety_valve", "valve_safety_psv"):
            return [
                [cx, round(y2, 2)],
                [round(x2, 2), round(y1 + h * 0.60, 2)],
            ]

        # Inline valves (gate, globe, check, ball, butterfly, manual)
        elif "valve" in sym_class or sym_class in ("check_valve", "filter"):
            return [
                [round(x1, 2), cy],
                [round(x2, 2), cy],
            ]

        # Pipe reducer & orifice plate
        elif sym_class in ("reducer", "orifice_plate"):
            return [
                [round(x1, 2), cy],
                [round(x2, 2), cy],
            ]

        # Flange
        elif sym_class == "flange":
            return [[cx, cy]]

        # Centrifugal Pump (suction on left, discharge on top)
        elif sym_class in ("pump", "pump_centrifugal"):
            return [
                [round(x1, 2), cy],
                [cx, round(y1, 2)],
            ]

        # Tank / Vessel
        elif sym_class in ("tank", "tank_vessel"):
            return [
                [cx, round(y1, 2)],
                [cx, round(y2, 2)],
            ]

        # Heat Exchanger
        elif sym_class == "heat_exchanger":
            return [
                [round(x1, 2), cy],
                [round(x2, 2), cy],
                [cx, round(y1, 2)],
                [cx, round(y2, 2)],
            ]

        # Default fallback
        return [[cx, cy]]

    def match_symbols(
        self,
        image: np.ndarray,
        page_num: int = 1,
        text_items: Optional[List[TextItem]] = None,
    ) -> List[SymbolItem]:
        """
        Primary symbol detection entrypoint.
        Prefers YOLO11 fine-tuned model; falls back to multi-scale template matching.
        """
        if self.yolo_detector is not None:
            try:
                yolo_results = self._match_symbols_yolo(image, page_num, text_items)
                if yolo_results:
                    return yolo_results
            except Exception:
                pass

        gray = image if len(image.shape) == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return self._match_symbols_template(gray, page_num)

    def _match_symbols_yolo(
        self,
        image: np.ndarray,
        page_num: int = 1,
        text_items: Optional[List[TextItem]] = None,
    ) -> List[SymbolItem]:
        """
        Execute YOLO11 symbol detection with tiling support for high-res P&ID sheets.
        """
        # Ensure 3-channel BGR for YOLO
        if len(image.shape) == 2:
            bgr_img = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        else:
            bgr_img = image

        img_h, img_w = bgr_img.shape[:2]
        raw_items: List[Dict[str, Any]] = []

        # Tile if image exceeds 800px on either dimension
        if img_w > 800 or img_h > 800:
            tiles = generate_tiles((img_h, img_w), tile_size=(640, 640), overlap=96)
            for tile in tiles:
                crop = bgr_img[tile["y1"]:tile["y2"], tile["x1"]:tile["x2"]]
                detections = self.yolo_detector.detect(crop)
                for det in detections:
                    global_bbox = map_tile_bbox_to_page(
                        [float(v) for v in det.bbox], tile
                    )
                    raw_items.append({
                        "class": det.class_name,
                        "bbox": global_bbox,
                        "confidence": det.confidence,
                        "det_obj": det,
                    })
        else:
            detections = self.yolo_detector.detect(bgr_img)
            for det in detections:
                raw_items.append({
                    "class": det.class_name,
                    "bbox": [float(v) for v in det.bbox],
                    "confidence": det.confidence,
                    "det_obj": det,
                })

        # Apply NMS across tile boundaries
        filtered = nms_bboxes(raw_items, iou_threshold=0.35)

        symbol_items: List[SymbolItem] = []
        for idx, item in enumerate(filtered, 1):
            bbox = item["bbox"]
            cls_name = item["class"]
            ports = self._calculate_ports(cls_name, bbox)

            meta: Dict[str, Any] = {
                "detector": "yolo11",
                "is_instrument": "instrument" in cls_name,
                "is_valve": "valve" in cls_name,
            }

            # Map any text items located inside instrument symbol bubbles
            if text_items and "instrument" in cls_name:
                x1, y1, x2, y2 = bbox
                inside_texts = []
                for t in text_items:
                    tx1, ty1, tx2, ty2 = t.bbox
                    tcx, tcy = (tx1 + tx2) / 2.0, (ty1 + ty2) / 2.0
                    if x1 <= tcx <= x2 and y1 <= tcy <= y2:
                        inside_texts.append(t.text)
                if inside_texts:
                    meta["text_inside"] = " ".join(inside_texts)

            symbol_items.append(
                SymbolItem(
                    id=f"p{page_num}_yolo_{idx:04d}",
                    symbol_class=cls_name,
                    bbox=bbox,
                    confidence=round(item["confidence"], 3),
                    ports=ports,
                    metadata=meta,
                )
            )

        return symbol_items

    def _match_symbols_template(
        self,
        gray_image: np.ndarray,
        page_num: int = 1,
    ) -> List[SymbolItem]:
        """
        Multi-scale template matching across all loaded symbol templates.
        """
        raw_matches: List[Dict[str, Any]] = []

        for sym_class, tpl in self.templates.items():
            if sym_class == "instrument_bubble":
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
                        "confidence": round(score, 3),
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
                    metadata={"detector": "template_matcher"},
                )
            )

        return symbol_items
