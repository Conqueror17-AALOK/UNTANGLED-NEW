from typing import Any, Dict, List, Optional
from services.api.app.db.schemas import (
    GraphSchema,
    MissingInDrawingItem,
    MissingInIoListItem,
    ReportSchema,
    ReportSummary,
    TypeMismatchItem,
)
from services.api.app.engine.io_parser import IoItem
from services.api.app.engine.validator import ConnectionValidator, IoListValidator


def cross_validate_drawing_and_io(
    resolved_tags: List[Dict[str, Any]],
    io_items: List[IoItem],
    graph_warnings: Optional[List[Dict[str, Any]]] = None,
    graph: Optional[GraphSchema] = None,
) -> ReportSchema:
    """
    Cross-reference detected drawing tags against DCS IO list.
    Detect:
    - Missing in drawing (on IO list, not on drawing)
    - Missing in IO list (on drawing, not on IO list)
    - Signal type mismatches (e.g. analog transmitter wired to digital input)
    """
    if graph_warnings is None:
        graph_warnings = []

    drawing_tags_map = {}
    for t in resolved_tags:
        norm = t["normalized_tag"].upper().replace(" ", "-")
        drawing_tags_map[norm] = t
        drawing_tags_map[norm.replace("-", "")] = t

    io_tags_map = {}
    for item in io_items:
        norm = item.tag.upper().replace(" ", "-")
        io_tags_map[norm] = item
        io_tags_map[norm.replace("-", "")] = item

    # 1. Missing in Drawing
    missing_in_drawing = []
    for item in io_items:
        norm = item.tag.upper().replace(" ", "-")
        if norm not in drawing_tags_map and norm.replace("-", "") not in drawing_tags_map:
            missing_in_drawing.append(
                MissingInDrawingItem(
                    io_tag=item.tag,
                    description=item.description or "Configured in DCS IO list but missing from P&ID drawing."
                )
            )

    # 2. Missing in IO List
    missing_in_io_list = []
    for t in resolved_tags:
        norm = t["normalized_tag"].upper().replace(" ", "-")
        if norm not in io_tags_map and norm.replace("-", "") not in io_tags_map:
            missing_in_io_list.append(
                MissingInIoListItem(
                    tag=t["normalized_tag"],
                    tag_id=t["id"]
                )
            )

    # 3. Type / Signal Mismatches
    type_mismatches = []
    for t in resolved_tags:
        norm = t["normalized_tag"].upper().replace(" ", "-")
        io_entry = io_tags_map.get(norm) or io_tags_map.get(norm.replace("-", ""))
        if io_entry and io_entry.signal_type:
            sig = io_entry.signal_type.upper()
            tag_type = t.get("type", "").upper()
            # If tag is transmitter (PT, FT, TT, LT) but signal is Digital (DI, DO)
            is_transmitter = any(k in norm for k in ["PT", "FT", "TT", "LT"])
            if is_transmitter and "DI" in sig and "AI" not in sig:
                type_mismatches.append(
                    TypeMismatchItem(
                        tag=t["normalized_tag"],
                        drawing_type=t.get("type", "Transmitter"),
                        io_signal=io_entry.signal_type
                    )
                )

    # 4. Summary metrics
    tags_total = len(resolved_tags)
    resolved_cnt = sum(1 for t in resolved_tags if t.get("status") == "resolved")
    review_cnt = sum(1 for t in resolved_tags if t.get("status") == "needs_review")
    rejected_cnt = sum(1 for t in resolved_tags if t.get("status") == "rejected")

    auto_cnt = sum(1 for t in resolved_tags if t.get("source") == "auto")
    llm_cnt = sum(1 for t in resolved_tags if t.get("source") == "llm")
    human_cnt = sum(1 for t in resolved_tags if t.get("source") == "human")

    auto_pct = round((auto_cnt / tags_total * 100), 1) if tags_total > 0 else 0.0
    llm_pct = round((llm_cnt / tags_total * 100), 1) if tags_total > 0 else 0.0
    human_pct = round((human_cnt / tags_total * 100), 1) if tags_total > 0 else 0.0

    # 5. Connection Verification (if topological graph provided)
    conn_val = None
    if graph is not None:
        conn_val = ConnectionValidator.validate_connections(graph, resolved_tags)

    # 6. DCS I/O List Comprehensive Audit
    io_val = IoListValidator.verify_io_and_drawing(resolved_tags, io_items)

    return ReportSchema(
        summary=ReportSummary(
            tags_total=tags_total,
            resolved=resolved_cnt,
            needs_review=review_cnt,
            rejected=rejected_cnt,
            auto_pct=auto_pct,
            llm_pct=llm_pct,
            human_pct=human_pct,
        ),
        missing_in_drawing=missing_in_drawing,
        missing_in_io_list=missing_in_io_list,
        type_mismatches=type_mismatches,
        graph_warnings=graph_warnings,
        connection_validation=conn_val,
        io_verification=io_val,
    )
