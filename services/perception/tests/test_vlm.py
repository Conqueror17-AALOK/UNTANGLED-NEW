"""
Unit tests for Florence-2 Vision-Language Grounding Model.
"""

import os
import cv2
import numpy as np

from services.perception.perception.vlm.florence_config import (
    dequantize_box,
    quantize_box,
)
from services.perception.perception.vlm.florence_vlm import Florence2VLM


def test_florence_coordinate_quantization():
    orig_box = [100.0, 150.0, 300.0, 450.0]
    w, h = 1000.0, 1000.0
    token_str = quantize_box(orig_box, w, h)
    assert "<loc_150>" in token_str
    assert "<loc_100>" in token_str
    assert "<loc_450>" in token_str
    assert "<loc_300>" in token_str

    dequant = dequantize_box([150, 100, 450, 300], w, h)
    assert abs(dequant[0] - 100) <= 2
    assert abs(dequant[1] - 150) <= 2
    assert abs(dequant[2] - 300) <= 2
    assert abs(dequant[3] - 450) <= 2


def test_florence2_vlm_grounding():
    model_dir = "models/florence2_finetuned" if os.path.exists("models/florence2_finetuned") else "models/florence2"
    if not os.path.exists(model_dir):
        return

    try:
        import torch
        from transformers import AutoProcessor
    except ImportError:
        return

    vlm = Florence2VLM(model_dir=model_dir)
    assert vlm is not None

    test_img = "data/florence_dataset/images/pid_vlm_0000.png"
    if os.path.exists(test_img):
        img = cv2.imread(test_img)
        regions = vlm.ground_query(img, "V-101")
        assert len(regions) >= 1
        r = regions[0]
        assert len(r.bbox) == 4
        assert r.bbox[2] > r.bbox[0]
        assert r.bbox[3] > r.bbox[1]
        assert len(r.description) > 0
