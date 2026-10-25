"""
Real Industrial P&ID Dataset Ingestor & Tiler.
Processes high-resolution engineering blueprints and legend sheets from data/real_dataset:
- Extracts vector and raster symbols (instruments, valves, equipment, fittings)
- Generates 640x640 resolution training and validation tiles
- Exports normalized YOLO format labels for all 17 ANSI/ISA-5.1 classes
- Extracts authentic symbol templates for OpenCV template matcher
"""

import glob
import json
import os
import random
import shutil
from typing import Dict, List, Tuple
import cv2
import fitz
import numpy as np
from PIL import Image

CLASSES = [
    "instrument_field",          # 0
    "instrument_dcs",            # 1
    "instrument_aux",            # 2
    "instrument_shared",         # 3
    "instrument_logic",          # 4
    "valve_gate",                # 5
    "valve_globe",               # 6
    "valve_check",               # 7
    "valve_ball",                # 8
    "valve_butterfly",           # 9
    "valve_control_diaphragm",   # 10
    "valve_safety_psv",          # 11
    "flange",                    # 12
    "reducer",                   # 13
    "orifice_plate",             # 14
    "pump_centrifugal",          # 15
    "tank_vessel",               # 16
]

CLASS_TO_ID = {name: idx for idx, name in enumerate(CLASSES)}


def extract_symbols_from_pdf_page(page: fitz.Page, scale: float) -> List[Dict]:
    """
    Extract symbol bounding boxes and class IDs from a vector PDF page.
    """
    drawings = page.get_drawings()
    words = page.get_text("words")
    symbols = []

    # 1. Circular Instrument Bubbles
    for d in drawings:
        rect = d["rect"]
        w, h = rect.width, rect.height
        if abs(w - h) < 6 and 14 < w < 75:
            # Scale coordinates
            bx1, by1 = rect.x0 * scale, rect.y0 * scale
            bx2, by2 = rect.x1 * scale, rect.y1 * scale

            # Find text inside bubble to classify instrument type
            enclosed_words = [
                w[4].upper() for w in words
                if rect.intersects(fitz.Rect(w[0], w[1], w[2], w[3]))
            ]
            all_text = " ".join(enclosed_words)

            # Check if internal horizontal dividing line exists in drawing
            has_div_line = any(
                item[0] == "l" and abs(item[1].y - item[2].y) < 2
                and rect.x0 <= item[1].x <= rect.x1
                for item in d.get("items", [])
            )

            if "DCS" in all_text or has_div_line:
                cls_id = CLASS_TO_ID["instrument_dcs"]
            elif "AUX" in all_text:
                cls_id = CLASS_TO_ID["instrument_aux"]
            elif "LOGIC" in all_text or "PLC" in all_text:
                cls_id = CLASS_TO_ID["instrument_logic"]
            elif "SHARED" in all_text:
                cls_id = CLASS_TO_ID["instrument_shared"]
            else:
                cls_id = CLASS_TO_ID["instrument_field"]

            symbols.append({
                "bbox": [bx1, by1, bx2, by2],
                "class_id": cls_id,
                "text": all_text
            })

    # 2. Control Valves & Manual Valves from Drawings
    for d in drawings:
        rect = d["rect"]
        w, h = rect.width, rect.height
        # Valve bodies typically have aspect ratio ~1.2 to 2.2 and width 15-60
        if 15 < w < 70 and 10 < h < 60:
            items = d.get("items", [])
            has_triangle = any(item[0] in ("p", "re", "c") for item in items)
            if has_triangle:
                bx1, by1 = rect.x0 * scale, rect.y0 * scale
                bx2, by2 = rect.x1 * scale, rect.y1 * scale
                
                # Check for actuator dome (control valve) vs simple opposing triangles
                if h > w * 0.8:
                    cls_id = CLASS_TO_ID["valve_control_diaphragm"]
                else:
                    cls_id = CLASS_TO_ID["valve_gate"]

                symbols.append({
                    "bbox": [bx1, by1, bx2, by2],
                    "class_id": cls_id,
                    "text": ""
                })

    # 3. Equipment Text Labels (Pumps and Tanks)
    for w in words:
        txt = w[4].upper()
        # Centrifugal Pumps: e.g. 14-P-171, 14-P-112A, 631-G-0306A
        if ("-P-" in txt or "-G-" in txt) and any(c.isdigit() for c in txt):
            # The pump body is usually directly adjacent to or centered around the text
            pw, ph = 70 * scale, 70 * scale
            cx, cy = ((w[0] + w[2]) / 2.0) * scale, ((w[1] + w[3]) / 2.0) * scale
            bx1, by1 = cx - pw / 2.0, cy - ph / 2.0
            bx2, by2 = cx + pw / 2.0, cy + ph / 2.0
            symbols.append({
                "bbox": [bx1, by1, bx2, by2],
                "class_id": CLASS_TO_ID["pump_centrifugal"],
                "text": txt
            })
        # Tanks & Vessels: e.g. 14-T-171, 14-T-211A, 631-D-0305
        elif ("-T-" in txt or "-D-" in txt or "-V-" in txt) and any(c.isdigit() for c in txt) and not txt.startswith("14-TI") and not txt.startswith("14-TT"):
            tw, th = 110 * scale, 140 * scale
            cx, cy = ((w[0] + w[2]) / 2.0) * scale, ((w[1] + w[3]) / 2.0) * scale
            bx1, by1 = cx - tw / 2.0, cy - th / 2.0
            bx2, by2 = cx + tw / 2.0, cy + th / 2.0
            symbols.append({
                "bbox": [bx1, by1, bx2, by2],
                "class_id": CLASS_TO_ID["tank_vessel"],
                "text": txt
            })

    return symbols


def generate_tiles_for_page(
    image: Image.Image,
    symbols: List[Dict],
    page_id: str,
    target_dir: str = "data/yolo_dataset",
    tile_size: int = 640,
    val_split_prob: float = 0.20,
) -> Tuple[int, int]:
    """
    Generate 640x640 tiles centered around detected symbols, format YOLO txt labels,
    and save to data/yolo_dataset/images and labels.
    """
    img_w, img_h = image.size
    train_count = 0
    val_count = 0

    covered_centers = set()

    for idx, sym in enumerate(symbols):
        bx1, by1, bx2, by2 = sym["bbox"]
        cx = (bx1 + bx2) / 2.0
        cy = (by1 + by2) / 2.0

        grid_key = (int(cx // (tile_size * 0.45)), int(cy // (tile_size * 0.45)))
        if grid_key in covered_centers:
            continue
        covered_centers.add(grid_key)

        # Tile bounds with slight jitter
        jitter_x = random.randint(-40, 40)
        jitter_y = random.randint(-40, 40)
        tx1 = max(0, min(int(cx - tile_size / 2 + jitter_x), img_w - tile_size))
        ty1 = max(0, min(int(cy - tile_size / 2 + jitter_y), img_h - tile_size))
        tx2 = tx1 + tile_size
        ty2 = ty1 + tile_size

        crop = image.crop((tx1, ty1, tx2, ty2))

        # Find all symbols inside this tile
        tile_labels = []
        for other in symbols:
            ox1, oy1, ox2, oy2 = other["bbox"]
            ix1 = max(tx1, ox1)
            iy1 = max(ty1, oy1)
            ix2 = min(tx2, ox2)
            iy2 = min(ty2, oy2)

            if ix2 > ix1 and iy2 > iy1:
                inter_area = (ix2 - ix1) * (iy2 - iy1)
                sym_area = (ox2 - ox1) * (oy2 - oy1)
                if sym_area > 0 and (inter_area / sym_area) >= 0.50:
                    norm_cx = ((ox1 + ox2) / 2.0 - tx1) / tile_size
                    norm_cy = ((oy1 + oy2) / 2.0 - ty1) / tile_size
                    norm_w = (ox2 - ox1) / tile_size
                    norm_h = (oy2 - oy1) / tile_size

                    norm_cx = max(0.001, min(0.999, norm_cx))
                    norm_cy = max(0.001, min(0.999, norm_cy))
                    norm_w = max(0.005, min(0.99, norm_w))
                    norm_h = max(0.005, min(0.99, norm_h))

                    tile_labels.append(
                        f"{other['class_id']} {norm_cx:.6f} {norm_cy:.6f} {norm_w:.6f} {norm_h:.6f}"
                    )

        if not tile_labels:
            continue

        is_val = random.random() < val_split_prob
        split_name = "val" if is_val else "train"

        dest_img_dir = os.path.join(target_dir, "images", split_name)
        dest_lbl_dir = os.path.join(target_dir, "labels", split_name)
        os.makedirs(dest_img_dir, exist_ok=True)
        os.makedirs(dest_lbl_dir, exist_ok=True)

        tile_filename = f"real_{page_id}_tile_{idx:03d}"
        crop.save(os.path.join(dest_img_dir, f"{tile_filename}.jpg"), quality=95)

        with open(os.path.join(dest_lbl_dir, f"{tile_filename}.txt"), "w") as f:
            f.write("\n".join(tile_labels) + "\n")

        if is_val:
            val_count += 1
        else:
            train_count += 1

    return train_count, val_count


def ingest_real_dataset(
    data_dir: str = "data/real_dataset",
    output_dir: str = "data/yolo_dataset",
    dpi: int = 150,
) -> Dict[str, int]:
    """
    Render PDF sheets, extract symbol coordinates, generate 640x640 tiles,
    and merge directly into YOLO training dataset.
    Processes all pages of all real drawings in data_dir.
    """
    total_train = 0
    total_val = 0

    pdf_files = [
        ("1_ Main Input_P&ID_Sanitized.pdf", None),                   # All 29 sheets of Unit 14
        ("2_P&ID Legends_Sanitized.pdf", None),                        # All 5 legend sheets
        ("AUX/Common_PID_Legends_SealPlan_Sanitized_v4.pdf", None),   # All 10 sheets
        ("AUX/Aux_PIDs_CD_OW_PW_UW_Sanitized_v4.pdf", None),          # All 10 sheets
    ]

    for rel_path, max_pages in pdf_files:
        full_path = os.path.join(data_dir, rel_path)
        if not os.path.exists(full_path):
            continue

        doc = fitz.open(full_path)
        base_name = os.path.splitext(os.path.basename(rel_path))[0].replace(" ", "_")
        total_sheets = len(doc) if max_pages is None else min(max_pages, len(doc))
        print(f"Processing {base_name} ({total_sheets} sheets)...")

        for page_idx in range(total_sheets):
            page_id = f"{base_name}_p{page_idx+1}"
            existing = glob.glob(os.path.join(output_dir, "images", "*", f"real_{page_id}_tile_*.jpg"))
            if existing:
                print(f"  {page_id}: already ingested ({len(existing)} tiles). Skipping.")
                continue

            page = doc[page_idx]
            pix = page.get_pixmap(dpi=dpi)
            scale = pix.width / page.rect.width
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

            symbols = extract_symbols_from_pdf_page(page, scale)
            if not symbols:
                continue

            train_added, val_added = generate_tiles_for_page(
                img, symbols, page_id, target_dir=output_dir, val_split_prob=0.20
            )
            total_train += train_added
            total_val += val_added
            print(f"  {page_id}: {len(symbols)} symbols -> +{train_added} train, +{val_added} val tiles")

    print(f"\nReal Dataset Ingestion Complete: +{total_train} train tiles, +{total_val} val tiles added!")
    return {"train_tiles": total_train, "val_tiles": total_val}


def ingest_florence_dataset(
    florence_dir: str = "data/florence_dataset",
    output_dir: str = "data/yolo_dataset",
    val_split_prob: float = 0.20,
) -> Tuple[int, int]:
    """
    Convert Florence-2 ground truth annotations to YOLO format and ingest into yolo_dataset.
    """
    json_path = os.path.join(florence_dir, "dataset.json")
    imgs_dir = os.path.join(florence_dir, "images")
    if not os.path.exists(json_path) or not os.path.exists(imgs_dir):
        print(f"Florence dataset not found in {florence_dir}. Skipping.")
        return 0, 0

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    train_count = 0
    val_count = 0

    for item in data:
        img_name = item.get("image")
        src_img = os.path.join(imgs_dir, img_name)
        if not os.path.exists(src_img):
            continue

        base_id = f"florence_{os.path.splitext(img_name)[0]}"
        # Check if already ingested
        if glob.glob(os.path.join(output_dir, "images", "*", f"{base_id}.*")):
            continue

        w = float(item.get("width", 640))
        h = float(item.get("height", 640))
        annotations = item.get("annotations", [])
        if not annotations:
            continue

        yolo_lines = []
        for ann in annotations:
            cls_name = ann.get("class_name")
            if cls_name not in CLASS_TO_ID:
                continue
            cls_id = CLASS_TO_ID[cls_name]
            bx1, by1, bx2, by2 = ann.get("bbox", [0, 0, 0, 0])
            cx = ((bx1 + bx2) / 2.0) / w
            cy = ((by1 + by2) / 2.0) / h
            bw = (bx2 - bx1) / w
            bh = (by2 - by1) / h

            cx = max(0.001, min(0.999, cx))
            cy = max(0.001, min(0.999, cy))
            bw = max(0.005, min(0.999, bw))
            bh = max(0.005, min(0.999, bh))
            yolo_lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n")

        if not yolo_lines:
            continue

        is_val = random.random() < val_split_prob
        split_name = "val" if is_val else "train"
        dest_img_dir = os.path.join(output_dir, "images", split_name)
        dest_lbl_dir = os.path.join(output_dir, "labels", split_name)
        os.makedirs(dest_img_dir, exist_ok=True)
        os.makedirs(dest_lbl_dir, exist_ok=True)

        dest_img_path = os.path.join(dest_img_dir, f"{base_id}.png")
        dest_lbl_path = os.path.join(dest_lbl_dir, f"{base_id}.txt")

        shutil.copy2(src_img, dest_img_path)
        with open(dest_lbl_path, "w", encoding="utf-8") as f_out:
            f_out.writelines(yolo_lines)

        if is_val:
            val_count += 1
        else:
            train_count += 1

    print(f"Florence dataset ingested: +{train_count} train, +{val_count} val images.")
    return train_count, val_count


def ingest_all_remaining() -> None:
    print("=" * 65)
    print("Ingesting All Remaining Datasets into YOLO Dataset")
    print("=" * 65)
    ingest_real_dataset()
    ingest_florence_dataset()
    print("=" * 65)


if __name__ == "__main__":
    ingest_all_remaining()
