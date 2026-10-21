import cv2
import numpy as np

from services.perception.perception.symbols.bubbles import BubbleDetector
from services.perception.perception.symbols.matcher import SymbolMatcher


def test_symbol_matcher_templates_loaded():
    matcher = SymbolMatcher()
    assert len(matcher.templates) >= 8
    assert "pump" in matcher.templates
    assert "valve_manual" in matcher.templates

def test_bubble_detector():
    detector = BubbleDetector()
    # Create synthetic image with a clean circular bubble
    img = np.ones((200, 200), dtype=np.uint8) * 255
    cv2.circle(img, (100, 100), 25, 0, 2)
    # Add horizontal line inside (panel mounted)
    cv2.line(img, (75, 100), (125, 100), 0, 2)

    bubbles = detector.detect_bubbles(img, page_num=1)
    assert len(bubbles) >= 1
    b = bubbles[0]
    assert b.symbol_class == "instrument_bubble"
    assert len(b.ports) >= 1
    assert b.metadata.get("bubble_shape") == "circle"
