from services.perception.perception.lines.crossings import CrossingDetector, line_intersection
from services.perception.perception.models import LineSegment


def test_line_intersection():
    p1 = [0.0, 50.0]
    p2 = [100.0, 50.0]
    p3 = [50.0, 0.0]
    p4 = [50.0, 100.0]
    pt = line_intersection(p1, p2, p3, p4)
    assert pt == [50.0, 50.0]

def test_crossing_detector():
    detector = CrossingDetector()
    l1 = LineSegment(id="l1", points=[[0, 50], [100, 50]], line_type="process", arrow_direction="none")
    l2 = LineSegment(id="l2", points=[[50, 0], [50, 100]], line_type="process", arrow_direction="none")
    crossings = detector.detect_crossings([l1, l2])
    assert len(crossings) == 1
    assert crossings[0].point == [50.0, 50.0]
    assert "l1" in crossings[0].intersecting_lines
    assert "l2" in crossings[0].intersecting_lines

def test_t_junction_detection():
    detector = CrossingDetector()
    l1 = LineSegment(id="l1", points=[[0, 50], [100, 50]], line_type="process", arrow_direction="none")
    l2 = LineSegment(id="l2", points=[[50, 50], [50, 100]], line_type="process", arrow_direction="none")
    crossings = detector.detect_crossings([l1, l2])
    assert len(crossings) == 1
    assert crossings[0].is_junction is True


def test_offpage_connector_detection():
    import numpy as np
    from services.perception.perception.models import TextItem
    from services.perception.perception.offpage import OffPageConnectorDetector

    detector = OffPageConnectorDetector()
    dummy_mask = np.zeros((200, 200), dtype=np.uint8)
    text_items = [
        TextItem(id="t1", text="TO", bbox=[4000.0, 1650.0, 4050.0, 1700.0], ocr_confidence=0.98),
        TextItem(id="t2", text="SHEET", bbox=[4060.0, 1650.0, 4180.0, 1700.0], ocr_confidence=0.98),
        TextItem(id="t3", text="2", bbox=[4190.0, 1650.0, 4210.0, 1700.0], ocr_confidence=0.98),
        TextItem(id="t4", text="LINE", bbox=[3980.0, 1760.0, 4050.0, 1800.0], ocr_confidence=0.95),
        TextItem(id="t5", text="10-PR-201", bbox=[4060.0, 1760.0, 4220.0, 1800.0], ocr_confidence=0.95),
    ]

    connectors = detector.detect_connectors(dummy_mask, page_num=1, text_items=text_items)
    assert len(connectors) >= 1
    assert connectors[0].target_sheet == "Sheet 2"
    assert "SHEET" in connectors[0].label
    assert "10-PR-201" in connectors[0].label
