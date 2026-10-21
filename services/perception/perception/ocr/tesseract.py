from typing import Any, Dict, List

import cv2
import numpy as np
import pytesseract
from PIL import Image

from services.perception.perception.config import PerceptionConfig, default_config


class TesseractAdapter:
    def __init__(self, config: PerceptionConfig = default_config):
        self.config = config

    def detect_text(self, image: np.ndarray, page_num: int = 1) -> List[Dict[str, Any]]:
        """
        Run Tesseract OCR with detailed box coordinates, text, and confidence.
        """
        # Convert image to PIL
        if len(image.shape) == 2:
            pil_img = Image.fromarray(image)
        else:
            pil_img = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

        custom_config = f"--oem {self.config.tesseract_oem} --psm {self.config.tesseract_psm}"

        try:
            data = pytesseract.image_to_data(pil_img, config=custom_config, output_type=pytesseract.Output.DICT)
        except Exception:
            # If tesseract command fails or not found in PATH
            return []

        results: List[Dict[str, Any]] = []
        n_boxes = len(data["text"])

        for i in range(n_boxes):
            text = data["text"][i].strip()
            conf = float(data["conf"][i])

            # Filter low confidence and empty text
            if not text or conf < (self.config.ocr_min_confidence * 100):
                continue

            x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]

            # Filter out tiny specks
            if w < 5 or h < 5:
                continue

            results.append({
                "id": f"p{page_num}_tess_{len(results)+1:04d}",
                "text": text,
                "bbox": [float(x), float(y), float(x + w), float(y + h)],
                "confidence": round(conf / 100.0, 3),
                "rotation": 0,
                "engine": "tesseract"
            })

        return results

    def detect_rotated_text(self, image: np.ndarray, page_num: int = 1) -> List[Dict[str, Any]]:
        """
        Handle rotated vertical text tags (e.g., 90-degree rotated line tags).
        """
        all_results = self.detect_text(image, page_num)

        # Check 90 degree clockwise rotation for vertical tags
        rot_90 = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
        res_90 = self.detect_text(rot_90, page_num)

        h_orig, w_orig = image.shape[:2]
        for item in res_90:
            rx1, ry1, rx2, ry2 = item["bbox"]
            # Map back from 90 deg clockwise: x_orig = y_rot, y_orig = w_orig - x_rot
            orig_x1 = ry1
            orig_y1 = h_orig - rx2
            orig_x2 = ry2
            orig_y2 = h_orig - rx1
            item["bbox"] = [round(orig_x1, 2), round(orig_y1, 2), round(orig_x2, 2), round(orig_y2, 2)]
            item["rotation"] = 90
            all_results.append(item)

        return all_results
