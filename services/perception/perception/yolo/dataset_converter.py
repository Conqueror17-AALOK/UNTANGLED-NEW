"""
Dataset Converter & Ingestor for Extra Real-World Industrial P&ID Datasets.
Converts Roboflow P&ID bounding box labels to the 17-class ISA-5.1 schema
and merges them into data/yolo_dataset/ for fine-tuning.
"""

import os
import shutil
import glob
from typing import Dict, Tuple

# Mapping Roboflow class IDs (0-9) to 17-class ISA-5.1 classes
# 0: Blower -> 15 (pump_centrifugal)
# 1: Closed Valve -> 6 (valve_globe)
# 2: Control-Panel -> 1 (instrument_dcs)
# 3: Gate Valve -> 5 (valve_gate)
# 4: Half closed valve -> 6 (valve_globe)
# 5: Menger -> 16 (tank_vessel)
# 6: Open valve -> 8 (valve_ball)
# 7: Orifice -> 14 (orifice_plate)
# 8: Test -> 0 (instrument_field)
# 9: Valve -> 6 (valve_globe)
ROBOFLOW_TO_ISA: Dict[int, int] = {
    0: 15,  # Blower -> pump_centrifugal
    1: 6,   # Closed Valve -> valve_globe
    2: 1,   # Control-Panel -> instrument_dcs
    3: 5,   # Gate Valve -> valve_gate
    4: 6,   # Half closed valve -> valve_globe
    5: 16,  # Menger -> tank_vessel
    6: 8,   # Open valve -> valve_ball
    7: 14,  # Orifice -> orifice_plate
    8: 0,   # Test -> instrument_field
    9: 6,   # Valve -> valve_globe
}


def convert_and_ingest(
    source_dir: str = "extra datasets/P-ID.v4i.yolov11",
    target_dir: str = "data/yolo_dataset",
    prefix: str = "real_pid_v4",
) -> Tuple[int, int]:
    """
    Convert bounding box labels and copy images to the target YOLO dataset directory.
    Returns: (train_count, val_count) of newly ingested images.
    """
    train_img_dir = os.path.join(target_dir, "images", "train")
    train_lbl_dir = os.path.join(target_dir, "labels", "train")
    val_img_dir = os.path.join(target_dir, "images", "val")
    val_lbl_dir = os.path.join(target_dir, "labels", "val")

    os.makedirs(train_img_dir, exist_ok=True)
    os.makedirs(train_lbl_dir, exist_ok=True)
    os.makedirs(val_img_dir, exist_ok=True)
    os.makedirs(val_lbl_dir, exist_ok=True)

    splits = [
        ("train", train_img_dir, train_lbl_dir),
        ("valid", val_img_dir, val_lbl_dir),
        ("test", val_img_dir, val_lbl_dir),  # Include test set in validation pool
    ]

    counts = {"train": 0, "val": 0}

    for split_name, dest_img_dir, dest_lbl_dir in splits:
        split_src_img = os.path.join(source_dir, split_name, "images")
        split_src_lbl = os.path.join(source_dir, split_name, "labels")

        if not os.path.exists(split_src_img):
            continue

        img_files = glob.glob(os.path.join(split_src_img, "*.jpg")) + glob.glob(os.path.join(split_src_img, "*.png"))

        for img_path in img_files:
            base_name = os.path.splitext(os.path.basename(img_path))[0]
            lbl_path = os.path.join(split_src_lbl, f"{base_name}.txt")

            new_filename_base = f"{prefix}_{split_name}_{base_name}"
            new_img_dest = os.path.join(dest_img_dir, f"{new_filename_base}.jpg")
            new_lbl_dest = os.path.join(dest_lbl_dir, f"{new_filename_base}.txt")

            # Copy image
            shutil.copy2(img_path, new_img_dest)

            # Convert labels
            converted_lines = []
            if os.path.exists(lbl_path):
                with open(lbl_path, "r", encoding="utf-8") as f_in:
                    for line in f_in:
                        parts = line.strip().split()
                        if not parts:
                            continue
                        src_cls = int(parts[0])
                        dst_cls = ROBOFLOW_TO_ISA.get(src_cls, 6)  # Default fallback: valve_globe
                        converted_lines.append(f"{dst_cls} {' '.join(parts[1:])}\n")

            with open(new_lbl_dest, "w", encoding="utf-8") as f_out:
                f_out.writelines(converted_lines)

            if "train" in dest_img_dir:
                counts["train"] += 1
            else:
                counts["val"] += 1

    print(f"Ingested {counts['train']} train images and {counts['val']} val images from {source_dir} (prefix: {prefix})")
    return counts["train"], counts["val"]


def ingest_all_extra_datasets() -> None:
    print("=" * 65)
    print("Ingesting Real-World P&ID Datasets from extra datasets/")
    print("=" * 65)

    t4, v4 = convert_and_ingest(
        source_dir="extra datasets/P-ID.v4i.yolov11",
        target_dir="data/yolo_dataset",
        prefix="real_v4",
    )

    t2, v2 = convert_and_ingest(
        source_dir="extra datasets/P-ID.v2i.yolov11",
        target_dir="data/yolo_dataset",
        prefix="real_v2",
    )

    print("=" * 65)
    print(f"Ingestion Complete: Added {t4 + t2} training images and {v4 + v2} validation images.")
    print("=" * 65)


if __name__ == "__main__":
    ingest_all_extra_datasets()
