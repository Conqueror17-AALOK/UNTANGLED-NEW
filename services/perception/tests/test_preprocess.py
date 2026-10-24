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


def test_blurry_image_enhancement():
    preprocessor = Preprocessor()
    # Create sharp image then blur heavily
    base_img = np.ones((300, 300), dtype=np.uint8) * 255
    cv2.putText(base_img, "PT-101", (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 1.2, 0, 2)
    blurry_img = cv2.GaussianBlur(base_img, (15, 15), 4.0)

    enhanced, was_restored, score = preprocessor.enhance_blurry_image(blurry_img)
    assert was_restored is True
    assert score < preprocessor.config.blur_threshold
    # Enhanced image should be restored without shape change
    assert enhanced.shape == blurry_img.shape
    # Check that contrast or edge gradients increased
    assert cv2.Laplacian(enhanced, cv2.CV_64F).var() > score
