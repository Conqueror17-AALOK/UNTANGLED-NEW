import json
import os
import sys
import uuid
from typing import List, Optional

import cv2
import numpy as np

from services.perception.perception.config import PerceptionConfig, default_config
from services.perception.perception.lines.arrows import ArrowDetector
from services.perception.perception.lines.crossings import CrossingDetector
from services.perception.perception.lines.detector import LineDetector
from services.perception.perception.models import (
    LineSegment,
    PagePerception,
    PerceptionOutput,
    SymbolItem,
    TextItem,
)
from services.perception.perception.ocr.paddle import PaddleAdapter
from services.perception.perception.ocr.tesseract import TesseractAdapter
from services.perception.perception.ocr.vote import vote_ocr_results
from services.perception.perception.offpage import OffPageConnectorDetector
from services.perception.perception.pdf_reader import PDFReader
from services.perception.perception.preprocess import Preprocessor
from services.perception.perception.symbols.bubbles import BubbleDetector
from services.perception.perception.symbols.matcher import SymbolMatcher


def generate_debug_overlay(
    bg_image: np.ndarray,
    page: PagePerception,
    out_path: str
) -> None:
    """
    Render visual debug overlay showing all detected text, symbols, ports, lines and crossings.
    Cyan: Text boxes
    Green: Equipment / Tanks / Pumps
    Orange: Control and manual valves
    Yellow: Instrument bubbles
    Blue: Process lines
    Magenta: Signal / Electrical lines
    Red dots: Connection junctions
    Purple: Off-page connectors
    """
    overlay = bg_image.copy()
    if len(overlay.shape) == 2:
        overlay = cv2.cvtColor(overlay, cv2.COLOR_GRAY2BGR)

    # 1. Draw Lines
    for line in page.line_segments:
        p1 = (int(line.points[0][0]), int(line.points[0][1]))
        p2 = (int(line.points[1][0]), int(line.points[1][1]))
        color = (255, 120, 0) if line.line_type == "process" else (255, 0, 255)
        thickness = 2 if line.line_type == "process" else 1
        cv2.line(overlay, p1, p2, color, thickness)
        if line.arrow_direction == "forward":
            mid = ((p1[0] + p2[0]) // 2, (p1[1] + p2[1]) // 2)
            cv2.circle(overlay, mid, 4, (0, 165, 255), -1)

    # 2. Draw Crossings & Junctions
    for c in page.crossings:
        pt = (int(c.point[0]), int(c.point[1]))
        if c.is_junction:
            cv2.circle(overlay, pt, 5, (0, 0, 255), -1)  # Red junction dot
        else:
            cv2.circle(overlay, pt, 5, (255, 255, 255), 1)  # White jump ring

    # 3. Draw Symbols & Ports
    for sym in page.symbols:
        x1, y1, x2, y2 = [int(v) for v in sym.bbox]
        if "valve" in sym.symbol_class:
            color = (0, 140, 255)  # Orange
        elif sym.symbol_class == "instrument_bubble":
            color = (0, 255, 255)  # Yellow
        else:
            color = (0, 200, 0)    # Green

        cv2.rectangle(overlay, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            overlay,
            f"{sym.symbol_class} ({sym.confidence:.2f})",
            (x1, max(y1 - 6, 15)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,
            color,
            1
        )

        # Draw Ports
        for port in sym.ports:
            px, py = int(port[0]), int(port[1])
            cv2.circle(overlay, (px, py), 4, (0, 255, 0), -1)

    # 4. Draw Off-Page Connectors
    for opc in page.off_page_connectors:
        x1, y1, x2, y2 = [int(v) for v in opc.bbox]
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (200, 0, 200), 2)
        cv2.putText(
            overlay,
            f"OPC: {opc.label}",
            (x1, max(y1 - 6, 15)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,
            (200, 0, 200),
            1
        )

    # 5. Draw Text Bounding Boxes
    for t in page.text_items:
        x1, y1, x2, y2 = [int(v) for v in t.bbox]
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (255, 255, 0), 1)  # Cyan

    cv2.imwrite(out_path, overlay)

def run_perception(
    pdf_path: str,
    out_dir: str,
    job_id: Optional[str] = None,
    config: PerceptionConfig = default_config
) -> PerceptionOutput:
    """
    Main perception pipeline entrypoint.
    Processes P&ID drawing, performs symbol, line, crossing, text detection,
    generates perception.json and per-page debug overlays.
    """
    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    os.makedirs(out_dir, exist_ok=True)
    active_job_id = job_id or str(uuid.uuid4())

    pdf_reader = PDFReader(config)
    preprocessor = Preprocessor(config)
    tess_adapter = TesseractAdapter(config)
    paddle_adapter = PaddleAdapter(config)
    symbol_matcher = SymbolMatcher(config=config)
    bubble_detector = BubbleDetector(config)
    line_detector = LineDetector(config)
    crossing_detector = CrossingDetector(config)
    arrow_detector = ArrowDetector()
    opc_detector = OffPageConnectorDetector(config)

    doc = pdf_reader.open_pdf(pdf_path)
    pages_output: List[PagePerception] = []

    for page_idx in range(len(doc)):
        page_num = page_idx + 1
        page = doc[page_idx]

        # 1. Determine vector vs scanned
        is_vector = pdf_reader.is_vector_pdf(page)

        # 2. Render 300 DPI image & Preprocess
        raster_img, orig_w, orig_h = pdf_reader.render_page(page)
        deskewed_img, binary_mask, _ = preprocessor.process(raster_img)

        # 3. Extract Text (Vector preferred + OCR voting fallback)
        text_items: List[TextItem] = []
        if is_vector:
            # Vector text extraction directly from PyMuPDF
            v_text = pdf_reader.extract_vector_text(page, page_num)
            # Scale vector coordinates to raster coordinates if needed
            scale_x = raster_img.shape[1] / max(orig_w, 1.0)
            scale_y = raster_img.shape[0] / max(orig_h, 1.0)
            for t in v_text:
                t.bbox = [
                    round(t.bbox[0] * scale_x, 2),
                    round(t.bbox[1] * scale_y, 2),
                    round(t.bbox[2] * scale_x, 2),
                    round(t.bbox[3] * scale_y, 2)
                ]
            text_items.extend(v_text)

        # Run dual OCR if text is sparse or to catch non-vector text
        if len(text_items) < config.vector_text_threshold:
            res_tess = tess_adapter.detect_rotated_text(deskewed_img, page_num)
            res_sec = paddle_adapter.detect_text(deskewed_img, page_num)
            voted_ocr = vote_ocr_results(res_tess, res_sec, page_num, config)
            text_items.extend(voted_ocr)

        # 4. Detect Symbols
        symbols: List[SymbolItem] = []
        # Multi-scale OpenCV template matching
        gray = preprocessor.to_grayscale(deskewed_img)
        matched_symbols = symbol_matcher.match_symbols(gray, page_num)
        symbols.extend(matched_symbols)

        # Contour-based instrument bubbles
        detected_bubbles = bubble_detector.detect_bubbles(binary_mask, page_num, text_items)
        symbols.extend(detected_bubbles)

        # 5. Detect Lines
        line_segments: List[LineSegment] = []
        if is_vector:
            vector_drawings = pdf_reader.extract_vector_drawings(page)
            v_lines = line_detector.extract_from_vector(vector_drawings, page_num)
            # Scale coordinates
            scale_x = raster_img.shape[1] / max(orig_w, 1.0)
            scale_y = raster_img.shape[0] / max(orig_h, 1.0)
            for line_seg in v_lines:
                line_seg.points = [
                    [round(line_seg.points[0][0] * scale_x, 2), round(line_seg.points[0][1] * scale_y, 2)],
                    [round(line_seg.points[1][0] * scale_x, 2), round(line_seg.points[1][1] * scale_y, 2)]
                ]
            line_segments.extend(v_lines)

        # Hough fallback if vector lines are absent
        if not line_segments:
            hough_lines = line_detector.detect_lines_hough(binary_mask, page_num)
            line_segments.extend(hough_lines)

        # 6. Directional Arrowheads on lines
        line_segments = arrow_detector.detect_arrowheads(binary_mask, line_segments)

        # 7. Crossings vs Junctions
        crossings = crossing_detector.detect_crossings(line_segments, binary_mask)

        # 8. Off-Page Connectors
        off_page_connectors = opc_detector.detect_connectors(binary_mask, page_num, text_items)

        # Build Page Perception object
        page_perception = PagePerception(
            page_number=page_num,
            width=float(raster_img.shape[1]),
            height=float(raster_img.shape[0]),
            is_vector=is_vector,
            text_items=text_items,
            symbols=symbols,
            line_segments=line_segments,
            crossings=crossings,
            off_page_connectors=off_page_connectors
        )
        pages_output.append(page_perception)

        # Generate debug overlay
        overlay_path = os.path.join(out_dir, f"debug_overlay_page_{page_num}.png")
        generate_debug_overlay(deskewed_img, page_perception, overlay_path)

    doc.close()

    output = PerceptionOutput(
        job_id=active_job_id,
        source_file=pdf_path,
        total_pages=len(pages_output),
        pages=pages_output
    )

    # Write perception.json
    json_path = os.path.join(out_dir, "perception.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output.model_dump(by_alias=True), f, indent=2)

    return output

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python -m services.perception.perception.run <pdf_path> <out_dir>")
        sys.exit(1)

    pdf_in = sys.argv[1]
    dir_out = sys.argv[2]
    result = run_perception(pdf_in, dir_out)
    print(f"Successfully processed {pdf_in} -> {os.path.join(dir_out, 'perception.json')}")
