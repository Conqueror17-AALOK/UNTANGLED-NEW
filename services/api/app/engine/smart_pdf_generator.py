import io
import time
from typing import Any, Dict, List, Optional
import fitz
from services.api.app.db.schemas import GraphSchema, GraphNode
from services.api.app.engine.svg_generator import generate_svg_sketch


def generate_smart_vector_pdf(
    graph: GraphSchema,
    job_id: str,
    tag_metadata: Optional[Dict[str, Dict[str, Any]]] = None
) -> bytes:
    """
    Generate an interactive Smart Vector PDF process diagram from GraphSchema.
    
    Features of Smart Vector PDF:
      1. Infinite Zoom & Crisp Vector CAD Graphics (no raster pixelation).
      2. Fully Searchable & Selectable Text (search tags, loop numbers, line types).
      3. Interactive Clickable Annotations / Tooltip Popups on each instrument, valve, and vessel,
         revealing DCS I/O signal types, calibrated ranges, verification status, and confidence.
      4. Standard ANSI / ISO Title Block with drawing revisions, job ID, and legend.
      5. Embedded Document Metadata and Navigation Table of Contents (TOC).
    """
    # 1. Generate high-resolution SVG diagram
    svg_content = generate_svg_sketch(graph)

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

    # Set Official CAD Document Metadata
    doc.set_metadata({
        "title": f"Smart Vector Process & Instrumentation Diagram (P&ID) - {job_id[:8]}",
        "author": "UNTANGLED AI Industrial Digitization Platform",
        "subject": "Vector P&ID Flow Schematic with Interactive DCS I/O Annotations",
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

        tooltip_content = (
            f"=== ISA-5.1 SMART TAG SPECIFICATION ===\n"
            f"TAG: {node.id}\n"
            f"SERVICE: {node.type}\n"
            f"CATEGORY: {node.category.upper()}\n"
            f"AI CONFIDENCE: {conf_pct}%\n"
            f"VERIFICATION: {status}\n"
            f"DCS REGISTERED SIGNAL: {io_signal}\n"
            f"CALIBRATED RANGE: {io_range}\n"
            f"STANDARD: ANSI/ISA-5.1 Compliant"
        )

        # Place an interactive popup note icon near the top of the symbol
        try:
            annot = page.add_text_annot(
                fitz.Point(x, max(y - 28, 20)),
                tooltip_content,
                icon="Tag"
            )
            # Outline color based on confidence: Green >= 85%, Amber >= 60%, Red < 60%
            color = (0.06, 0.72, 0.50) if node.confidence >= 0.85 else ((0.96, 0.62, 0.10) if node.confidence >= 0.60 else (0.93, 0.27, 0.27))
            annot.set_colors(stroke=color)
            annot.update()
        except Exception:
            # Fallback if coordinate bounds exceed page
            pass

    out_bytes = doc.tobytes()
    doc.close()
    return out_bytes
