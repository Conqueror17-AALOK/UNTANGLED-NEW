import math
from typing import List, Optional

import cv2
import numpy as np

from services.perception.perception.config import PerceptionConfig, default_config
from services.perception.perception.models import Crossing, LineSegment


def line_intersection(
    p1: List[float], p2: List[float], p3: List[float], p4: List[float]
) -> Optional[List[float]]:
    """Compute 2D line segment intersection point if it exists."""
    x1, y1 = p1
    x2, y2 = p2
    x3, y3 = p3
    x4, y4 = p4

    denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
    if abs(denom) < 1e-6:
        return None

    ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
    ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom

    if 0.0 <= ua <= 1.0 and 0.0 <= ub <= 1.0:
        ix = x1 + ua * (x2 - x1)
        iy = y1 + ua * (y2 - y1)
        return [round(ix, 2), round(iy, 2)]

    return None

class CrossingDetector:
    def __init__(self, config: PerceptionConfig = default_config):
        self.config = config

    def detect_crossings(
        self,
        lines: List[LineSegment],
        binary_image: Optional[np.ndarray] = None
    ) -> List[Crossing]:
        """
        Distinguish crossing (no connection / line jump) from junction (connection dot or T-branch).
        """
        crossings: List[Crossing] = []

        for i in range(len(lines)):
            l1 = lines[i]
            for j in range(i + 1, len(lines)):
                l2 = lines[j]

                pt = line_intersection(l1.points[0], l1.points[1], l2.points[0], l2.points[1])
                if not pt:
                    continue

                # Check if intersection is at endpoint (T-junction or corner)
                is_endpoint = False
                for p in (l1.points[0], l1.points[1], l2.points[0], l2.points[1]):
                    if math.hypot(p[0] - pt[0], p[1] - pt[1]) < self.config.line_snap_tolerance_px:
                        is_endpoint = True
                        break

                # If binary image is available, check for physical connection dot
                has_dot = False
                if binary_image is not None:
                    cx, cy = int(pt[0]), int(pt[1])
                    r_max = self.config.junction_dot_max_radius
                    y1 = max(0, cy - r_max)
                    y2 = min(binary_image.shape[0], cy + r_max)
                    x1 = max(0, cx - r_max)
                    x2 = min(binary_image.shape[1], cx + r_max)
                    patch = cv2.bitwise_not(binary_image[y1:y2, x1:x2])
                    # High pixel concentration near center implies a solid connection dot
                    if patch.size > 0 and np.mean(patch) > 180:
                        has_dot = True

                is_junction = is_endpoint or has_dot

                crossings.append(
                    Crossing(
                        point=pt,
                        is_junction=is_junction,
                        intersecting_lines=[l1.id, l2.id]
                    )
                )

        return crossings
