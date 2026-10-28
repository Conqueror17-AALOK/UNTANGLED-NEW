"""
YOLO11 P&ID Symbol and Tiny-Part Detector.
Performs high-speed, high-accuracy inference on engineering blueprint tiles.
"""

import os
from dataclasses import dataclass
from typing import List, Optional, Tuple

import cv2
import numpy as np

from services.perception.perception.yolo.yolo_config import ID_TO_CLASS, PID_CLASSES


@dataclass
class DetectedSymbol:
    class_name: str
    class_id: int
    confidence: float
    bbox: List[int]      # [x1, y1, x2, y2] in pixels
    center: List[int]    # [cx, cy]
    is_instrument: bool
    is_valve: bool
    is_fitting: bool
    is_equipment: bool


class YOLOSymbolDetector:
    """
    Inference interface for trained YOLO11 engineering diagram symbol model.
    """

    def __init__(self, model_path: str = "models/yolo11_pid.pt", conf_thresh: float = 0.25):
        self.model_path = model_path
        self.conf_thresh = conf_thresh
        self.model = None

    def load_model(self):
        """Lazy load YOLO model to optimize startup time."""
        from ultralytics import YOLO

        if os.path.exists(self.model_path):
            self.model = YOLO(self.model_path)
        else:
            print(f"[YOLO Detector] Note: Custom weights '{self.model_path}' not found on disk. Falling back to base 'yolo11n.pt'.")
            self.model = YOLO("yolo11n.pt")


    def detect(self, image: np.ndarray) -> List[DetectedSymbol]:
        """
        Detect P&ID symbols in image tile or canvas.
        Returns list of DetectedSymbol dataclasses.
        """
        if self.model is None:
            self.load_model()

        results = self.model.predict(
            source=image,
            conf=self.conf_thresh,
            verbose=False,
            device="mps" if self._is_mps_available() else "cpu",
        )

        detected: List[DetectedSymbol] = []
        if not results:
            return detected

        r = results[0]
        boxes = r.boxes
        if boxes is None or len(boxes) == 0:
            return detected

        for box in boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            xyxy = [int(v) for v in box.xyxy[0].tolist()]
            cls_name = ID_TO_CLASS.get(cls_id, f"unknown_{cls_id}")

            x1, y1, x2, y2 = xyxy
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2

            detected.append(
                DetectedSymbol(
                    class_name=cls_name,
                    class_id=cls_id,
                    confidence=conf,
                    bbox=xyxy,
                    center=[cx, cy],
                    is_instrument="instrument" in cls_name,
                    is_valve="valve" in cls_name,
                    is_fitting=cls_name in ["flange", "reducer", "orifice_plate"],
                    is_equipment=cls_name in ["pump_centrifugal", "tank_vessel"],
                )
            )

        return detected

    def draw_detections(self, image: np.ndarray, detections: List[DetectedSymbol]) -> np.ndarray:
        """Render detection bounding boxes and class tags onto a copy of the image."""
        vis = image.copy()
        for det in detections:
            x1, y1, x2, y2 = det.bbox
            color = (0, 200, 100) if det.is_instrument else (255, 100, 0) if det.is_valve else (0, 160, 255)

            cv2.rectangle(vis, (x1, y1), (x2, y2), color, 2)
            label = f"{det.class_name} {det.confidence:.2f}"
            cv2.putText(vis, label, (x1, max(12, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.35, color, 1)

        return vis

    def _is_mps_available(self) -> bool:
        try:
            import torch
            return torch.backends.mps.is_available()
        except Exception:
            return False
