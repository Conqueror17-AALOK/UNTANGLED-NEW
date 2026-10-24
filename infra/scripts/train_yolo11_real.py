"""
Fine-tune YOLO11 on the comprehensive industrial P&ID corpus including real drawings & legends.
Leverages Apple Silicon Metal GPU (MPS).
"""

import os
import shutil
import torch
from ultralytics import YOLO


def main():
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Starting YOLO11 fine-tuning on device: {device}")

    base_model = "models/yolo11_pid.pt" if os.path.exists("models/yolo11_pid.pt") else "yolo11n.pt"
    print(f"Loading base weights: {base_model}")
    model = YOLO(base_model)

    results = model.train(
        data="data/yolo_dataset/dataset.yaml",
        epochs=15,
        imgsz=640,
        batch=16,
        device=device,
        workers=4,
        project="runs/detect",
        name="train_real",
        exist_ok=True,
        save=True,
        pretrained=True,
        optimizer="AdamW",
        lr0=0.001,
        lrf=0.01,
        warmup_epochs=2,
    )

    best_weights = "runs/detect/train_real/weights/best.pt"
    if os.path.exists(best_weights):
        shutil.copy(best_weights, "models/yolo11_pid.pt")
        print("Updated models/yolo11_pid.pt with new best weights!")

    # Validate model
    print("\nEvaluating fine-tuned model against validation set...")
    val_model = YOLO("models/yolo11_pid.pt")
    metrics = val_model.val(data="data/yolo_dataset/dataset.yaml", split="val", imgsz=640, device=device)

    print("\nValidation Performance Summary:")
    print(f"  Precision:   {metrics.box.mp * 100:.1f}%")
    print(f"  Recall:      {metrics.box.mr * 100:.1f}%")
    print(f"  mAP@50:      {metrics.box.map50 * 100:.1f}%")
    print(f"  mAP@50-95:   {metrics.box.map * 100:.1f}%")
    print(f"  Speed:       {metrics.speed.get('inference', 0):.2f} ms per image")


if __name__ == "__main__":
    main()
