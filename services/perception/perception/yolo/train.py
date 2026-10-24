"""
YOLO11 P&ID Local Symbol & Micro-Part Training Script.
Utilizes Apple Silicon GPU acceleration (MPS) to fine-tune YOLO11
on ISA-5.1 engineering symbols.
"""

import os
import shutil
import sys
import torch
from ultralytics import YOLO


def train_yolo11(
    data_yaml: str = "data/yolo_dataset/dataset.yaml",
    model_variant: str = "yolo11n.pt",  # Nano variant for ultra-fast training and dense micro-symbol detection
    epochs: int = 20,
    imgsz: int = 640,
    batch: int = 16,
    project: str = "runs/detect",
    name: str = "yolo11_pid_symbols",
    output_model_path: str = "models/yolo11_pid.pt",
) -> None:
    print("=" * 65)
    print("UNTANGLED: Local YOLO11 Training for P&ID Micro-Symbols")
    print("=" * 65)

    # Detect Apple Silicon MPS Acceleration
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Hardware Acceleration Device: {device.upper()} (Apple Silicon Metal)")

    # Load base pretrained model
    print(f"Loading pretrained base: {model_variant}...")
    model = YOLO(model_variant)

    # Train
    abs_data_yaml = os.path.abspath(data_yaml)
    print(f"Initiating training for {epochs} epochs on {abs_data_yaml}...")
    results = model.train(
        data=abs_data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=device,
        project=project,
        name=name,
        exist_ok=True,
        plots=True,
        save=True,
        verbose=True,
    )

    # Save best model to designated output path
    candidates = [
        os.path.join(getattr(results, "save_dir", ""), "weights", "best.pt"),
        os.path.join(project, name, "weights", "best.pt"),
        os.path.join(project, project, name, "weights", "best.pt"),
    ]
    best_weights = next((c for c in candidates if os.path.exists(c)), None)
    if best_weights:
        os.makedirs(os.path.dirname(output_model_path), exist_ok=True)
        shutil.copy(best_weights, output_model_path)
        print(f"Successfully exported fine-tuned model from {best_weights} to: {output_model_path}")
    else:
        print(f"Warning: best.pt not found in candidates, saving current model weights.")
        model.save(output_model_path)

    print("=" * 65)
    print("Local YOLO11 P&ID Model Training Complete!")
    print("=" * 65)
    return results


if __name__ == "__main__":
    train_yolo11()
