from typing import Any, Dict, List, Optional
import openpyxl
from pydantic import BaseModel


class IoItem(BaseModel):
    tag: str
    description: Optional[str] = ""
    signal_type: Optional[str] = ""
    units: Optional[str] = ""
    range_low: Optional[Any] = None
    range_high: Optional[Any] = None
    pid_ref: Optional[str] = ""
    location: Optional[str] = ""


class IoParseResult(BaseModel):
    items: List[IoItem]
    by_tag: Dict[str, IoItem]
    tags_list: List[str]


def parse_io_list(file_path: str) -> IoParseResult:
    """
    Parse engineering IO list from Excel workbook (.xlsx).
    Flexibly detects column headers even with varying casing or naming.
    """
    wb = openpyxl.load_workbook(file_path, data_only=True)
    sheet = wb.active

    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        raise ValueError("Excel file is empty.")

    # Find header row
    header_idx = -1
    tag_col = -1
    desc_col = -1
    signal_col = -1
    units_col = -1
    range_l_col = -1
    range_h_col = -1
    pid_ref_col = -1
    loc_col = -1

    for r_idx, row in enumerate(rows[:10]):  # check first 10 rows for header
        for c_idx, cell in enumerate(row):
            if cell is None:
                continue
            val = str(cell).strip().lower()
            clean_val = val.replace("&", "").replace("_", " ").strip()
            if val in ["tag", "tag no", "tag number", "tag name", "instrument tag", "device tag"]:
                tag_col = c_idx
                header_idx = r_idx
            elif "desc" in val or "service" in val:
                desc_col = c_idx
            elif "signal" in val or "io type" in val or "i/o type" in val:
                signal_col = c_idx
            elif "uom" in val or "eng unit" in val or (val in ["unit", "units"] and "area" not in val):
                units_col = c_idx
            elif ("low" in val or "min" in val) and "terminal" not in val and "admin" not in val:
                range_l_col = c_idx
            elif "high" in val or "max" in val:
                range_h_col = c_idx
            elif "pid" in clean_val or "dwg" in val or "drawing" in val or "p&id" in val:
                pid_ref_col = c_idx
            elif "location" in val:
                loc_col = c_idx

        if tag_col != -1:
            break

    if tag_col == -1:
        raise ValueError("IO_COLUMN_NOT_FOUND: No tag column header found in Excel sheet.")

    items: List[IoItem] = []
    by_tag: Dict[str, IoItem] = {}

    for row in rows[header_idx + 1:]:
        if len(row) <= tag_col or row[tag_col] is None:
            continue
        raw_tag = str(row[tag_col]).strip()
        if not raw_tag or raw_tag.lower() == "none":
            continue

        item = IoItem(
            tag=raw_tag,
            description=str(row[desc_col]).strip() if desc_col != -1 and desc_col < len(row) and row[desc_col] is not None else "",
            signal_type=str(row[signal_col]).strip() if signal_col != -1 and signal_col < len(row) and row[signal_col] is not None else "",
            units=str(row[units_col]).strip() if units_col != -1 and units_col < len(row) and row[units_col] is not None else "",
            range_low=row[range_l_col] if range_l_col != -1 and range_l_col < len(row) and row[range_l_col] is not None else None,
            range_high=row[range_h_col] if range_h_col != -1 and range_h_col < len(row) and row[range_h_col] is not None else None,
            pid_ref=str(row[pid_ref_col]).strip() if pid_ref_col != -1 and pid_ref_col < len(row) and row[pid_ref_col] is not None else "",
            location=str(row[loc_col]).strip() if loc_col != -1 and loc_col < len(row) and row[loc_col] is not None else "",
        )
        import re
        norm_key = re.sub(r"[\s_-]+", "-", raw_tag.upper())
        compact_key = re.sub(r"[\s_-]+", "", raw_tag.upper())
        items.append(item)
        by_tag[raw_tag] = item
        by_tag[norm_key] = item
        by_tag[compact_key] = item

    return IoParseResult(items=items, by_tag=by_tag, tags_list=[i.tag for i in items])
