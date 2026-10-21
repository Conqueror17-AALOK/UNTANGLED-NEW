from typing import Any, Dict, List

from services.perception.perception.config import PerceptionConfig, default_config
from services.perception.perception.models import TextItem


def compute_iou(box_a: List[float], box_b: List[float]) -> float:
    xa = max(box_a[0], box_b[0])
    ya = max(box_a[1], box_b[1])
    xb = min(box_a[2], box_b[2])
    yb = min(box_a[3], box_b[3])
    inter_area = max(0.0, xb - xa) * max(0.0, yb - ya)
    area_a = max(0.0, box_a[2] - box_a[0]) * max(0.0, box_a[3] - box_a[1])
    area_b = max(0.0, box_b[2] - box_b[0]) * max(0.0, box_b[3] - box_b[1])
    union_area = area_a + area_b - inter_area
    return inter_area / union_area if union_area > 0 else 0.0

def vote_ocr_results(
    engine1_results: List[Dict[str, Any]],
    engine2_results: List[Dict[str, Any]],
    page_num: int = 1,
    config: PerceptionConfig = default_config
) -> List[TextItem]:
    """
    Vote and merge OCR outputs from two engines based on bounding box IoU and confidence scores.
    """
    voted_items: List[TextItem] = []
    matched_e2_indices = set()

    for item1 in engine1_results:
        box1 = item1["bbox"]
        best_match_idx = -1
        best_iou = 0.0

        for idx, item2 in enumerate(engine2_results):
            if idx in matched_e2_indices:
                continue
            iou = compute_iou(box1, item2["bbox"])
            if iou > best_iou:
                best_iou = iou
                best_match_idx = idx

        if best_iou >= config.ocr_iou_match_threshold and best_match_idx != -1:
            matched_e2_indices.add(best_match_idx)
            item2 = engine2_results[best_match_idx]

            # Compare text strings
            text1 = item1["text"]
            text2 = item2["text"]
            conf1 = item1["confidence"]
            conf2 = item2["confidence"]

            if text1.lower() == text2.lower():
                # Agreement boost
                chosen_text = text1
                final_conf = min(1.0, round((conf1 + conf2) / 2.0 + 0.12, 3))
            else:
                # Disagreement: pick higher confidence
                if conf1 >= conf2:
                    chosen_text = text1
                    final_conf = conf1
                else:
                    chosen_text = text2
                    final_conf = conf2

            voted_items.append(
                TextItem(
                    id=f"p{page_num}_txt_ocr_{len(voted_items)+1:04d}",
                    text=chosen_text,
                    bbox=box1,
                    ocr_confidence=final_conf,
                    rotation=item1.get("rotation", 0),
                    source="ocr"
                )
            )
        else:
            # Only Engine 1 detected it
            if item1["confidence"] >= config.ocr_min_confidence:
                voted_items.append(
                    TextItem(
                        id=f"p{page_num}_txt_ocr_{len(voted_items)+1:04d}",
                        text=item1["text"],
                        bbox=box1,
                        ocr_confidence=item1["confidence"],
                        rotation=item1.get("rotation", 0),
                        source="ocr"
                    )
                )

    # Remaining items detected only by Engine 2
    for idx, item2 in enumerate(engine2_results):
        if idx not in matched_e2_indices and item2["confidence"] >= config.ocr_min_confidence:
            voted_items.append(
                TextItem(
                    id=f"p{page_num}_txt_ocr_{len(voted_items)+1:04d}",
                    text=item2["text"],
                    bbox=item2["bbox"],
                    ocr_confidence=item2["confidence"],
                    rotation=item2.get("rotation", 0),
                    source="ocr"
                )
            )

    return voted_items
