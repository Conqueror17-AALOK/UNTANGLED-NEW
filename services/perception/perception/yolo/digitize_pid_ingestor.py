"""
Digitize-PID Hugging Face Dataset Ingestor & Tiler.
Downloads diagrams and annotations from kunalnchemtech/digitize-pid-symbols,
maps all 32 Digitize-PID classes into UNTANGLED's 17 ANSI/ISA-5.1 classes,
tiles high-resolution blueprints into 640x640 crops, and merges into data/yolo_dataset.
"""

import io
import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Tuple
from PIL import Image

# 1-indexed DigitizePID symbol mapping to 17 ISA-5.1 classes
DIGITIZE_TO_ISA: Dict[int, int] = {
    1: 5,   # gate_valve -> valve_gate (5)
    2: 8,   # ball_valve -> valve_ball (8)
    3: 9,   # butterfly_valve -> valve_butterfly (9)
    4: 7,   # check_valve -> valve_check (7)
    5: 10,  # control_valve -> valve_control_diaphragm (10)
    6: 6,   # globe_valve -> valve_globe (6)
    7: 6,   # needle_valve -> valve_globe (6)
    8: 8,   # plug_valve -> valve_ball (8)
    9: 11,  # safety_relief_valve -> valve_safety_psv (11)
    10: 15, # pump_centrifugal -> pump_centrifugal (15)
    11: 15, # pump_reciprocating -> pump_centrifugal (15)
    12: 15, # compressor -> pump_centrifugal (15)
    13: 16, # heat_exchanger_shell_tube -> tank_vessel (16)
    14: 16, # heat_exchanger_plate -> tank_vessel (16)
    15: 16, # vessel_vertical -> tank_vessel (16)
    16: 16, # vessel_horizontal -> tank_vessel (16)
    17: 16, # tank_atmospheric -> tank_vessel (16)
    18: 12, # filter_strainer -> flange (12)
    19: 0,  # indicator_generic -> instrument_field (0)
    20: 1,  # transmitter_generic -> instrument_dcs (1)
    21: 14, # flow_element -> orifice_plate (14)
    22: 1,  # level_indicator -> instrument_dcs (1)
    23: 1,  # pressure_indicator -> instrument_dcs (1)
    24: 1,  # temperature_indicator -> instrument_dcs (1)
    25: 3,  # control_panel -> instrument_shared (3)
    26: 10, # actuator_membrane -> valve_control_diaphragm (10)
    27: 10, # actuator_piston -> valve_control_diaphragm (10)
    28: 10, # actuator_solenoid -> valve_control_diaphragm (10)
    29: 13, # reducer_concentric -> reducer (13)
    30: 13, # reducer_eccentric -> reducer (13)
    31: 6,  # steam_trap -> valve_globe (6)
    32: 11, # rupture_disk -> valve_safety_psv (11)
}


def fetch_metadata(split: str = "train") -> List[Dict]:
    url = f"https://huggingface.co/datasets/kunalnchemtech/digitize-pid-symbols/raw/main/DigitizePID_Dataset/{split}/metadata.jsonl"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    records = []
    with urllib.request.urlopen(req) as resp:
        for line in resp:
            line_str = line.decode("utf-8").strip()
            if line_str:
                records.append(json.loads(line_str))
    return records


def download_image(split: str, file_name: str) -> Image.Image:
    url = f"https://huggingface.co/datasets/kunalnchemtech/digitize-pid-symbols/resolve/main/DigitizePID_Dataset/{split}/{file_name}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
    return Image.open(io.BytesIO(data))


def process_and_tile_diagram(
    record: Dict,
    split: str,
    target_dir: str = "data/yolo_dataset",
    tile_size: int = 640,
    max_tiles_per_diagram: int = 20,
) -> int:
    file_name = record["file_name"]
    base_id = os.path.splitext(file_name)[0]
    bboxes = record["symbols"]["bbox"]
    labels = record["symbols"]["labels"]

    dest_img_dir = os.path.join(target_dir, "images", split)
    dest_lbl_dir = os.path.join(target_dir, "labels", split)
    os.makedirs(dest_img_dir, exist_ok=True)
    os.makedirs(dest_lbl_dir, exist_ok=True)

    try:
        img = download_image(split, file_name)
    except Exception as e:
        print(f"Error downloading {file_name}: {e}")
        return 0

    img_w, img_h = img.size
    generated_tiles = 0
    covered_centers = set()

    for idx, (box, label_id) in enumerate(zip(bboxes, labels)):
        if generated_tiles >= max_tiles_per_diagram:
            break

        x1, y1, x2, y2 = box
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2

        # Avoid redundant overlapping crops centered at the exact same location
        grid_key = (cx // (tile_size // 2), cy // (tile_size // 2))
        if grid_key in covered_centers:
            continue
        covered_centers.add(grid_key)

        tile_x1 = max(0, min(img_w - tile_size, cx - tile_size // 2))
        tile_y1 = max(0, min(img_h - tile_size, cy - tile_size // 2))
        tile_x2 = tile_x1 + tile_size
        tile_y2 = tile_y1 + tile_size

        # Find all symbols inside this tile
        tile_labels = []
        for s_box, s_lbl in zip(bboxes, labels):
            sx1, sy1, sx2, sy2 = s_box
            scx = (sx1 + sx2) / 2.0
            scy = (sy1 + sy2) / 2.0

            if tile_x1 <= scx <= tile_x2 and tile_y1 <= scy <= tile_y2:
                # Clip box to tile boundaries
                bx1 = max(0.0, float(sx1 - tile_x1))
                by1 = max(0.0, float(sy1 - tile_y1))
                bx2 = min(float(tile_size), float(sx2 - tile_x1))
                by2 = min(float(tile_size), float(sy2 - tile_y1))

                bw = bx2 - bx1
                bh = by2 - by1
                if bw >= 4 and bh >= 4:
                    isa_cls = DIGITIZE_TO_ISA.get(s_lbl, 6)
                    norm_cx = (bx1 + bx2) / (2.0 * tile_size)
                    norm_cy = (by1 + by2) / (2.0 * tile_size)
                    norm_w = bw / float(tile_size)
                    norm_h = bh / float(tile_size)
                    tile_labels.append(f"{isa_cls} {norm_cx:.6f} {norm_cy:.6f} {norm_w:.6f} {norm_h:.6f}\n")

        if tile_labels:
            tile_name = f"digitize_{split}_{base_id}_t{generated_tiles:03d}"
            tile_img = img.crop((tile_x1, tile_y1, tile_x2, tile_y2))
            tile_img.save(os.path.join(dest_img_dir, f"{tile_name}.jpg"), quality=95)

            with open(os.path.join(dest_lbl_dir, f"{tile_name}.txt"), "w", encoding="utf-8") as f_lbl:
                f_lbl.writelines(tile_labels)

            generated_tiles += 1

    return generated_tiles


def ingest_digitize_pid(
    train_count: int = 20,
    val_count: int = 5,
    max_workers: int = 4,
) -> Tuple[int, int]:
    print("=" * 65)
    print("UNTANGLED: Digitize-PID Dataset Ingestor (kunalnchemtech)")
    print(f"Downloading and tiling {train_count} train and {val_count} val diagrams...")
    print("=" * 65)

    print("Fetching metadata catalogs from Hugging Face...")
    train_records = fetch_metadata("train")[:train_count]
    val_records = fetch_metadata("val")[:val_count]

    total_train_tiles = 0
    total_val_tiles = 0

    print(f"Processing {len(train_records)} training diagrams with {max_workers} worker threads...")
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(process_and_tile_diagram, rec, "train"): rec["file_name"] for rec in train_records}
        for future in as_completed(futures):
            name = futures[future]
            try:
                tiles = future.result()
                total_train_tiles += tiles
                print(f"  Processed {name}: generated {tiles} symbol tiles")
            except Exception as e:
                print(f"  Failed {name}: {e}")

    print(f"Processing {len(val_records)} validation diagrams with {max_workers} worker threads...")
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(process_and_tile_diagram, rec, "val"): rec["file_name"] for rec in val_records}
        for future in as_completed(futures):
            name = futures[future]
            try:
                tiles = future.result()
                total_val_tiles += tiles
                print(f"  Processed {name}: generated {tiles} symbol tiles")
            except Exception as e:
                print(f"  Failed {name}: {e}")

    print("=" * 65)
    print(f"Digitize-PID Ingestion Complete: {total_train_tiles} train tiles, {total_val_tiles} val tiles generated.")
    print("=" * 65)
    return total_train_tiles, total_val_tiles


if __name__ == "__main__":
    ingest_digitize_pid()
