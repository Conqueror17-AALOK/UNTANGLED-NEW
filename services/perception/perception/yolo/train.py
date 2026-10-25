"""
YOLO11 P&ID Local Symbol & Micro-Part Training Script.
Utilizes Apple Silicon GPU acceleration (MPS) to fine-tune YOLO11
on ISA-5.1 engineering symbols.
"""

import argparse
import os
import shutil
import sys
import torch
from ultralytics import YOLO


def train_yolo11(
    data_yaml: str = "data/yolo_dataset/dataset.yaml",
    model_variant: str = None,
    epochs: int = 10,
    imgsz: int = 640,
    batch: int = 16,
    workers: int = 4,
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

    # Select starting model checkpoint
    if model_variant is None:
        if os.path.exists("models/yolo11_pid.pt"):
            model_variant = "models/yolo11_pid.pt"
            print("Found existing fine-tuned checkpoint at models/yolo11_pid.pt; continuing fine-tuning.")
        else:
            model_variant = "yolo11n.pt"

    # Backup existing model before training
    if os.path.exists(output_model_path):
        backup_path = "models/yolo11_pid_prev.pt"
        shutil.copy2(output_model_path, backup_path)
        print(f"Backed up existing model to: {backup_path}")

    # Load base pretrained model
    print(f"Loading pretrained base: {model_variant}...")
    model = YOLO(model_variant)

    # Train
    abs_data_yaml = os.path.abspath(data_yaml)
    print(f"Initiating training for {epochs} epochs on {abs_data_yaml} (batch={batch}, workers={workers})...")
    results = model.train(
        data=abs_data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        workers=workers,
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
    parser = argparse.ArgumentParser(description="Train YOLO11 on ISA-5.1 P&ID Dataset")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--workers", type=int, default=4, help="Data loader workers")
    parser.add_argument("--model", type=str, default=None, help="Starting model checkpoint")
    args = parser.parse_args()

    train_yolo11(
        epochs=args.epochs,
        batch=args.batch,
        workers=args.workers,
        model_variant=args.model,
    )
