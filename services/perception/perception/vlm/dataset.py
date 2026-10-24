"""
P&ID Vision-Language Grounding Dataset Generator for Florence-2.
Generates multi-modal training pairs with both spatial coordinates and technical engineering descriptions.
"""

import json
import os
import random
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np

from services.perception.perception.vlm.florence_config import (
    TASK_CAPTION_TO_PHRASE_GROUNDING,
    TASK_DENSE_REGION_CAPTION,
    TASK_OD,
    format_dense_target,
    quantize_box,
)


class PIDVLMDatasetGenerator:
    """
    Generates training data for Florence-2 fine-tuning on P&ID blueprints.
    Outputs images with corresponding prompt-target pairs.
    """

    def __init__(self, output_dir: str = "data/florence_dataset"):
        self.output_dir = output_dir
        self.img_dir = os.path.join(output_dir, "images")
        os.makedirs(self.img_dir, exist_ok=True)

        self.instrument_types = [
            ("PT", "pressure transmitter", "instrument_dcs"),
            ("FT", "flow transmitter", "instrument_dcs"),
            ("TT", "temperature transmitter", "instrument_field"),
            ("LT", "level transmitter", "instrument_dcs"),
            ("PI", "local pressure gauge indicator", "instrument_field"),
            ("TI", "temperature indicator dial", "instrument_field"),
            ("PSV", "pressure safety relief valve", "valve_safety_psv"),
        ]

        self.valve_types = [
            ("FCV", "pneumatic diaphragm flow control valve fail-close", "valve_control_diaphragm"),
            ("PCV", "pressure control valve diaphragm actuator fail-open", "valve_control_diaphragm"),
            ("HV", "manual isolation ball valve", "valve_ball"),
            ("MOV", "motor operated gate valve", "valve_gate"),
            ("NRV", "non-return check valve", "valve_check"),
        ]

        self.equipment_types = [
            ("P-101A", "centrifugal boiler feed water pump", "pump_centrifugal"),
            ("P-101B", "standby centrifugal hydrocarbon pump", "pump_centrifugal"),
            ("V-101", "vertical condensate separator vessel", "tank_vessel"),
            ("T-200", "atmospheric chemical storage tank", "tank_vessel"),
        ]

    def _draw_canvas(self, w: int = 640, h: int = 640) -> np.ndarray:
        img = np.ones((h, w, 3), dtype=np.uint8) * 255
        # Blueprint grid
        for x in range(0, w, 64):
            cv2.line(img, (x, 0), (x, h), (242, 242, 242), 1)
        for y in range(0, h, 64):
            cv2.line(img, (0, y), (w, y), (242, 242, 242), 1)
        return img

    def generate_sample(self, idx: int) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Generate a single synthetic P&ID image and its ground-truth annotations.
        """
        w, h = 640, 640
        img = self._draw_canvas(w, h)
        annotations: List[Dict[str, Any]] = []

        # 1. Main Process Pipe
        pipe_y = random.randint(180, 460)
        cv2.line(img, (30, pipe_y), (610, pipe_y), (0, 0, 0), 3)
        pipe_num = f"{random.choice([2, 3, 4, 6])}\"-P-{random.randint(101, 999)}-CS"
        cv2.putText(img, pipe_num, (200, pipe_y - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)

        # 2. Add an Equipment item
        eq_tag, eq_desc, eq_cls = random.choice(self.equipment_types)
        eq_x = random.randint(420, 520)
        eq_y = pipe_y - 50
        cv2.circle(img, (eq_x + 35, eq_y + 35), 32, (0, 0, 0), 2)
        cv2.line(img, (eq_x + 35, eq_y + 3), (eq_x + 35, eq_y - 25), (0, 0, 0), 2)
        cv2.putText(img, eq_tag, (eq_x + 10, eq_y + 40), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)
        annotations.append({
            "tag": eq_tag,
            "description": f"{eq_tag} {eq_desc}",
            "class_name": eq_cls,
            "bbox": [float(eq_x), float(eq_y - 25), float(eq_x + 70), float(eq_y + 70)],
        })

        # 3. Add 2 Control & Manual Valves
        for v_idx in range(2):
            v_tag_prefix, v_desc, v_cls = random.choice(self.valve_types)
            v_tag = f"{v_tag_prefix}-{random.randint(10, 99)}"
            vx = 80 + v_idx * 160
            vy = pipe_y
            # Draw valve body
            pts = np.array([[vx - 16, vy - 12], [vx - 16, vy + 12], [vx + 16, vy - 12], [vx + 16, vy + 12]], np.int32)
            cv2.polylines(img, [pts], True, (0, 0, 0), 2)

            bbox_top = vy - 15
            if "diaphragm" in v_cls:
                # Add actuator dome
                cv2.line(img, (vx, vy), (vx, vy - 20), (0, 0, 0), 2)
                cv2.ellipse(img, (vx, vy - 22), (18, 8), 0, 180, 360, (0, 0, 0), 2)
                bbox_top = vy - 32

            cv2.putText(img, v_tag, (vx - 18, vy + 28), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (0, 0, 0), 1)
            annotations.append({
                "tag": v_tag,
                "description": f"{v_tag} {v_desc}",
                "class_name": v_cls,
                "bbox": [float(vx - 22), float(bbox_top), float(vx + 22), float(vy + 34)],
            })

        # 4. Add 2 Instruments with signal lines
        for i_idx in range(2):
            i_prefix, i_desc, i_cls = random.choice(self.instrument_types)
            i_num = random.randint(101, 399)
            i_tag = f"{i_prefix}-{i_num}"
            ix = 140 + i_idx * 180
            iy = pipe_y - 120
            # Impulse / signal line
            cv2.line(img, (ix, pipe_y), (ix, iy + 22), (0, 0, 0), 1)
            # Instrument bubble
            cv2.circle(img, (ix, iy), 22, (0, 0, 0), 2)
            if "dcs" in i_cls:
                cv2.line(img, (ix - 22, iy), (ix + 22, iy), (0, 0, 0), 2)

            cv2.putText(img, i_prefix, (ix - 12, iy - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 0), 1)
            cv2.putText(img, str(i_num), (ix - 12, iy + 14), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 0), 1)

            annotations.append({
                "tag": i_tag,
                "description": f"{i_tag} {i_desc}",
                "class_name": i_cls,
                "bbox": [float(ix - 24), float(iy - 24), float(ix + 24), float(iy + 24)],
            })

        # 5. Add a Reducer
        rx = 340
        ry = pipe_y
        pts_red = np.array([[rx - 12, ry - 14], [rx - 12, ry + 14], [rx + 12, ry + 8], [rx + 12, ry - 8]], np.int32)
        cv2.polylines(img, [pts_red], True, (0, 0, 0), 2)
        annotations.append({
            "tag": "3x2",
            "description": "3x2 inch concentric pipe reducer fitting",
            "class_name": "reducer",
            "bbox": [float(rx - 14), float(ry - 16), float(rx + 14), float(ry + 16)],
        })

        img_filename = f"pid_vlm_{idx:04d}.png"
        img_path = os.path.join(self.img_dir, img_filename)
        cv2.imwrite(img_path, img)

        return img_filename, annotations

    def generate_dataset(self, num_samples: int = 50) -> str:
        """
        Generate complete vision-language dataset and write JSON annotations.
        """
        samples: List[Dict[str, Any]] = []

        for i in range(num_samples):
            img_file, annotations = self.generate_sample(i)
            w, h = 640.0, 640.0

            # 1. Dense region caption target
            dense_target = format_dense_target(annotations, w, h)

            # 2. Object detection target
            od_chunks = []
            for ann in annotations:
                box_str = quantize_box(ann["bbox"], w, h)
                od_chunks.append(f"{ann['class_name']}{box_str}")
            od_target = "".join(od_chunks)

            # 3. Phrase grounding examples for each tag
            grounding_examples = []
            for ann in annotations:
                grounding_examples.append({
                    "query": ann["tag"],
                    "target": f"{ann['tag']}{quantize_box(ann['bbox'], w, h)}"
                })

            samples.append({
                "image": img_file,
                "width": 640,
                "height": 640,
                "annotations": annotations,
                "tasks": {
                    TASK_DENSE_REGION_CAPTION: dense_target,
                    TASK_OD: od_target,
                    TASK_CAPTION_TO_PHRASE_GROUNDING: grounding_examples,
                }
            })

        out_json = os.path.join(self.output_dir, "dataset.json")
        with open(out_json, "w", encoding="utf-8") as f:
            json.dump(samples, f, indent=2)

        return out_json


if __name__ == "__main__":
    gen = PIDVLMDatasetGenerator()
    path = gen.generate_dataset(num_samples=40)
    print(f"Generated {40} Florence-2 P&ID VLM samples at: {path}")
