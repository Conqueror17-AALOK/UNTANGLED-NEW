from dataclasses import dataclass
from typing import Tuple


@dataclass(frozen=True)
class PerceptionConfig:
    # PDF rendering & Tiling
    render_dpi: int = 300
    tile_size: Tuple[int, int] = (1024, 1024)
    tile_overlap: int = 128
    vector_text_threshold: int = 5  # Min embedded text blocks to consider PDF vector

    # Preprocessing
    enable_deskew: bool = True
    max_deskew_angle: float = 15.0
    denoise_h: float = 10.0
    adaptive_block_size: int = 25
    adaptive_c: int = 10

    # OCR
    tesseract_oem: int = 3
    tesseract_psm: int = 11  # Sparse text with OSD
    ocr_min_confidence: float = 0.30
    ocr_iou_match_threshold: float = 0.50

    # Symbol detection
    template_match_threshold: float = 0.70
    template_scales: Tuple[float, ...] = (0.7, 0.85, 1.0, 1.15, 1.3)
    bubble_min_radius: int = 10
    bubble_max_radius: int = 80
    bubble_circularity_thresh: float = 0.75

    # Line detection
    hough_rho: float = 1.0
    hough_theta_deg: float = 1.0
    hough_threshold: int = 40
    hough_min_line_length: int = 25
    hough_max_line_gap: int = 10
    line_snap_tolerance_px: float = 15.0
    junction_dot_min_radius: int = 2
    junction_dot_max_radius: int = 8

    # Off-page connector
    opc_aspect_ratio_min: float = 1.5
    opc_aspect_ratio_max: float = 4.0

default_config = PerceptionConfig()
