from services.perception.perception.tiling import generate_tiles, map_tile_bbox_to_page, nms_bboxes


def test_generate_tiles():
    img_shape = (2000, 2000)
    tiles = generate_tiles(img_shape, tile_size=(1024, 1024), overlap=128)
    assert len(tiles) >= 4
    for t in tiles:
        assert t["x2"] <= 2000
        assert t["y2"] <= 2000
        assert t["x1"] >= 0
        assert t["y1"] >= 0

def test_map_tile_bbox():
    tile_coords = {"x1": 500, "y1": 600, "x2": 1524, "y2": 1624}
    local_box = [10.0, 20.0, 50.0, 80.0]
    mapped = map_tile_bbox_to_page(local_box, tile_coords)
    assert mapped == [510.0, 620.0, 550.0, 680.0]

def test_nms_bboxes():
    boxes = [
        {"bbox": [10.0, 10.0, 50.0, 50.0], "confidence": 0.95},
        {"bbox": [12.0, 11.0, 49.0, 52.0], "confidence": 0.80},  # Highly overlapping
        {"bbox": [200.0, 200.0, 250.0, 250.0], "confidence": 0.90}  # Non-overlapping
    ]
    kept = nms_bboxes(boxes, iou_threshold=0.5)
    assert len(kept) == 2
    assert kept[0]["confidence"] == 0.95
    assert kept[1]["confidence"] == 0.90
