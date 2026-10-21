from services.perception.perception.config import default_config
from services.perception.perception.ocr.vote import compute_iou, vote_ocr_results


def test_compute_iou():
    box1 = [10.0, 10.0, 50.0, 50.0]
    box2 = [10.0, 10.0, 50.0, 50.0]
    assert compute_iou(box1, box2) == 1.0

    box3 = [100.0, 100.0, 150.0, 150.0]
    assert compute_iou(box1, box3) == 0.0

def test_vote_ocr_agreement():
    e1 = [{"bbox": [10, 10, 50, 30], "text": "PT-101", "confidence": 0.85, "rotation": 0}]
    e2 = [{"bbox": [11, 10, 49, 31], "text": "PT-101", "confidence": 0.88, "rotation": 0}]
    voted = vote_ocr_results(e1, e2, page_num=1, config=default_config)
    assert len(voted) == 1
    assert voted[0].text == "PT-101"
    assert voted[0].ocr_confidence >= 0.95  # boosted confidence on agreement

def test_vote_ocr_disagreement():
    e1 = [{"bbox": [10, 10, 50, 30], "text": "PT-101", "confidence": 0.92, "rotation": 0}]
    e2 = [{"bbox": [11, 10, 49, 31], "text": "PT10l", "confidence": 0.70, "rotation": 0}]
    voted = vote_ocr_results(e1, e2, page_num=1, config=default_config)
    assert len(voted) == 1
    assert voted[0].text == "PT-101"
