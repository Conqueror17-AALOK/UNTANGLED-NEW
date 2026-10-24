"""
Evaluation and Visual Demonstration for Florence-2 P&ID Grounding.
Runs inference with the fine-tuned VLM to output both coordinates and descriptions.
"""

import os
import cv2
import numpy as np

from services.perception.perception.vlm.florence_vlm import Florence2VLM


def evaluate_florence_grounding():
    model_dir = "models/florence2_finetuned" if os.path.exists("models/florence2_finetuned") else "models/florence2"
    print(f"Loading Florence-2 VLM from: {model_dir}...")
    vlm = Florence2VLM(model_dir=model_dir)

    test_img_path = "data/florence_dataset/images/pid_vlm_0000.png"
    if not os.path.exists(test_img_path):
        print(f"Test image not found at {test_img_path}")
        return

    img = cv2.imread(test_img_path)
    print(f"\n🔬 Running Vision-Language inference on {test_img_path} ({img.shape[1]}x{img.shape[0]}):")

    # 1. Query Grounding Test: Locate a specific instrument tag
    queries = ["V-101", "pressure control valve", "PI-200"]
    all_regions = []

    print("\n--- [Task: Phrase Grounding -> Coordinates] ---")
    for q in queries:
        try:
            regions = vlm.ground_query(img, q)
            for r in regions:
                print(f" -> Query '{q}': located at BBox {r.bbox} (Center: {r.center}) | Description: '{r.description}'")
                all_regions.append(r)
        except Exception as e:
            print(f" -> Query '{q}' grounding: {e}")

    # 2. Dense Captioning & Region Grounding
    print("\n--- [Task: Dense Captioning & Region Extraction] ---")
    try:
        dense_regions = vlm.dense_caption_and_ground(img)
        print(f" -> Extracted {len(dense_regions)} grounded regions:")
        for r in dense_regions:
            print(f"   • [{r.bbox[0]}, {r.bbox[1]}, {r.bbox[2]}, {r.bbox[3]}] -> '{r.description}'")
            all_regions.append(r)
    except Exception as e:
        print(f" -> Dense captioning: {e}")

    # 3. Render Visual Grounding Overlay
    out_preview = "data/florence_dataset/florence_grounding_preview.png"
    if all_regions:
        vis = vlm.draw_regions(img, all_regions)
        cv2.imwrite(out_preview, vis)
        print(f"\n✅ Visual grounding preview saved to: {out_preview}")


if __name__ == "__main__":
    evaluate_florence_grounding()
