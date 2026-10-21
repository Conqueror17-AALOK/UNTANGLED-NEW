import math
from typing import Any, Dict, List, Literal

import cv2
import numpy as np

from services.perception.perception.config import PerceptionConfig, default_config
from services.perception.perception.models import LineSegment


class LineDetector:
    def __init__(self, config: PerceptionConfig = default_config):
        self.config = config

    def extract_from_vector(
        self,
        vector_drawings: List[Dict[str, Any]],
        page_num: int = 1
    ) -> List[LineSegment]:
        """
        Extract line segments directly from vector drawing paths when present.
        """
        lines: List[LineSegment] = []
        idx = 1

        for d in vector_drawings:
            items = d.get("items", [])
            is_dashed = d.get("is_dashed", False)
            line_type: Literal["process", "signal", "pneumatic", "electrical"] = "signal" if is_dashed else "process"

            for item in items:
                # item can be ('l', p1, p2) for line or ('re', rect) for rectangle
                if item[0] == "l":
                    p1 = [round(float(item[1].x), 2), round(float(item[1].y), 2)]
                    p2 = [round(float(item[2].x), 2), round(float(item[2].y), 2)]

                    length = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
                    if length < 8.0:
                        continue

                    lines.append(
                        LineSegment(
                            id=f"p{page_num}_line_v_{idx:04d}",
                            points=[p1, p2],
                            line_type=line_type,
                            arrow_direction="none"
                        )
                    )
                    idx += 1

        return lines

    def detect_lines_hough(
        self,
        binary_image: np.ndarray,
        page_num: int = 1
    ) -> List[LineSegment]:
        """
        Detect line segments in raster/scanned image using morphological filtering and HoughLinesP.
        """
        # Morphological line isolation
        inv = cv2.bitwise_not(binary_image)

        # Horizontal and vertical kernels to extract piping lines
        h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 1))
        v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 25))

        h_lines = cv2.morphologyEx(inv, cv2.MORPH_OPEN, h_kernel)
        v_lines = cv2.morphologyEx(inv, cv2.MORPH_OPEN, v_kernel)
        combined = cv2.bitwise_or(h_lines, v_lines)

        raw_hough = cv2.HoughLinesP(
            combined,
            rho=self.config.hough_rho,
            theta=np.radians(self.config.hough_theta_deg),
            threshold=self.config.hough_threshold,
            minLineLength=self.config.hough_min_line_length,
            maxLineGap=self.config.hough_max_line_gap
        )

        if raw_hough is None:
            return []

        segments: List[LineSegment] = []
        idx = 1

        for line in raw_hough:
            x1, y1, x2, y2 = line[0]
            # Analyze line type (dashed vs solid)
            length = math.hypot(x2 - x1, y2 - y1)
            if length < 10.0:
                continue

            # Sample profile along segment
            num_samples = max(int(length), 5)
            xs = np.linspace(x1, x2, num_samples, dtype=int)
            ys = np.linspace(y1, y2, num_samples, dtype=int)
            xs = np.clip(xs, 0, binary_image.shape[1] - 1)
            ys = np.clip(ys, 0, binary_image.shape[0] - 1)

            profile = inv[ys, xs]
            transitions = np.count_nonzero(np.diff(profile > 128))

            # High transition count along line implies dashed/signal line
            line_type: Literal["process", "signal", "pneumatic", "electrical"] = "signal" if transitions > 4 else "process"

            segments.append(
                LineSegment(
                    id=f"p{page_num}_line_r_{idx:04d}",
                    points=[[float(x1), float(y1)], [float(x2), float(y2)]],
                    line_type=line_type,
                    arrow_direction="none"
                )
            )
            idx += 1

        return segments
