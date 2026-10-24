import os
import pytest
from services.api.app.engine.io_parser import parse_io_list
from services.api.app.engine.cleanup import extract_pid_tags, normalize_tag
from services.api.app.engine.isa51_rules import parse_isa51_tag
from services.api.app.engine.validator import ConnectionValidator, IoListValidator
from services.api.app.db.schemas import GraphSchema, GraphNode, GraphEdge


def test_real_io_lists_parsing():
    unit14_path = "data/real_dataset/IO list extract-Unit 14-extract-09082026 (1).xlsx"
    dcs_path = "data/real_dataset/AUX/AUX_DCS IO List_CD-738221 Rev 00d.xlsx"
    esd_path = "data/real_dataset/AUX/AUX_ESD IO List_CD-737622 Rev 00d.xlsx"

    assert os.path.exists(unit14_path), f"Missing {unit14_path}"
    assert os.path.exists(dcs_path), f"Missing {dcs_path}"
    assert os.path.exists(esd_path), f"Missing {esd_path}"

    res_unit14 = parse_io_list(unit14_path)
    assert len(res_unit14.items) > 1000
    assert "14-FT-15701" in res_unit14.by_tag
    item_ft = res_unit14.by_tag["14-FT-15701"]
    assert item_ft.pid_ref == "14-0021-157"
    assert item_ft.signal_type == "4-20 mA"
    assert item_ft.units == "kg/h"
    assert item_ft.range_low == "0"
    assert item_ft.range_high == "35000"

    res_dcs = parse_io_list(dcs_path)
    assert len(res_dcs.items) > 2000
    assert any("631-FIT" in t for t in res_dcs.tags_list)

    res_esd = parse_io_list(esd_path)
    assert len(res_esd.items) > 200
    assert any("631-LIT" in t for t in res_esd.tags_list)


def test_real_pid_tag_extraction_and_isa51():
    # Test pairing and ISA-5.1 validation on real stacked tokens
    text_items = [
        {"id": "t1", "text": "14FIC", "bbox": [100, 100, 140, 115]},
        {"id": "t2", "text": "15701", "bbox": [100, 118, 140, 133]},
        {"id": "t3", "text": "14-P-171A", "bbox": [300, 400, 380, 420]},
        {"id": "t4", "text": "OFFSPEC FEED PUMP", "bbox": [300, 425, 420, 440]},
        {"id": "t5", "text": "631-AY-3054", "bbox": [500, 200, 600, 218]},
    ]
    io_tags = ["14-FIC-15701", "631-AY-3054", "14-P-171A"]
    extracted = extract_pid_tags(text_items, io_tags=io_tags)
    extracted_texts = [t["text"] for t in extracted]

    assert "14-FIC-15701" in extracted_texts
    assert "14-P-171A" in extracted_texts
    assert "631-AY-3054" in extracted_texts

    # Check ISA-5.1 parsing
    is_valid, desc, cat, score = parse_isa51_tag("14-FIC-15701")
    assert is_valid is True
    assert cat == "instrument"
    assert score == 1.0

    is_valid_pmp, desc_pmp, cat_pmp, score_pmp = parse_isa51_tag("14-P-171A")
    assert is_valid_pmp is True
    assert cat_pmp == "equipment"

    is_valid_vlv, desc_vlv, cat_vlv, score_vlv = parse_isa51_tag("631-AY-3054")
    assert is_valid_vlv is True
    assert cat_vlv == "instrument"


def test_real_connection_and_io_audit():
    # Topology representing Unit 14 loop 15701: 14-T-171 -> 14-P-171 -> 14-FV-15701 -> 14-FIC-15701
    graph = GraphSchema(
        nodes=[
            GraphNode(id="14-T-171", label="14-T-171", type="Storage Tank", category="equipment", confidence=0.98, x=100, y=200),
            GraphNode(id="14-P-171", label="14-P-171", type="Centrifugal Pump", category="equipment", confidence=0.97, x=250, y=200),
            GraphNode(id="14-FV-15701", label="14-FV-15701", type="Control Valve", category="valve", confidence=0.96, x=400, y=200),
            GraphNode(id="14-FIC-15701", label="14-FIC-15701", type="Flow Controller", category="instrument", confidence=0.95, x=400, y=100),
        ],
        edges=[
            GraphEdge(id="e1", source="14-T-171", target="14-P-171", line_type="process", directed=True),
            GraphEdge(id="e2", source="14-P-171", target="14-FV-15701", line_type="process", directed=True),
            GraphEdge(id="e3", source="14-FIC-15701", target="14-FV-15701", line_type="signal", directed=True),
        ]
    )

    conn_res = ConnectionValidator.validate_connections(graph)
    assert conn_res["status"] == "PASSED"
    assert conn_res["error_count"] == 0

    io_list_path = "data/real_dataset/IO list extract-Unit 14-extract-09082026 (1).xlsx"
    parsed_io = parse_io_list(io_list_path)

    audit_res = IoListValidator.verify_io_and_drawing(
        resolved_tags=[
            {"normalized_tag": "14-FIC-15701", "type": "Flow Controller", "category": "instrument"},
            {"normalized_tag": "14-FV-15701", "type": "Flow Control Valve", "category": "valve"},
        ],
        io_items=parsed_io.items
    )

    assert audit_res["total_audited"] > 1000
    assert audit_res["correct_count"] >= 1
