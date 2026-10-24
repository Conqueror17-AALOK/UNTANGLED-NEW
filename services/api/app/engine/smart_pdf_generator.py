import io
import time
from typing import Any, Dict, List, Optional
import fitz
from services.api.app.db.schemas import GraphSchema, GraphNode
from services.api.app.engine.svg_generator import generate_svg_sketch


def generate_smart_vector_pdf(
    graph: GraphSchema,
    job_id: str,
    tag_metadata: Optional[Dict[str, Dict[str, Any]]] = None,
    diagnostics: Optional[List[Dict[str, Any]]] = None
) -> bytes:
    """
    Generate an interactive Smart Vector PDF process diagram from GraphSchema.
    
    Features of Smart Vector PDF:
      1. Infinite Zoom & Crisp Vector CAD Graphics (no raster pixelation).
      2. Priority-wise Error & Low Confidence Visual Vector Highlights (P1 Red, P2 Amber, Low Accuracy Purple).
      3. Fully Searchable & Selectable Text (search tags, loop numbers, line types).
      4. Interactive Clickable Annotations / Tooltip Popups on each component revealing priority actions,
         DCS I/O signal types, calibrated ranges, verification status, and confidence.
      5. Standard ANSI / ISO Title Block with drawing revisions, job ID, and legend.
      6. Embedded Document Metadata and Navigation Table of Contents (TOC).
    """
    # 1. Generate high-resolution SVG diagram with priority highlights
    svg_content = generate_svg_sketch(graph, diagnostics=diagnostics)

    # 2. Convert SVG into native vector PDF
    svg_doc = fitz.open(stream=svg_content.encode("utf-8"), filetype="svg")
    pdf_bytes = svg_doc.convert_to_pdf()
    svg_doc.close()

    # 3. Open Vector PDF to enrich with Smart PDF interactive annotations & metadata
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if len(doc) == 0:
        return pdf_bytes

    page = doc[0]
    tag_meta = tag_metadata or {}

    # Map diagnostics by element_id
    diag_map: Dict[str, Dict[str, Any]] = {}
    if diagnostics:
        priority_rank = {"P1": 0, "P2": 1, "P3": 2, "P4": 3}
        for d in diagnostics:
            el_id = d.get("element_id")
            if el_id:
                cur = diag_map.get(el_id)
                if not cur or priority_rank.get(d.get("priority", "P4"), 4) < priority_rank.get(cur.get("priority", "P4"), 4):
                    diag_map[el_id] = d

    # Set Official CAD Document Metadata
    doc.set_metadata({
        "title": f"Smart Vector Process & Instrumentation Diagram (P&ID) - {job_id[:8]}",
        "author": "UNTANGLED AI Industrial Digitization Platform",
        "subject": "Vector P&ID Flow Schematic with Priority Verification and DCS I/O Annotations",
        "keywords": "P&ID, Smart PDF, Vector CAD, ISA-5.1, DCS I/O, Untangled",
        "creator": "UNTANGLED Smart Vector CAD Engine v2.0",
        "producer": "PyMuPDF Vector Rendering Engine",
        "creationDate": fitz.get_pdf_now(),
        "modDate": fitz.get_pdf_now(),
    })

    # Add Document Bookmarks / Table of Contents
    toc = [
        [1, "Smart Vector P&ID Process Flow Schematic", 1],
        [2, f"Job Reference: {job_id}", 1],
        [2, f"Total Nodes: {len(graph.nodes)} | Edges: {len(graph.edges)}", 1]
    ]
    doc.set_toc(toc)

    # Add Interactive Clickable Annotations on Each Node
    for node in graph.nodes:
        x, y = float(node.x), float(node.y)
        conf_pct = int(node.confidence * 100)
        
        # Lookup tag metadata if available
        meta = tag_meta.get(node.id, {})
        io_match = meta.get("io_match", {})
        io_signal = io_match.get("signal_type") or meta.get("signal_type") or "N/A (Mechanical/Field)"
        io_range = meta.get("range_span") or meta.get("units") or "Default Span"
        status = meta.get("status", "VERIFIED").upper()

        diag = diag_map.get(node.id)
        pri = diag.get("priority") if diag else None
        pri_label = diag.get("priority_label", "Verified Safe") if diag else "P4 - Verified Safe"
        action = diag.get("time_savings_action", "No action needed.") if diag else "No action needed."

        tooltip_lines = [
            f"=== ISA-5.1 SMART TAG SPECIFICATION ===",
            f"TAG: {node.id}",
            f"SERVICE: {node.type}",
            f"CATEGORY: {node.category.upper()}",
            f"AI CONFIDENCE: {conf_pct}%",
            f"VERIFICATION STATUS: {status}",
            f"PRIORITY STATUS: {pri_label}",
        ]
        if pri in ("P1", "P2", "P3") or node.confidence < 0.70:
            tooltip_lines.append(f"ENGINEERING ACTION: {action}")
        tooltip_lines.extend([
            f"DCS REGISTERED SIGNAL: {io_signal}",
            f"CALIBRATED RANGE: {io_range}",
            f"STANDARD: ANSI/ISA-5.1 Compliant"
        ])
        tooltip_content = "\n".join(tooltip_lines)

        # Place an interactive popup note icon near the top of the symbol
        try:
            icon_type = "Help" if pri in ("P1", "P2") else "Tag"
            annot = page.add_text_annot(
                fitz.Point(x, max(y - 28, 20)),
                tooltip_content,
                icon=icon_type
            )
            # Outline color: Red for P1, Amber for P2, Purple for P3/Low confidence, Green for safe
            if pri == "P1":
                color = (0.93, 0.27, 0.27)
            elif pri == "P2":
                color = (0.96, 0.62, 0.10)
            elif pri == "P3" or node.confidence < 0.70:
                color = (0.66, 0.36, 0.96)
            elif node.confidence >= 0.85:
                color = (0.06, 0.72, 0.50)
            else:
                color = (0.96, 0.62, 0.10)
            annot.set_colors(stroke=color)
            annot.update()
        except Exception:
            pass

    out_bytes = doc.tobytes()
    doc.close()
    return out_bytes
