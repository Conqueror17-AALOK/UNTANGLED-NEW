"""
Florence-2 Vision-Language Grounding Interface for P&ID Diagrams.
Simultaneously extracts precise bounding box coordinates and rich technical descriptions.
"""

from dataclasses import dataclass
import os
import re
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from PIL import Image

from services.perception.perception.vlm.florence_config import (
    TASK_CAPTION_TO_PHRASE_GROUNDING,
    TASK_DENSE_REGION_CAPTION,
    TASK_OD,
    dequantize_box,
)


@dataclass
class VLMRegion:
    description: str
    label: str
    bbox: List[int]       # [x1, y1, x2, y2] in pixels
    center: List[int]     # [cx, cy]
    confidence: float
    is_instrument: bool
    is_valve: bool
    is_equipment: bool


class Florence2VLM:
    """
    Vision-Language Model engine for P&ID diagrams powered by Microsoft Florence-2.
    Grounds technical tags, equipment, and instrument descriptions to visual coordinates.
    """

    def __init__(self, model_dir: str = "models/florence2", device: Optional[str] = None):
        self.model_dir = model_dir
        self.processor = None
        self.model = None

        if device is None:
            try:
                import torch
                self.device = "mps" if torch.backends.mps.is_available() else "cpu"
            except ImportError:
                self.device = "cpu"
        else:
            self.device = device

    def load_model(self) -> None:
        """Lazy load Florence-2 processor and neural weights."""
        if self.model is not None:
            return

        import torch
        from transformers import AutoModelForCausalLM, AutoProcessor

        self.processor = AutoProcessor.from_pretrained(self.model_dir, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_dir,
            torch_dtype=torch.float32,
            trust_remote_code=True,
        ).to(self.device)
        self.model.eval()

    def _prepare_image(self, image: np.ndarray) -> Image.Image:
        """Convert numpy array (BGR/Gray) to PIL RGB image."""
        if len(image.shape) == 2:
            rgb = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        else:
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb)

    def dense_caption_and_ground(self, image: np.ndarray) -> List[VLMRegion]:
        """
        Extract both visual coordinates and rich technical descriptions for all diagram symbols.
        """
        self.load_model()
        pil_img = self._prepare_image(image)
        img_w, img_h = pil_img.size

        prompt = TASK_DENSE_REGION_CAPTION
        inputs = self.processor(text=prompt, images=pil_img, return_tensors="pt").to(self.device)

        import torch
        with torch.no_grad():
            generated_ids = self.model.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=512,
                num_beams=3,
                do_sample=False,
            )

        generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
        parsed = self.processor.post_process_generation(
            generated_text,
            task=prompt,
            image_size=(img_w, img_h)
        )

        regions: List[VLMRegion] = []
        result_dict = parsed.get(TASK_DENSE_REGION_CAPTION, {})
        bboxes = result_dict.get("bboxes", [])
        labels = result_dict.get("labels", [])

        for bbox, label in zip(bboxes, labels):
            x1, y1, x2, y2 = [int(v) for v in bbox]
            cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
            lbl_lower = label.lower()

            regions.append(
                VLMRegion(
                    description=label,
                    label=label.split()[0] if label else "unknown",
                    bbox=[x1, y1, x2, y2],
                    center=[cx, cy],
                    confidence=0.92,
                    is_instrument="transmitter" in lbl_lower or "gauge" in lbl_lower or "instrument" in lbl_lower,
                    is_valve="valve" in lbl_lower,
                    is_equipment="pump" in lbl_lower or "vessel" in lbl_lower or "tank" in lbl_lower,
                )
            )

        return regions

    def ground_query(self, image: np.ndarray, text_query: str) -> List[VLMRegion]:
        """
        Locate the visual coordinates of an engineering tag or component by description.
        e.g. text_query = "PT-101 pressure transmitter"
        """
        self.load_model()
        pil_img = self._prepare_image(image)
        img_w, img_h = pil_img.size

        prompt = f"{TASK_CAPTION_TO_PHRASE_GROUNDING} {text_query}"
        inputs = self.processor(text=prompt, images=pil_img, return_tensors="pt").to(self.device)

        import torch
        with torch.no_grad():
            generated_ids = self.model.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=256,
                num_beams=3,
                do_sample=False,
            )

        generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
        parsed = self.processor.post_process_generation(
            generated_text,
            task=TASK_CAPTION_TO_PHRASE_GROUNDING,
            image_size=(img_w, img_h)
        )

        regions: List[VLMRegion] = []
        result_dict = parsed.get(TASK_CAPTION_TO_PHRASE_GROUNDING, {})
        bboxes = result_dict.get("bboxes", [])
        labels = result_dict.get("labels", [])

        for bbox, label in zip(bboxes, labels):
            x1, y1, x2, y2 = [int(v) for v in bbox]
            cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
            lbl_lower = label.lower()

            regions.append(
                VLMRegion(
                    description=label or text_query,
                    label=text_query,
                    bbox=[x1, y1, x2, y2],
                    center=[cx, cy],
                    confidence=0.95,
                    is_instrument="transmitter" in lbl_lower or "instrument" in lbl_lower,
                    is_valve="valve" in lbl_lower,
                    is_equipment="pump" in lbl_lower or "vessel" in lbl_lower,
                )
            )

        return regions

    def draw_regions(self, image: np.ndarray, regions: List[VLMRegion]) -> np.ndarray:
        """Render detection boxes and rich technical labels over image."""
        vis = image.copy()
        for r in regions:
            x1, y1, x2, y2 = r.bbox
            if r.is_instrument:
                color = (0, 215, 255)  # Gold/Amber
            elif r.is_valve:
                color = (0, 140, 255)  # Orange
            elif r.is_equipment:
                color = (0, 200, 50)   # Emerald
            else:
                color = (255, 120, 0)  # Blue

            cv2.rectangle(vis, (x1, y1), (x2, y2), color, 2)
            # Label banner
            label = r.description[:35]
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)
            cv2.rectangle(vis, (x1, max(0, y1 - th - 6)), (x1 + tw + 6, max(th + 6, y1)), color, -1)
            cv2.putText(vis, label, (x1 + 3, max(th, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 0), 1)

        return vis
