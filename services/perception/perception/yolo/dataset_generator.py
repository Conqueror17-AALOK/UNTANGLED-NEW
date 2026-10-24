"""
Synthetic & Benchmark P&ID Dataset Generator for YOLO11.
Renders authentic ISA-5.1 symbols, instrument bubbles, and piping details
with precise ground-truth bounding box labels in standard YOLO format.
"""

import math
import os
import random
from typing import List, Tuple

import cv2
import numpy as np
import yaml

from services.perception.perception.yolo.yolo_config import (
    CLASS_TO_ID,
    NUM_CLASSES,
    PID_CLASSES,
)


class PIDDatasetGenerator:
    def __init__(self, output_dir: str = "data/yolo_dataset", img_size: int = 640):
        self.output_dir = output_dir
        self.img_size = img_size
        self.bg_color = (255, 255, 255)  # Clean CAD white sheet
        self.line_color = (25, 25, 30)    # Deep technical dark ink
        self.signal_color = (40, 40, 50)  # Signal line ink

    def generate_dataset(
        self,
        num_train: int = 80,
        num_val: int = 20,
    ):
        """Generate complete YOLO training & validation splits."""
        for split, count in [("train", num_train), ("val", num_val)]:
            img_dir = os.path.join(self.output_dir, "images", split)
            lbl_dir = os.path.join(self.output_dir, "labels", split)
            os.makedirs(img_dir, exist_ok=True)
            os.makedirs(lbl_dir, exist_ok=True)

            print(f"Generating {count} synthetic P&ID tiles for '{split}' split...")
            for i in range(count):
                img, bboxes = self._generate_single_tile(seed=i + (1000 if split == "val" else 0))
                img_path = os.path.join(img_dir, f"pid_{split}_{i:04d}.png")
                lbl_path = os.path.join(lbl_dir, f"pid_{split}_{i:04d}.txt")

                cv2.imwrite(img_path, img)
                self._save_yolo_labels(lbl_path, bboxes)

        self._write_yaml()
        print(f"Dataset generation complete in '{self.output_dir}'!")

    def _save_yolo_labels(self, filepath: str, bboxes: List[Tuple[int, float, float, float, float]]):
        """Save bounding boxes in YOLO format: class x_center y_center width height."""
        with open(filepath, "w") as f:
            for cls_id, xc, yc, w, h in bboxes:
                # Clamp within [0, 1]
                xc = max(0.001, min(0.999, xc))
                yc = max(0.001, min(0.999, yc))
                w = max(0.002, min(0.999, w))
                h = max(0.002, min(0.999, h))
                f.write(f"{cls_id} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}\n")

    def _write_yaml(self):
        """Write YOLO dataset.yaml configuration file."""
        abs_output = os.path.abspath(self.output_dir)
        config = {
            "path": abs_output,
            "train": "images/train",
            "val": "images/val",
            "names": {idx: name for idx, name in enumerate(PID_CLASSES)},
            "nc": NUM_CLASSES,
        }
        yaml_path = os.path.join(self.output_dir, "dataset.yaml")
        with open(yaml_path, "w") as f:
            yaml.dump(config, f, default_flow_style=False)
        print(f"Saved dataset config to {yaml_path}")

    def _generate_single_tile(self, seed: int) -> Tuple[np.ndarray, List[Tuple[int, float, float, float, float]]]:
        """Draw an authentic P&ID tile with intersecting pipes, vessels, pumps, valves, and instruments."""
        random.seed(seed)
        np.random.seed(seed)

        img = np.full((self.img_size, self.img_size, 3), 255, dtype=np.uint8)
        bboxes: List[Tuple[int, float, float, float, float]] = []

        # 1. Draw Process Pipelines (Horizontal and Vertical grids)
        h_pipes = [random.randint(120, 520) for _ in range(random.randint(2, 4))]
        v_pipes = [random.randint(120, 520) for _ in range(random.randint(2, 4))]

        for y in h_pipes:
            cv2.line(img, (20, y), (self.img_size - 20, y), self.line_color, 2)
        for x in v_pipes:
            cv2.line(img, (x, 20), (x, self.img_size - 20), self.line_color, 2)

        # 2. Draw Major Equipment: Vessel or Centrifugal Pump
        if random.random() > 0.3:
            v_x = random.randint(80, self.img_size - 180)
            v_y = random.randint(150, 350)
            if random.random() > 0.5:
                # Vertical Vessel
                vw, vh = 60, 130
                cv2.rectangle(img, (v_x, v_y), (v_x + vw, v_y + vh), self.line_color, 2)
                cv2.ellipse(img, (v_x + vw // 2, v_y), (vw // 2, 14), 0, 180, 360, self.line_color, 2)
                cv2.ellipse(img, (v_x + vw // 2, v_y + vh), (vw // 2, 14), 0, 0, 180, self.line_color, 2)
                cv2.putText(img, f"V-{random.randint(101, 109)}", (v_x + 8, v_y + vh // 2 + 4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, self.line_color, 1)
                bboxes.append(self._to_yolo(CLASS_TO_ID["tank_vessel"], v_x, v_y - 14, vw, vh + 28))
            else:
                # Centrifugal Pump
                pr = 28
                cv2.circle(img, (v_x, v_y), pr, self.line_color, 2)
                # Impeller triangle inside
                pts = np.array([[v_x - 14, v_y + 14], [v_x + 14, v_y + 14], [v_x, v_y - 14]], np.int32)
                cv2.polylines(img, [pts], True, self.line_color, 1)
                # Discharge nozzle on top
                cv2.line(img, (v_x, v_y - pr), (v_x, v_y - pr - 18), self.line_color, 2)
                cv2.putText(img, f"P-{random.randint(101, 104)}A", (v_x - 22, v_y + pr + 16),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.35, self.line_color, 1)
                bboxes.append(self._to_yolo(CLASS_TO_ID["pump_centrifugal"], v_x - pr, v_y - pr - 18, pr * 2, pr * 2 + 18))

        # 3. Insert In-line Valves along Process Pipes
        valve_types = [
            "valve_gate", "valve_globe", "valve_check", "valve_ball",
            "valve_butterfly", "valve_control_diaphragm", "valve_safety_psv"
        ]

        placed_locations = []
        for _ in range(random.randint(4, 8)):
            # Pick a pipe
            if random.random() > 0.5 and h_pipes:
                py = random.choice(h_pipes)
                px = random.randint(60, self.img_size - 60)
            elif v_pipes:
                px = random.choice(v_pipes)
                py = random.randint(60, self.img_size - 60)
            else:
                continue

            if any(math.hypot(px - ox, py - oy) < 55 for ox, oy in placed_locations):
                continue
            placed_locations.append((px, py))

            v_type = random.choice(valve_types)
            cls_id = CLASS_TO_ID[v_type]
            self._draw_valve(img, px, py, v_type)
            bw, bh = (36, 42) if "control" in v_type or "safety" in v_type else (32, 24)
            bboxes.append(self._to_yolo(cls_id, px - bw // 2, py - bh // 2, bw, bh))

        # 4. Insert Micro-Parts (Flanges, Reducers, Orifice Plates)
        for _ in range(random.randint(2, 5)):
            if not h_pipes and not v_pipes:
                break
            is_horiz = random.random() > 0.5 and h_pipes
            px = random.randint(70, self.img_size - 70) if is_horiz else random.choice(v_pipes)
            py = random.choice(h_pipes) if is_horiz else random.randint(70, self.img_size - 70)

            if any(math.hypot(px - ox, py - oy) < 35 for ox, oy in placed_locations):
                continue
            placed_locations.append((px, py))

            part = random.choice(["flange", "reducer", "orifice_plate"])
            cls_id = CLASS_TO_ID[part]
            if part == "flange":
                # Double tick marks
                if is_horiz:
                    cv2.line(img, (px - 3, py - 9), (px - 3, py + 9), self.line_color, 2)
                    cv2.line(img, (px + 3, py - 9), (px + 3, py + 9), self.line_color, 2)
                else:
                    cv2.line(img, (px - 9, py - 3), (px + 9, py - 3), self.line_color, 2)
                    cv2.line(img, (px - 9, py + 3), (px + 9, py + 3), self.line_color, 2)
                bboxes.append(self._to_yolo(cls_id, px - 7, py - 11, 14, 22))
            elif part == "reducer":
                # Pipe reducer trapezoid
                pts = np.array([[px - 10, py - 8], [px + 10, py - 4], [px + 10, py + 4], [px - 10, py + 8]], np.int32)
                cv2.polylines(img, [pts], True, self.line_color, 2)
                bboxes.append(self._to_yolo(cls_id, px - 12, py - 10, 24, 20))
            else:
                # Orifice plate
                cv2.line(img, (px, py - 14), (px, py + 14), self.line_color, 2)
                cv2.circle(img, (px, py - 14), 2, self.line_color, -1)
                bboxes.append(self._to_yolo(cls_id, px - 5, py - 16, 10, 32))

        # 5. Insert Instrument Bubbles (Circles, DCS, Aux, Shared, Logic)
        inst_types = [
            "instrument_field", "instrument_dcs", "instrument_aux",
            "instrument_shared", "instrument_logic"
        ]
        var_codes = ["PT", "PI", "PSV", "TT", "TI", "FT", "FI", "LT", "LIC", "PIC"]

        for _ in range(random.randint(3, 7)):
            ix = random.randint(50, self.img_size - 50)
            iy = random.randint(50, self.img_size - 50)

            if any(math.hypot(ix - ox, iy - oy) < 45 for ox, oy in placed_locations):
                continue
            placed_locations.append((ix, iy))

            itype = random.choice(inst_types)
            cls_id = CLASS_TO_ID[itype]
            tag_code = random.choice(var_codes)
            tag_num = random.randint(101, 120)

            # Leader line to nearest pipe or vessel
            near_y = min(h_pipes, key=lambda y: abs(y - iy)) if h_pipes else iy + 30
            cv2.line(img, (ix, iy + 20), (ix, near_y), self.signal_color, 1, cv2.LINE_AA)

            # Draw instrument bubble
            radius = 18
            # Erase background
            cv2.circle(img, (ix, iy), radius + 2, (255, 255, 255), -1)

            if itype == "instrument_field":
                # Clean single circle
                cv2.circle(img, (ix, iy), radius, self.line_color, 2)
                cv2.putText(img, tag_code, (ix - 12, iy - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.32, self.line_color, 1)
                cv2.putText(img, str(tag_num), (ix - 11, iy + 10), cv2.FONT_HERSHEY_SIMPLEX, 0.30, self.line_color, 1)
                bboxes.append(self._to_yolo(cls_id, ix - radius, iy - radius, radius * 2, radius * 2))

            elif itype == "instrument_dcs":
                # Circle with solid horizontal divider line
                cv2.circle(img, (ix, iy), radius, self.line_color, 2)
                cv2.line(img, (ix - radius, iy), (ix + radius, iy), self.line_color, 2)
                cv2.putText(img, tag_code, (ix - 12, iy - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.30, self.line_color, 1)
                cv2.putText(img, str(tag_num), (ix - 11, iy + 11), cv2.FONT_HERSHEY_SIMPLEX, 0.30, self.line_color, 1)
                bboxes.append(self._to_yolo(cls_id, ix - radius, iy - radius, radius * 2, radius * 2))

            elif itype == "instrument_aux":
                # Circle with dashed horizontal line
                cv2.circle(img, (ix, iy), radius, self.line_color, 2)
                for dx in range(-radius + 2, radius - 2, 6):
                    cv2.line(img, (ix + dx, iy), (ix + dx + 3, iy), self.line_color, 1)
                cv2.putText(img, tag_code, (ix - 12, iy - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.30, self.line_color, 1)
                cv2.putText(img, str(tag_num), (ix - 11, iy + 11), cv2.FONT_HERSHEY_SIMPLEX, 0.30, self.line_color, 1)
                bboxes.append(self._to_yolo(cls_id, ix - radius, iy - radius, radius * 2, radius * 2))

            elif itype == "instrument_shared":
                # Square enclosing circle
                s = 20
                cv2.rectangle(img, (ix - s, iy - s), (ix + s, iy + s), self.line_color, 2)
                cv2.circle(img, (ix, iy), radius - 2, self.line_color, 1)
                cv2.putText(img, tag_code, (ix - 11, iy - 1), cv2.FONT_HERSHEY_SIMPLEX, 0.30, self.line_color, 1)
                cv2.putText(img, str(tag_num), (ix - 10, iy + 10), cv2.FONT_HERSHEY_SIMPLEX, 0.28, self.line_color, 1)
                bboxes.append(self._to_yolo(cls_id, ix - s, iy - s, s * 2, s * 2))

            elif itype == "instrument_logic":
                # Diamond inside square
                s = 20
                cv2.rectangle(img, (ix - s, iy - s), (ix + s, iy + s), self.line_color, 2)
                pts = np.array([[ix, iy - s + 3], [ix + s - 3, iy], [ix, iy + s - 3], [ix - s + 3, iy]], np.int32)
                cv2.polylines(img, [pts], True, self.line_color, 1)
                cv2.putText(img, "ESD", (ix - 9, iy + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.30, self.line_color, 1)
                bboxes.append(self._to_yolo(cls_id, ix - s, iy - s, s * 2, s * 2))

        # Add subtle engineering scan noise (slight grain and blur to mimic blueprints)
        noise = np.random.normal(0, 3, img.shape).astype(np.int16)
        noisy_img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

        return noisy_img, bboxes

    def _draw_valve(self, img: np.ndarray, x: int, y: int, valve_type: str):
        """Draw valve geometry based on ISA-5.1 standards."""
        w, h = 26, 16
        # Clear background behind valve
        cv2.rectangle(img, (x - w // 2 - 2, y - h // 2 - 2), (x + w // 2 + 2, y + h // 2 + 2), (255, 255, 255), -1)

        # Standard two opposed triangles (Hourglass)
        pts_left = np.array([[x - w // 2, y - h // 2], [x, y], [x - w // 2, y + h // 2]], np.int32)
        pts_right = np.array([[x + w // 2, y - h // 2], [x, y], [x + w // 2, y + h // 2]], np.int32)
        cv2.polylines(img, [pts_left], True, self.line_color, 2)
        cv2.polylines(img, [pts_right], True, self.line_color, 2)

        if valve_type == "valve_globe":
            cv2.circle(img, (x, y), 3, self.line_color, -1)
        elif valve_type == "valve_check":
            cv2.line(img, (x - 6, y - 5), (x + 6, y + 5), self.line_color, 2)
        elif valve_type == "valve_ball":
            cv2.circle(img, (x, y), 4, self.line_color, 1)
        elif valve_type == "valve_butterfly":
            cv2.line(img, (x - 8, y + 8), (x + 8, y - 8), self.line_color, 2)
        elif valve_type == "valve_control_diaphragm":
            # Stem and diaphragm dome
            cv2.line(img, (x, y), (x, y - 14), self.line_color, 2)
            cv2.ellipse(img, (x, y - 14), (12, 7), 0, 180, 360, self.line_color, 2)
            cv2.line(img, (x - 12, y - 14), (x + 12, y - 14), self.line_color, 2)
        elif valve_type == "valve_safety_psv":
            # Angular outlet and spring top
            cv2.line(img, (x, y), (x, y - 16), self.line_color, 2)
            cv2.rectangle(img, (x - 6, y - 24), (x + 6, y - 16), self.line_color, 2)
            cv2.line(img, (x, y), (x + 16, y), self.line_color, 2)

    def _to_yolo(self, cls_id: int, x: int, y: int, w: int, h: int) -> Tuple[int, float, float, float, float]:
        """Convert pixel bounding box to YOLO normalized format."""
        xc = (x + w / 2.0) / self.img_size
        yc = (y + h / 2.0) / self.img_size
        norm_w = w / float(self.img_size)
        norm_h = h / float(self.img_size)
        return (cls_id, xc, yc, norm_w, norm_h)


if __name__ == "__main__":
    generator = PIDDatasetGenerator(output_dir="data/yolo_dataset", img_size=640)
    generator.generate_dataset(num_train=80, num_val=20)
