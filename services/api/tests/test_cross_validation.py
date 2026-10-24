import pytest
from services.api.app.engine.cross_validator import cross_validate_drawing_and_io
from services.api.app.engine.io_parser import IoItem


def test_cross_validation_discrepancies():
    resolved_tags = [
        {"id": "tag_0001", "normalized_tag": "TK-101", "type": "Tank", "category": "equipment", "status": "resolved", "source": "auto"},
        {"id": "tag_0002", "normalized_tag": "HV-77", "type": "Manual Valve", "category": "valve", "status": "resolved", "source": "auto"},
    ]
    io_items = [
        IoItem(tag="TK-101", description="Tank", signal_type="Equipment"),
        IoItem(tag="FT-310", description="Secondary Flow Transmitter", signal_type="4-20mA AI"),
    ]

    report = cross_validate_drawing_and_io(resolved_tags, io_items)

    # 1. FT-310 is on IO list, missing from drawing
    assert any(item.io_tag == "FT-310" for item in report.missing_in_drawing)

    # 2. HV-77 is on drawing, missing from IO list
    assert any(item.tag == "HV-77" for item in report.missing_in_io_list)


def test_cross_validation_with_graph_warning_instances():
    from services.api.app.db.schemas import GraphWarning
    resolved_tags = [
        {"id": "tag_0001", "normalized_tag": "TK-101", "type": "Tank", "category": "equipment", "status": "resolved", "source": "auto"},
    ]
    io_items = [
        IoItem(tag="TK-101", description="Tank", signal_type="Equipment"),
    ]
    warnings = [
        GraphWarning(node="A-1", code="FLOATING_EQUIPMENT", message="Equipment has no process or signal lines.")
    ]

    report = cross_validate_drawing_and_io(resolved_tags, io_items, graph_warnings=warnings)
    assert len(report.graph_warnings) == 1
    # Can access via attribute or model_dump()
    assert (
        report.graph_warnings[0].node == "A-1"
        if hasattr(report.graph_warnings[0], "node")
        else report.graph_warnings[0]["node"] == "A-1"
    )
    dumped = report.model_dump()
    assert dumped["graph_warnings"][0]["node"] == "A-1"
    assert dumped["graph_warnings"][0]["code"] == "FLOATING_EQUIPMENT"


