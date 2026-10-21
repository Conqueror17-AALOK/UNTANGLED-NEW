import math
from typing import List

import cv2
import numpy as np

from services.perception.perception.models import LineSegment


class ArrowDetector:
    def detect_arrowheads(
        self,
        binary_image: np.ndarray,
        lines: List[LineSegment]
    ) -> List[LineSegment]:
        """
        Detect directional flow arrowheads on process lines and assign arrow_direction.
        """
        inv = cv2.bitwise_not(binary_image)
        contours, _ = cv2.findContours(inv, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

        arrow_centers = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if not (15.0 <= area <= 600.0):
                continue
            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.08 * peri, True)
            # Arrowheads are triangular contours with 3 vertices
            if len(approx) == 3:
                m = cv2.moments(cnt)
                if m["m00"] > 0:
                    cx = m["m10"] / m["m00"]
                    cy = m["m01"] / m["m00"]
                    arrow_centers.append((cx, cy))

        # Associate detected arrowheads with closest process line segment
        for line in lines:
            if line.line_type != "process":
                continue
            p1, p2 = line.points[0], line.points[1]
            line_len = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
            if line_len <= 0:
                continue

            for ac in arrow_centers:
                # Distance from point to line segment
                dist = abs((p2[1] - p1[1]) * ac[0] - (p2[0] - p1[0]) * ac[1] + p2[0] * p1[1] - p2[1] * p1[0]) / line_len
                if dist < 12.0:
                    # Check projection along line
                    proj = ((ac[0] - p1[0]) * (p2[0] - p1[0]) + (ac[1] - p1[1]) * (p2[1] - p1[1])) / (line_len ** 2)
                    if 0.0 <= proj <= 1.0:
                        line.arrow_direction = "forward"
                        break

        return lines
