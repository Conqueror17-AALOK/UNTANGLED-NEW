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
