#!/usr/bin/env python3
"""
Model Weights Downloader & Restoration Utility for UNTANGLED.
Allows re-downloading or setting up pre-trained YOLO11 & Florence-2 VLM models
after local storage cleanup.
"""

import argparse
import os
import shutil
import subprocess
import sys


def get_device():
    try:
        import torch
        if torch.backends.mps.is_available():
            return "mps (Apple Silicon Metal)"
        elif torch.cuda.is_available():
            return f"cuda ({torch.cuda.get_device_name(0)})"
        return "cpu"
    except ImportError:
        return "cpu (torch not installed)"


def check_status():
    print("=" * 60)
    print("UNTANGLED Model Storage & Weights Status")
    print("=" * 60)
    print(f"Hardware Compute Device: {get_device()}\n")

    models = [
        ("YOLO11 P&ID Symbol Model", "models/yolo11_pid.pt"),
        ("Florence-2 Base VLM", "models/florence2"),
        ("Florence-2 Fine-Tuned Checkpoint", "models/florence2_finetuned"),
    ]

    for name, path in models:
        if os.path.exists(path):
            if os.path.isdir(path):
                total_size = sum(
                    os.path.getsize(os.path.join(dirpath, f))
                    for dirpath, _, filenames in os.walk(path)
                    for f in filenames
                )
                size_str = f"{total_size / (1024 * 1024):.1f} MB"
                print(f"  [INSTALLED] {name:<35} -> {path} ({size_str})")
            else:
                size_str = f"{os.path.getsize(path) / (1024 * 1024):.1f} MB"
                print(f"  [INSTALLED] {name:<35} -> {path} ({size_str})")
        else:
            print(f"  [MISSING]   {name:<35} -> {path} (Not found)")

    print("\nTraining Datasets:")
    datasets = [
        ("YOLO Synthetic/Real Dataset", "data/yolo_dataset"),
        ("Florence Grounding Dataset", "data/florence_dataset"),
    ]
    for name, path in datasets:
        if os.path.exists(path):
            print(f"  [EXISTS]    {name:<35} -> {path}")
        else:
            print(f"  [NOT FOUND] {name:<35} -> {path}")
    print("=" * 60)


def setup_yolo():
    print("\n--- Setting up YOLO11 Weights ---")
    yolo_path = "models/yolo11_pid.pt"
    if os.path.exists(yolo_path):
        print(f"YOLO fine-tuned model already present at {yolo_path} ({os.path.getsize(yolo_path)/(1024*1024):.1f} MB).")
        return

    # Check if tracked in git history and can be restored
    os.makedirs("models", exist_ok=True)
    print("Attempting to restore fine-tuned weights from Git repository...")
    try:
        res = subprocess.run(["git", "checkout", "HEAD", "--", yolo_path], capture_output=True, text=True)
        if res.returncode == 0 and os.path.exists(yolo_path):
            print(f"Restored {yolo_path} directly from Git tracking ({os.path.getsize(yolo_path)/(1024*1024):.1f} MB)!")
            return
    except Exception as e:
        print(f"Git restore note: {e}")

    # Fallback: Download standard YOLO11 base weights
    print(f"Downloading base Ultralytics YOLO11n weights as fallback...")
    try:
        from ultralytics import YOLO
        model = YOLO("yolo11n.pt")
        print("Base YOLO11n downloaded successfully. You can retrain with: python infra/scripts/train_yolo11_real.py")
    except Exception as e:
        print(f"Could not load ultralytics YOLO: {e}")
        print("Please ensure ultralytics is installed: pip install ultralytics")


def setup_florence(hub_id="microsoft/Florence-2-base", target_dir="models/florence2"):
    print(f"\n--- Downloading Florence-2 VLM Weights from Hugging Face ({hub_id}) ---")
    try:
        from transformers import AutoModelForCausalLM, AutoProcessor
        import torch

        os.makedirs(target_dir, exist_ok=True)
        print(f"Fetching processor from {hub_id}...")
        processor = AutoProcessor.from_pretrained(hub_id, trust_remote_code=True)
        processor.save_pretrained(target_dir)

        print(f"Fetching model neural weights from {hub_id} (this will download ~450MB)...")
        model = AutoModelForCausalLM.from_pretrained(
            hub_id,
            torch_dtype=torch.float32,
            trust_remote_code=True,
        )
        model.save_pretrained(target_dir)
        print(f"Florence-2 VLM successfully downloaded and saved to: {target_dir}")
    except ImportError:
        print("Error: transformers and torch are required.")
        print("Run: pip install torch transformers timm einops")
    except Exception as e:
        print(f"Failed to download Florence-2: {e}")


def main():
    parser = argparse.ArgumentParser(description="Download and restore UNTANGLED ML model weights")
    parser.add_argument("--status", action="store_true", help="Display status of local models and datasets")
    parser.add_argument("--yolo", action="store_true", help="Restore or setup YOLO11 model weights")
    parser.add_argument("--florence", action="store_true", help="Download Florence-2 VLM from Hugging Face Hub")
    parser.add_argument("--all", action="store_true", help="Setup all models (YOLO11 + Florence-2)")

    args = parser.parse_args()

    if len(sys.argv) == 1 or args.status:
        check_status()
        if len(sys.argv) == 1:
            print("\nUsage:")
            print("  python infra/scripts/download_models.py --status      # Check current models")
            print("  python infra/scripts/download_models.py --all         # Restore all models")
            print("  python infra/scripts/download_models.py --yolo        # Restore YOLO11 model")
            print("  python infra/scripts/download_models.py --florence    # Download Florence-2 VLM")
        return

    if args.all or args.yolo:
        setup_yolo()

    if args.all or args.florence:
        setup_florence()

    print("\nDone!")
    check_status()


if __name__ == "__main__":
    main()
