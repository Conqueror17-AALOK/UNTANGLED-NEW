from typing import Tuple

import cv2
import numpy as np

from services.perception.perception.config import PerceptionConfig, default_config


class Preprocessor:
    def __init__(self, config: PerceptionConfig = default_config):
        self.config = config

    def to_grayscale(self, image: np.ndarray) -> np.ndarray:
        if len(image.shape) == 2:
            return image
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY if image.shape[2] == 3 else cv2.COLOR_BGRA2GRAY)

    def deskew(self, image: np.ndarray) -> Tuple[np.ndarray, float]:
        """
        Detect skew angle using minAreaRect on text/line contours and rotate.
        Returns: (deskewed_image, angle_degrees)
        """
        if not self.config.enable_deskew:
            return image, 0.0

        gray = self.to_grayscale(image)
        # Invert so content is white on black
        thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

        coords = np.column_stack(np.where(thresh > 0))
        if len(coords) < 100:
            return image, 0.0

        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        elif angle > 45:
            angle = 90 - angle
        else:
            angle = -angle

        # Filter out extreme rotations
        if abs(angle) > self.config.max_deskew_angle or abs(angle) < 0.1:
            return image, 0.0

        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        m = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            image, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
        )
        return rotated, float(angle)

    def denoise(self, gray_image: np.ndarray) -> np.ndarray:
        """
        Denoise grayscale drawing image while preserving sharp CAD edges.
        """
        # Bilateral filter preserves sharp line edges while removing uniform background noise
        return cv2.bilateralFilter(gray_image, d=5, sigmaColor=50, sigmaSpace=50)

    def adaptive_binarize(self, gray_image: np.ndarray) -> np.ndarray:
        """
        Apply adaptive Gaussian thresholding to cleanly segment lines and tags.
        """
        block_size = self.config.adaptive_block_size
        if block_size % 2 == 0:
            block_size += 1

        binary = cv2.adaptiveThreshold(
            gray_image,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            block_size,
            self.config.adaptive_c
        )
        return binary

    def enhance_blurry_image(self, gray_image: np.ndarray) -> Tuple[np.ndarray, bool, float]:
        """
        Assess blur and contrast level via Laplacian variance and apply CLAHE + Unsharp Masking
        if the drawing is faded, low contrast, or blurry.
        Returns: (enhanced_image, was_enhanced, blur_score)
        """
        blur_score = float(cv2.Laplacian(gray_image, cv2.CV_64F).var())
        if self.config.enable_blur_enhancement and blur_score < self.config.blur_threshold:
            # 1. CLAHE contrast equalization for faded ink
            clahe = cv2.createCLAHE(
                clipLimit=self.config.clahe_clip_limit,
                tileGridSize=self.config.clahe_grid_size
            )
            contrast_boosted = clahe.apply(gray_image)

            # 2. Unsharp masking to sharpen blurry lines and faded text characters
            blurred = cv2.GaussianBlur(contrast_boosted, (0, 0), sigmaX=2.0)
            sharpened = cv2.addWeighted(
                contrast_boosted,
                self.config.unsharp_strength,
                blurred,
                -(self.config.unsharp_strength - 1.0),
                0
            )
            return sharpened, True, blur_score

        return gray_image, False, blur_score

    def process(self, image: np.ndarray) -> Tuple[np.ndarray, np.ndarray, float]:
        """
        Full preprocessing pass.
        Returns: (deskewed_color_or_gray, clean_binary_mask, detected_skew_angle)
        """
        deskewed, angle = self.deskew(image)
        gray = self.to_grayscale(deskewed)
        enhanced, was_restored, blur_score = self.enhance_blurry_image(gray)
        denoised = self.denoise(enhanced)
        binary = self.adaptive_binarize(denoised)
        return deskewed, binary, angle
