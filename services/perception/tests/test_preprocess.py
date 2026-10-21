import cv2
import numpy as np

from services.perception.perception.preprocess import Preprocessor


def test_preprocess_pipeline():
    preprocessor = Preprocessor()
    # Create synthetic image with dark lines on white background
    img = np.ones((400, 400, 3), dtype=np.uint8) * 255
    cv2.line(img, (50, 200), (350, 200), (0, 0, 0), 2)
    cv2.circle(img, (200, 200), 30, (0, 0, 0), 2)

    deskewed, binary, angle = preprocessor.process(img)
    assert deskewed.shape[:2] == (400, 400)
    assert binary.shape == (400, 400)
    assert isinstance(angle, float)
    # Binary should have 0 and 255 values
    assert np.any(binary == 0) and np.any(binary == 255)
