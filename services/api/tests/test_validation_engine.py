import pytest
from fastapi.testclient import TestClient

from services.api.app.db.database import Base, SessionLocal, engine
from services.api.app.db.models import JobModel, TagModel
from services.api.app.db.schemas import GraphEdge, GraphNode, GraphSchema
from services.api.app.engine.io_parser import IoItem
from services.api.app.engine.validator import ConnectionValidator, IoListValidator
from services.api.app.main import app

client = TestClient(app)


def setup_module():
    Base.metadata.create_all(bind=engine)


def test_connection_validator_detects_floating_equipment_and_valid_piping():
    # Graph with 1 connected Pump + Exchanger, and 1 floating Tank
    nodes = [
        GraphNode(id="P-101", type="Pump", category="equipment", x=100.0, y=100.0, confidence=0.95),
        GraphNode(id="E-101", type="Heat Exchanger", category="equipment", x=300.0, y=100.0, confidence=0.95),
        GraphNode(id="TK-999", type="Storage Tank", category="equipment", x=600.0, y=100.0, confidence=0.90),
    ]
    edges = [
        GraphEdge(id="e1", source="P-101", target="E-101", line_type="process", directed=True)
    ]
    graph = GraphSchema(version=1, nodes=nodes, edges=edges)

    result = ConnectionValidator.validate_connections(graph)

    assert result["error_count"] >= 1
    # TK-999 must be flagged as WRONG because it's floating
    tk_diag = next(d for d in result["diagnostics"] if d["element_id"] == "TK-999")
    assert tk_diag["status"] == "WRONG"
    assert tk_diag["rule"] == "FLOATING_EQUIPMENT"

    # Edge e1 must be marked CORRECT
    edge_diag = next(d for d in result["diagnostics"] if d["element_id"] == "e1")
    assert edge_diag["status"] == "CORRECT"


def test_connection_validator_control_valve_and_line_compatibility():
    # Modulating control valve CV-101 inline, but lacking actuator signal line
    nodes = [
        GraphNode(id="P-101", type="Pump", category="equipment", x=100.0, y=100.0, confidence=0.95),
        GraphNode(id="CV-101", type="Control Valve", category="valve", x=250.0, y=100.0, confidence=0.94),
        GraphNode(id="TK-102", type="Tank", category="equipment", x=400.0, y=100.0, confidence=0.95),
    ]
    edges = [
        GraphEdge(id="e1", source="P-101", target="CV-101", line_type="process", directed=True),
        GraphEdge(id="e2", source="CV-101", target="TK-102", line_type="process", directed=True),
    ]
    graph = GraphSchema(version=1, nodes=nodes, edges=edges)

    result = ConnectionValidator.validate_connections(graph)

    # CV-101 should trigger a WARNING for missing control loop signal
    cv_diag = next(d for d in result["diagnostics"] if d["element_id"] == "CV-101")
    assert cv_diag["status"] == "WARNING"
    assert cv_diag["rule"] == "MISSING_CONTROL_SIGNAL"

    # Now add FIC-101 and a signal line to CV-101
    nodes.append(GraphNode(id="FIC-101", type="Controller", category="instrument", x=250.0, y=20.0, confidence=0.98))
    edges.append(GraphEdge(id="e_sig", source="FIC-101", target="CV-101", line_type="signal", directed=True))
    graph_updated = GraphSchema(version=1, nodes=nodes, edges=edges)

    result_updated = ConnectionValidator.validate_connections(graph_updated)
    cv_diag_updated = next(d for d in result_updated["diagnostics"] if d["element_id"] == "CV-101")
    assert cv_diag_updated["status"] == "CORRECT"


def test_connection_validator_incompatible_line_type():
    # Process fluid pipe connecting directly between two instrument bubbles
    nodes = [
        GraphNode(id="PT-101", type="Pressure Transmitter", category="instrument", x=100.0, y=100.0, confidence=0.95),
        GraphNode(id="TT-101", type="Temperature Transmitter", category="instrument", x=200.0, y=100.0, confidence=0.95),
    ]
    edges = [
        GraphEdge(id="e_bad", source="PT-101", target="TT-101", line_type="process", directed=True)
    ]
    graph = GraphSchema(version=1, nodes=nodes, edges=edges)

    result = ConnectionValidator.validate_connections(graph)
    bad_edge = next(d for d in result["diagnostics"] if d["element_id"] == "e_bad")
    assert bad_edge["status"] == "WRONG"
    assert bad_edge["rule"] == "INCOMPATIBLE_LINE_TYPE"


def test_io_list_validator_comprehensive_audit():
    resolved_tags = [
        {"normalized_tag": "PT-101", "type": "Pressure Transmitter", "category": "instrument"},
        {"normalized_tag": "CV-101", "type": "Control Valve", "category": "valve"},
        {"normalized_tag": "FT-101", "type": "Flow Transmitter", "category": "instrument"}, # Missing in IO list
    ]

    io_items = [
        # Correctly matched AI transmitter
        IoItem(tag="PT-101", signal_type="4-20mA (AI)", range_low="0", range_high="100", units="psi", description="Suction Pressure"),
        # Signal type mismatch: CV-101 configured as DO instead of AO
        IoItem(tag="CV-101", signal_type="DO (Digital Output)", range_low="0", range_high="100", units="%", description="Level Valve"),
        # Missing in drawing: TT-999 is in IO list but not on drawing
        IoItem(tag="TT-999", signal_type="RTD (AI)", range_low="0", range_high="200", units="degC", description="Ambient Temp"),
        # Inverted range: LT-102
        IoItem(tag="LT-102", signal_type="4-20mA", range_low="150", range_high="10", units="m", description="Feed Tank Level"),
        # Mixed string and int range types: PT-103 (string '-1' and int 22)
        IoItem(tag="PT-103", signal_type="4-20mA (AI)", range_low="-1", range_high=22, units="bar", description="Mixed String-Int Range"),
    ]
    resolved_tags.append({"normalized_tag": "LT-102", "type": "Level Transmitter", "category": "instrument"})
    resolved_tags.append({"normalized_tag": "PT-103", "type": "Pressure Transmitter", "category": "instrument"})

    result = IoListValidator.verify_io_and_drawing(resolved_tags, io_items)

    assert result["discrepancy_count"] >= 3

    # Check PT-101 is CORRECT
    pt_audit = next(i for i in result["items_audit"] if i["tag"] == "PT-101")
    assert pt_audit["status"] == "CORRECT"

    # Check CV-101 is WRONG (SIGNAL_TYPE_MISMATCH)
    cv_audit = next(i for i in result["items_audit"] if i["tag"] == "CV-101")
    assert cv_audit["status"] == "WRONG"
    assert cv_audit["discrepancy_type"] == "SIGNAL_TYPE_MISMATCH"

    # Check TT-999 is WRONG (MISSING_IN_DRAWING)
    tt_audit = next(i for i in result["items_audit"] if i["tag"] == "TT-999")
    assert tt_audit["status"] == "WRONG"
    assert tt_audit["discrepancy_type"] == "MISSING_IN_DRAWING"

    # Check FT-101 is WRONG (MISSING_IN_IO_LIST)
    ft_audit = next(i for i in result["items_audit"] if i["tag"] == "FT-101")
    assert ft_audit["status"] == "WRONG"
    assert ft_audit["discrepancy_type"] == "MISSING_IN_IO_LIST"

    # Check LT-102 has INVALID_CALIBRATION_RANGE
    lt_audit = next(i for i in result["items_audit"] if i["tag"] == "LT-102")
    assert lt_audit["status"] == "WRONG"
    assert lt_audit["discrepancy_type"] == "INVALID_CALIBRATION_RANGE"


def test_api_verification_endpoint(tmp_path):
    import uuid
    import os
    import json
    from services.api.app.config import get_settings

    settings = get_settings()
    uid = uuid.uuid4().hex[:8]
    job_id = f"test-verify-job-{uid}"

    job_dir = os.path.join(settings.DATA_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    g = {
        "version": 1,
        "nodes": [
            {"id": "P-101", "type": "Pump", "category": "equipment", "x": 100, "y": 100, "confidence": 0.95},
            {"id": "TK-101", "type": "Tank", "category": "equipment", "x": 300, "y": 100, "confidence": 0.95},
        ],
        "edges": [
            {"id": "e1", "source": "TK-101", "target": "P-101", "line_type": "process", "directed": True}
        ],
        "warnings": []
    }
    with open(os.path.join(job_dir, "graph.json"), "w") as f:
        json.dump(g, f)

    db = SessionLocal()
    try:
        db.add(JobModel(id=job_id, status="done", stage="report", progress=1.0, pdf_path="test.pdf", xlsx_path="test.xlsx"))
        db.add(TagModel(id=f"t_p1_{uid}", job_id=job_id, page=1, raw_text="P-101", normalized_tag="P-101", type="Pump", category="equipment", confidence=0.95, status="resolved", source="perception"))
        db.add(TagModel(id=f"t_tk1_{uid}", job_id=job_id, page=1, raw_text="TK-101", normalized_tag="TK-101", type="Tank", category="equipment", confidence=0.95, status="resolved", source="perception"))
        db.commit()
    finally:
        db.close()

    resp = client.get(f"/api/v1/jobs/{job_id}/verification")
    assert resp.status_code == 200
    data = resp.json()
    assert "connection_validation" in data
    assert "io_verification" in data
    assert data["connection_validation"]["health_score_pct"] > 0
