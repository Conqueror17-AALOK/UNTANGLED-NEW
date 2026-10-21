from typing import Any, Dict, List, Tuple


def generate_tiles(
    image_shape: Tuple[int, int],
    tile_size: Tuple[int, int] = (1024, 1024),
    overlap: int = 128
) -> List[Dict[str, int]]:
    """
    Generate coordinate windows for overlapping tiles over an image.
    Returns list of dicts: {"x1": ..., "y1": ..., "x2": ..., "y2": ...}
    """
    img_h, img_w = image_shape[:2]
    tile_w, tile_h = tile_size
    step_x = max(tile_w - overlap, 64)
    step_y = max(tile_h - overlap, 64)

    tiles = []
    y = 0
    while y < img_h:
        y2 = min(y + tile_h, img_h)
        y1 = max(0, y2 - tile_h)
        x = 0
        while x < img_w:
            x2 = min(x + tile_w, img_w)
            x1 = max(0, x2 - tile_w)
            tiles.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2})
            if x2 >= img_w:
                break
            x += step_x
        if y2 >= img_h:
            break
        y += step_y

    return tiles

def map_tile_bbox_to_page(
    tile_bbox: List[float],
    tile_coords: Dict[str, int]
) -> List[float]:
    """Map a bounding box from local tile coordinates to full page image coordinates."""
    tx1, ty1 = tile_coords["x1"], tile_coords["y1"]
    return [
        round(tile_bbox[0] + tx1, 2),
        round(tile_bbox[1] + ty1, 2),
        round(tile_bbox[2] + tx1, 2),
        round(tile_bbox[3] + ty1, 2),
    ]

def nms_bboxes(
    items: List[Dict[str, Any]],
    iou_threshold: float = 0.5
) -> List[Dict[str, Any]]:
    """Non-maximum suppression for overlapping bounding boxes across tiles."""
    if not items:
        return []

    # Sort items by confidence descending
    sorted_items = sorted(items, key=lambda k: k.get("confidence", 0.0), reverse=True)
    kept: List[Dict[str, Any]] = []

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

    for item in sorted_items:
        box = item["bbox"]
        overlap = False
        for k in kept:
            if compute_iou(box, k["bbox"]) > iou_threshold:
                overlap = True
                break
        if not overlap:
            kept.append(item)

    return kept
