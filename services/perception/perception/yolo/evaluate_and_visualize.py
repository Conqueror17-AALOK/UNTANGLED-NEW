"""
Evaluation and Visual Verification Script for Trained YOLO11 P&ID Model.
Runs detection on sample validation tiles and saves marked visual overlays.
"""

import os
import cv2
import numpy as np

from services.perception.perception.yolo.detector import YOLOSymbolDetector


def evaluate_sample_tiles(
    model_path: str = "models/yolo11_pid.pt",
    val_images_dir: str = "data/yolo_dataset/images/val",
    output_preview: str = "data/yolo_dataset/detections_preview.png",
    num_samples: int = 4,
):
    print(f"Loading detector from {model_path}...")
    detector = YOLOSymbolDetector(model_path=model_path, conf_thresh=0.30)

    val_files = sorted([f for f in os.listdir(val_images_dir) if f.endswith(".png")])[:num_samples]
    if not val_files:
        print(f"No validation images found in {val_images_dir}")
        return

    preview_tiles = []
    print(f"Running inference on {len(val_files)} validation tiles...")

    for fname in val_files:
        img_path = os.path.join(val_images_dir, fname)
        img = cv2.imread(img_path)

        detections = detector.detect(img)
        print(f" -> {fname}: {len(detections)} symbols detected:")
        for d in detections:
            print(f"    • {d.class_name} (conf: {d.confidence:.2f}) at {d.bbox}")

        annotated = detector.draw_detections(img, detections)
        # Add filename header
        cv2.putText(annotated, f"Tile: {fname}", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 200), 2)
        preview_tiles.append(annotated)

    # Stitch into a 2x2 grid if 4 samples
    if len(preview_tiles) == 4:
        top = np.hstack([preview_tiles[0], preview_tiles[1]])
        bottom = np.hstack([preview_tiles[2], preview_tiles[3]])
        grid = np.vstack([top, bottom])
    else:
        grid = np.hstack(preview_tiles)

    cv2.imwrite(output_preview, grid)
    print(f"✅ Saved detection visual overlay grid to: {output_preview}")


if __name__ == "__main__":
    evaluate_sample_tiles()
