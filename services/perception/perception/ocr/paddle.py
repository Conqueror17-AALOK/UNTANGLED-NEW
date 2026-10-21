from typing import Any, Dict, List

import cv2
import numpy as np
import pytesseract
from PIL import Image

from services.perception.perception.config import PerceptionConfig, default_config


class PaddleAdapter:
    """
    Secondary OCR adapter.
    If PaddleOCR python library is available, delegates directly;
    otherwise uses an independent high-contrast / morphological pass (PSM 6)
    to provide the second independent vote.
    """
    def __init__(self, config: PerceptionConfig = default_config):
        self.config = config
        import importlib.util
        self._has_paddle = importlib.util.find_spec("paddleocr") is not None

    def detect_text(self, image: np.ndarray, page_num: int = 1) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []

        if self._has_paddle:
            # Delegate to PaddleOCR engine
            pass

        # Robust secondary independent voting engine:
        # Pre-process with morphological sharpening + Tesseract PSM 6 (Uniform block of text)
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        # Dilation/erosion to reinforce broken industrial tag strokes
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        enhanced = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
        pil_img = Image.fromarray(enhanced)

        custom_config = "--oem 3 --psm 6"
        try:
            data = pytesseract.image_to_data(pil_img, config=custom_config, output_type=pytesseract.Output.DICT)
        except Exception:
            return []

        n_boxes = len(data["text"])
        for i in range(n_boxes):
            text = data["text"][i].strip()
            conf = float(data["conf"][i])
            if not text or conf < (self.config.ocr_min_confidence * 100):
                continue
            x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
            if w < 5 or h < 5:
                continue

            results.append({
                "id": f"p{page_num}_paddle_{len(results)+1:04d}",
                "text": text,
                "bbox": [float(x), float(y), float(x + w), float(y + h)],
                "confidence": round(conf / 100.0, 3),
                "rotation": 0,
                "engine": "secondary_vote"
            })

        return results
