import json
import os
import pytest
from fastapi.testclient import TestClient

from services.api.app.db.database import Base, SessionLocal, engine
from services.api.app.db.models import JobModel, TagModel
from services.api.app.db.schemas import GraphEdge, GraphNode, GraphSchema
from services.api.app.engine.merger import (
    MultiSheetMerger,
    RevisionDiffEngine,
    RevisionDiffSchema,
)
from services.api.app.main import app

client = TestClient(app)


def setup_module():
    Base.metadata.create_all(bind=engine)


def test_multi_sheet_merger_basic():
    merger = MultiSheetMerger(sheet_spacing_x=2000.0)

    # Sheet 1: Pump and Valve
    g1 = GraphSchema(
        version=1,
        nodes=[
            GraphNode(id="P-101", type="Pump", category="equipment", x=200.0, y=300.0, confidence=0.95),
            GraphNode(id="V-101", type="Valve", category="valve", x=400.0, y=300.0, confidence=0.92),
        ],
        edges=[
            GraphEdge(id="e1", source="P-101", target="V-101", line_type="process", directed=True)
        ],
        warnings=[]
    )

    # Sheet 2: Tank and Valve (with local colliding node id V-101)
    g2 = GraphSchema(
        version=1,
        nodes=[
            GraphNode(id="TK-201", type="Tank", category="equipment", x=300.0, y=400.0, confidence=0.98),
            GraphNode(id="V-101", type="Valve", category="valve", x=500.0, y=400.0, confidence=0.88),
        ],
        edges=[
            GraphEdge(id="e2", source="TK-201", target="V-101", line_type="process", directed=True)
        ],
        warnings=[]
    )

    merged = merger.merge_graphs([g1, g2], sheet_labels=["Sheet1", "Sheet2"])

    # 4 total nodes
    assert len(merged.nodes) == 4
    # Sheet 2 nodes should be offset by 2000px
    tk_node = next(n for n in merged.nodes if "TK-201" in n.id)
    assert tk_node.x == 2300.0

    # The colliding node on sheet 2 should be disambiguated with prefix
    s2_valve = next(n for n in merged.nodes if "Sheet2:V-101" in n.id)
    assert s2_valve.x == 2500.0

    # Check edges were preserved and remapped
    assert len(merged.edges) == 2
    s2_edge = next(e for e in merged.edges if e.source == "TK-201")
    assert s2_edge.target == "Sheet2:V-101"


def test_multi_sheet_merger_opc_stitching():
    merger = MultiSheetMerger(sheet_spacing_x=2200.0)

    # Sheet 1: TK-101 and an outgoing Off-Page Connector
    g1 = GraphSchema(
        version=1,
        nodes=[
            GraphNode(id="TK-101", type="Tank", category="equipment", x=300.0, y=250.0, confidence=0.95),
        ],
        edges=[],
        warnings=[]
    )

    # Sheet 2: P-201 and an incoming Off-Page Connector
    g2 = GraphSchema(
        version=1,
        nodes=[
            GraphNode(id="P-201", type="Pump", category="equipment", x=200.0, y=250.0, confidence=0.96),
        ],
        edges=[],
        warnings=[]
    )

    all_opcs = [
        {
            "label": "TO SHEET 2 LINE 10-P-101-CS",
            "sheet": 1,
            "bbox": [800, 240, 900, 260],
        },
        {
            "label": "FROM SHEET 1 LINE 10-P-101-CS",
            "sheet": 2,
            "bbox": [50, 240, 150, 260],
        }
    ]

    merged = merger.merge_graphs([g1, g2], sheet_labels=["S1", "S2"], all_opcs=all_opcs)

    # Should have stitched TK-101 to P-201 across sheets
    assert len(merged.edges) == 1
    opc_edge = merged.edges[0]
    assert "opc_bridge" in opc_edge.id
    assert opc_edge.source == "TK-101"
    assert opc_edge.target == "P-201"
    assert opc_edge.line_type == "process"


def test_revision_diff_engine_tag_and_edge_changes():
    tags_v1 = [
        {"id": "t1", "normalized_tag": "TK-101", "page": 1, "type": "Tank", "category": "equipment", "status": "resolved", "bbox": [100, 100, 200, 200]},
        {"id": "t2", "normalized_tag": "P-101", "page": 1, "type": "Pump", "category": "equipment", "status": "resolved", "bbox": [300, 100, 400, 200]},
        {"id": "t3", "normalized_tag": "TT-101", "page": 1, "type": "Temperature Transmitter", "category": "instrument", "status": "resolved", "bbox": [200, 300, 250, 350]},
    ]
    graph_v1 = {
        "edges": [
            {"source": "TK-101", "target": "P-101", "line_type": "process"}
        ]
    }

    # Rev 2: P-101 relocated by 80px, TT-101 removed, PSV-101 added, new edge added
    tags_v2 = [
        {"id": "t1_v2", "normalized_tag": "TK-101", "page": 1, "type": "Tank", "category": "equipment", "status": "resolved", "bbox": [100, 100, 200, 200]},
        {"id": "t2_v2", "normalized_tag": "P-101", "page": 1, "type": "Pump", "category": "equipment", "status": "resolved", "bbox": [380, 100, 480, 200]},
        {"id": "t4_v2", "normalized_tag": "PSV-101", "page": 1, "type": "Safety Valve", "category": "valve", "status": "resolved", "bbox": [150, 50, 200, 90]},
    ]
    graph_v2 = {
        "edges": [
            {"source": "TK-101", "target": "P-101", "line_type": "process"},
            {"source": "TK-101", "target": "PSV-101", "line_type": "process"},
        ]
    }

    diff = RevisionDiffEngine.compare_revisions(
        job_v1_id="job_rev_01",
        tags_v1=tags_v1,
        graph_v1=graph_v1,
        job_v2_id="job_rev_02",
        tags_v2=tags_v2,
        graph_v2=graph_v2,
    )

    assert diff.summary.added_tags_count == 1
    assert diff.added_tags[0].tag == "PSV-101"

    assert diff.summary.removed_tags_count == 1
    assert diff.removed_tags[0].tag == "TT-101"

    assert diff.summary.modified_tags_count == 1
    assert diff.modified_tags[0].tag == "P-101"
    assert any("relocated" in m for m in diff.modified_tags[0].details.get("modifications", []))

    assert diff.summary.unchanged_tags_count == 1
    assert diff.unchanged_tags[0].tag == "TK-101"

    assert diff.summary.added_edges_count == 1
    assert diff.summary.removed_edges_count == 0


def test_revision_diff_engine_io_list_tracking():
    io_v1 = [
        {"tag": "PT-101", "signal_type": "4-20mA", "range_low": "0", "range_high": "100", "units": "psi", "description": "Discharge Pressure"},
        {"tag": "LT-101", "signal_type": "4-20mA", "range_low": "0", "range_high": "10", "units": "m", "description": "Feed Level"},
    ]
    io_v2 = [
        {"tag": "PT-101", "signal_type": "HART", "range_low": "0", "range_high": "150", "units": "psi", "description": "Discharge Pressure"},
        {"tag": "FT-102", "signal_type": "Pulse", "range_low": "0", "range_high": "500", "units": "m3/h", "description": "Main Feed Flow"},
    ]

    diff = RevisionDiffEngine.compare_revisions(
        job_v1_id="job1",
        tags_v1=[],
        graph_v1={},
        job_v2_id="job2",
        tags_v2=[],
        graph_v2={},
        io_items_v1=io_v1,
        io_items_v2=io_v2,
    )

    assert len(diff.io_changes) == 3
    added_io = next(c for c in diff.io_changes if c.get("change") == "added_to_io_list")
    assert added_io["tag"] == "FT-102"

    removed_io = next(c for c in diff.io_changes if c.get("change") == "removed_from_io_list")
    assert removed_io["tag"] == "LT-101"

    mod_io = next(c for c in diff.io_changes if c.get("change") == "modified_in_io_list")
    assert mod_io["tag"] == "PT-101"
    assert any("signal_type" in m for m in mod_io["modifications"])
    assert any("range_high" in m for m in mod_io["modifications"])


def test_carry_forward_human_decisions():
    base_tags = [
        {
            "id": "t_base_01",
            "normalized_tag": "FT-101",
            "status": "resolved",
            "type": "Coriolis Flow Meter",
            "category": "instrument"
        },
        {
            "id": "t_base_02",
            "normalized_tag": "NOISE_ARTIFACT",
            "status": "rejected",
            "type": "Unknown",
            "category": "instrument"
        }
    ]

    current_tags = [
        {
            "id": "t_curr_01",
            "normalized_tag": "FT-101",
            "status": "needs_review",
            "type": "Flow Transmitter",
            "category": "instrument"
        },
        {
            "id": "t_curr_02",
            "normalized_tag": "NOISE_ARTIFACT",
            "status": "needs_review",
            "type": "Unknown",
            "category": "instrument"
        },
        {
            "id": "t_curr_03",
            "normalized_tag": "PT-202",
            "status": "needs_review",
            "type": "Pressure Transmitter",
            "category": "instrument"
        }
    ]

    updated = RevisionDiffEngine.carry_forward_human_decisions(base_tags, current_tags)

    # FT-101 should be auto-resolved with human type preserved
    ft_tag = next(t for t in updated if t["normalized_tag"] == "FT-101")
    assert ft_tag["status"] == "resolved"
    assert ft_tag["type"] == "Coriolis Flow Meter"
    assert ft_tag["source"] == "carried_forward"

    # NOISE_ARTIFACT should be rejected
    noise_tag = next(t for t in updated if t["normalized_tag"] == "NOISE_ARTIFACT")
    assert noise_tag["status"] == "rejected"

    # Brand new tag PT-202 should remain needs_review
    pt_tag = next(t for t in updated if t["normalized_tag"] == "PT-202")
    assert pt_tag["status"] == "needs_review"


def test_merge_jobs_api_flow(tmp_path):
    import uuid
    from services.api.app.config import get_settings
    settings = get_settings()

    uid = uuid.uuid4().hex[:8]
    j1_id = f"test-merge-s1-{uid}"
    j2_id = f"test-merge-s2-{uid}"

    j1_dir = os.path.join(settings.DATA_DIR, j1_id)
    j2_dir = os.path.join(settings.DATA_DIR, j2_id)
    os.makedirs(j1_dir, exist_ok=True)
    os.makedirs(j2_dir, exist_ok=True)

    g1 = {"version": 1, "nodes": [{"id": "P-101", "type": "Pump", "category": "equipment", "x": 100, "y": 100, "confidence": 0.95}], "edges": [], "warnings": []}
    g2 = {"version": 1, "nodes": [{"id": "TK-201", "type": "Tank", "category": "equipment", "x": 100, "y": 100, "confidence": 0.95}], "edges": [], "warnings": []}

    with open(os.path.join(j1_dir, "graph.json"), "w") as f:
        json.dump(g1, f)
    with open(os.path.join(j2_dir, "graph.json"), "w") as f:
        json.dump(g2, f)

    db = SessionLocal()
    try:
        db.add(JobModel(id=j1_id, status="done", stage="report", progress=1.0, pdf_path="d1.pdf", xlsx_path=""))
        db.add(JobModel(id=j2_id, status="done", stage="report", progress=1.0, pdf_path="d2.pdf", xlsx_path=""))
        db.add(TagModel(id=f"t_j1_1_{uid}", job_id=j1_id, page=1, raw_text="P-101", normalized_tag="P-101", type="Pump", category="equipment", confidence=0.95, status="resolved", source="perception"))
        db.add(TagModel(id=f"t_j2_1_{uid}", job_id=j2_id, page=1, raw_text="TK-201", normalized_tag="TK-201", type="Tank", category="equipment", confidence=0.95, status="resolved", source="perception"))
        db.commit()
    finally:
        db.close()

    # Call merge API endpoint
    resp = client.post("/api/v1/jobs/merge", json={"job_ids": [j1_id, j2_id], "merged_job_name": "Test Plant Unit"})
    assert resp.status_code == 201
    data = resp.json()
    assert "merged_job_id" in data
    assert data["nodes_count"] == 2
    assert data["status"] == "done"

    # Query diff between job 2 and job 1
    diff_resp = client.get(f"/api/v1/jobs/{j2_id}/diff?compare_to={j1_id}")
    assert diff_resp.status_code == 200
    diff_data = diff_resp.json()
    assert diff_data["summary"]["added_tags_count"] == 1
    assert diff_data["summary"]["removed_tags_count"] == 1
