"""
Florence-2 Vision-Language Model Configuration for P&ID Diagrams.
Defines task prompts, coordinate quantization/de-quantization, and engineering templates.
"""

import re
from typing import List, Tuple

# Florence-2 Standard Task Prompts
TASK_OD = "<OD>"                                # Object Detection
TASK_DENSE_REGION_CAPTION = "<DENSE_REGION_CAPTION>"  # Bounding boxes + descriptions
TASK_REGION_PROPOSAL = "<REGION_PROPOSAL>"      # General region proposals
TASK_CAPTION_TO_PHRASE_GROUNDING = "<CAPTION_TO_PHRASE_GROUNDING>"  # Locate text query in image
TASK_DETAILED_CAPTION = "<DETAILED_CAPTION>"    # Overall diagram visual summary

# Regex for extracting coordinate tokens <loc_Y1><loc_X1><loc_Y2><loc_X2>
LOC_PATTERN = re.compile(r"<loc_(\d+)>")


def quantize_box(bbox: List[float], width: float, height: float) -> str:
    """
    Convert absolute pixel coordinates [x1, y1, x2, y2] to Florence-2 token format:
    <loc_{y1}><loc_{x1}><loc_{y2}><loc_{x2}> with values in [0, 999].
    Note: Florence-2 standard sequence is [ymin, xmin, ymax, xmax].
    """
    x1, y1, x2, y2 = bbox
    q_x1 = max(0, min(999, int(round((x1 / max(width, 1.0)) * 999))))
    q_y1 = max(0, min(999, int(round((y1 / max(height, 1.0)) * 999))))
    q_x2 = max(0, min(999, int(round((x2 / max(width, 1.0)) * 999))))
    q_y2 = max(0, min(999, int(round((y2 / max(height, 1.0)) * 999))))

    return f"<loc_{q_y1}><loc_{q_x1}><loc_{q_y2}><loc_{q_x2}>"


def dequantize_box(coords: List[int], width: float, height: float) -> List[int]:
    """
    Convert Florence-2 [ymin, xmin, ymax, xmax] in [0, 999] back to pixel coordinates [x1, y1, x2, y2].
    """
    ymin, xmin, ymax, xmax = coords
    x1 = int(round((xmin / 999.0) * width))
    y1 = int(round((ymin / 999.0) * height))
    x2 = int(round((xmax / 999.0) * width))
    y2 = int(round((ymax / 999.0) * height))

    return [x1, y1, x2, y2]


def format_dense_target(annotations: List[dict], width: float, height: float) -> str:
    """
    Format a list of annotations into Florence-2 target string:
    label1<loc_y1><loc_x1><loc_y2><loc_x2>label2<loc_y1><loc_x1><loc_y2><loc_x2>
    """
    chunks = []
    for ann in annotations:
        desc = ann["description"]
        box_str = quantize_box(ann["bbox"], width, height)
        chunks.append(f"{desc}{box_str}")
    return "".join(chunks)
