from typing import Any, Dict, List, Literal, Tuple

import fitz  # PyMuPDF
import numpy as np
from PIL import Image

from services.perception.perception.config import PerceptionConfig, default_config
from services.perception.perception.models import TextItem


class PDFReader:
    def __init__(self, config: PerceptionConfig = default_config):
        self.config = config

    def open_pdf(self, pdf_path: str) -> fitz.Document:
        return fitz.open(pdf_path)

    def is_vector_pdf(self, page: fitz.Page) -> bool:
        """
        Check if the page has digital vector content (drawings and embedded text)
        or is purely a scanned bitmap image.
        """
        text = page.get_text("text").strip()
        drawings = page.get_drawings()
        has_text = len(text) > self.config.vector_text_threshold
        has_vector_paths = len(drawings) > 5
        return has_text or has_vector_paths

    def extract_vector_text(self, page: fitz.Page, page_num: int) -> List[TextItem]:
        """
        Extract embedded vector text blocks with exact bounding boxes and high confidence.
        """
        text_items: List[TextItem] = []
        words = page.get_text("words")  # (x0, y0, x1, y1, word, block_no, line_no, word_no)

        idx = 1
        for w in words:
            word_str = str(w[4]).strip()
            if not word_str:
                continue

            bbox = [round(float(w[0]), 2), round(float(w[1]), 2), round(float(w[2]), 2), round(float(w[3]), 2)]

            # Rotation check from rect if available
            rotation: Literal[0, 90, 180, 270] = 0

            text_items.append(
                TextItem(
                    id=f"p{page_num}_txt_v_{idx:04d}",
                    text=word_str,
                    bbox=bbox,
                    ocr_confidence=0.99,
                    rotation=rotation,
                    source="vector"
                )
            )
            idx += 1

        return text_items

    def extract_vector_drawings(self, page: fitz.Page) -> List[Dict[str, Any]]:
        """
        Extract vector line segments, curves, and rectangles directly from the PDF DOM.
        """
        drawings = page.get_drawings()
        extracted: List[Dict[str, Any]] = []

        for d in drawings:
            rect = [round(float(x), 2) for x in d["rect"]]
            items = d.get("items", [])
            stroke_color = d.get("color")
            fill_color = d.get("fill")
            width = d.get("width", 1.0)
            dashes = d.get("dashes")

            extracted.append({
                "rect": rect,
                "items": items,
                "stroke_color": stroke_color,
                "fill_color": fill_color,
                "width": width,
                "is_dashed": bool(dashes)
            })

        return extracted

    def render_page(self, page: fitz.Page) -> Tuple[np.ndarray, float, float]:
        """
        Render page to a 300 DPI numpy RGB image array.
        Returns: (image_array, width, height)
        """
        zoom = self.config.render_dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)

        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        np_img = np.array(img)

        return np_img, float(page.rect.width), float(page.rect.height)
