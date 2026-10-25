from typing import Dict, List, Optional, Tuple
from services.api.app.db.schemas import GraphEdge, GraphNode, GraphSchema


def detect_sheet_operational_unit(graph: GraphSchema) -> str:
    """
    Detect the operational unit and process display title based on ISA-5.1 tags present.
    Matches the standardized displays from industrial DCS:
      - 4.1 OFFSPEC STORAGE AND LOADING (Sheet 157)
      - 4.2 FEED UNLOADING ARMS AND PUMPS A-F (Sheet 160)
      - 4.3 SAF PRODUCT STORAGE & SAF ADDITIVE DOSING UNIT (Sheet 190/191/207)
      - Dynamic General Process Display for other sheets
    """
    all_tags = [n.id.upper() for n in graph.nodes]
    tag_str = " ".join(all_tags)

    if any(k in tag_str for k in ["15701", "14-T-171", "14T171", "14-P-171", "14P171", "14-X-171", "14X171", "17101"]):
        return "4.1 OFFSPEC STORAGE AND LOADING"
    elif any(k in tag_str for k in ["111A", "111B", "112A", "112B", "14-P-112", "14-X-111"]):
        return "4.2 FEED UNLOADING ARMS AND PUMPS A-F"
    elif any(k in tag_str for k in ["190", "191", "207", "14-T-190", "14-T-191", "14-P-207"]):
        return "4.3 SAF PRODUCT STORAGE & SAF ADDITIVE DOSING UNIT"

    # Fallback to dominant equipment tag
    tanks = [n.id for n in graph.nodes if n.category == "equipment" and ("T-" in n.id or "TK-" in n.id or "tank" in n.type.lower())]
    if tanks:
        return f"PROCESS UNIT - {tanks[0]} STORAGE & TRANSFER"
    return "SMART PROCESS & INSTRUMENTATION SCHEMATIC"


def simplify_graph_layout(graph: GraphSchema) -> GraphSchema:
    """
    Simplify and align node coordinates for a clean, operator-friendly schematic sketch.
    Detects DCS operational layouts (e.g. 4.1 OFFSPEC STORAGE AND LOADING from #Example1)
    and arranges components into authentic industrial DCS HMI coordinates.
    """
    unit_title = detect_sheet_operational_unit(graph)
    simplified_nodes: List[GraphNode] = []
    node_pos: Dict[str, Tuple[float, float]] = {}

    # === SPECIALIZED DCS LAYOUT: 4.1 OFFSPEC STORAGE AND LOADING ===
    if "OFFSPEC STORAGE AND LOADING" in unit_title:
        # Predefined ergonomic DCS coordinates matching #Example1 HMI snapshot
        target_positions: Dict[str, Tuple[float, float]] = {
            # Loading Arm / Feed Truck
            "14-X-171": (195.0, 315.0),
            "14X171": (195.0, 315.0),
            "TRUCK": (195.0, 315.0),
            
            # Flow line DCS instruments & valves
            "14-FQ-15701": (245.0, 205.0),
            "14FQ15701": (245.0, 205.0),
            "14-FQIC-15701": (245.0, 255.0),
            "14FQIC15701": (245.0, 255.0),
            "14-FO-2502": (320.0, 245.0),
            "14FO2502": (320.0, 245.0),
            "14-FIC-15701": (430.0, 240.0),
            "14FIC15701": (430.0, 240.0),
            "14-FV-15701": (430.0, 305.0),
            "14FV15701": (430.0, 305.0),
            "CV-15701": (430.0, 305.0),

            # Feed headers & Connectors
            "14-T-211A-D": (150.0, 385.0),
            "01-P-403": (150.0, 465.0),
            "06-V-001": (150.0, 505.0),

            # Storage Tank & Top/Side Transmitters
            "14-T-171": (690.0, 505.0),
            "14T171": (690.0, 505.0),
            "14-LAX-15703": (690.0, 335.0),
            "14LAX15703": (690.0, 335.0),
            "14-LI-15702": (690.0, 380.0),
            "14LI15702": (690.0, 380.0),
            "14-LT-15702": (690.0, 380.0),
            "14-LZI-15701": (810.0, 395.0),
            "14LZI15701": (810.0, 395.0),
            "14-LZT-15701": (810.0, 395.0),

            # Steam heating loop on tank coil
            "14-TIC-15701": (820.0, 455.0),
            "14TIC15701": (820.0, 455.0),
            "14-TV-15701": (900.0, 495.0),
            "14TV15701": (900.0, 495.0),
            "14-TT-15701": (820.0, 455.0),
            "LP STEAM HDR": (1030.0, 495.0),
            "LP COND HDR": (1030.0, 580.0),
            "TO 14-A-401A/B": (1030.0, 300.0),

            # Bottom Pump & Discharge
            "14-P-171": (540.0, 630.0),
            "14P171": (540.0, 630.0),
            "14-PM-171": (540.0, 630.0),
        }

        assigned_nodes = set()
        for node in graph.nodes:
            norm_id = node.id.replace("_", "-").strip()
            compact_id = norm_id.replace("-", "")
            
            target_xy = None
            for key, pos in target_positions.items():
                if key in (norm_id, compact_id, node.id):
                    target_xy = pos
                    break

            if target_xy:
                x, y = target_xy
            else:
                # Place unmapped nodes gracefully
                idx = len(assigned_nodes)
                x = 1050.0 + (idx % 3) * 90.0
                y = 200.0 + (idx // 3) * 80.0

            assigned_nodes.add(node.id)
            node_pos[node.id] = (x, y)
            simplified_nodes.append(
                GraphNode(
                    id=node.id,
                    type=node.type,
                    category=node.category,
                    x=x,
                    y=y,
                    confidence=node.confidence,
                    tag_id=node.tag_id,
                    warnings=node.warnings
                )
            )

        return GraphSchema(
            version=graph.version,
            nodes=simplified_nodes,
            edges=graph.edges,
            warnings=graph.warnings
        )

    # === GENERAL DCS ALIGNED LAYOUT ===
    process_nodes = [n for n in graph.nodes if n.category in ["equipment", "valve"]]
    instrument_nodes = [n for n in graph.nodes if n.category == "instrument"]

    # Sort process nodes primarily by x-coordinate (flow left-to-right)
    process_nodes.sort(key=lambda n: n.x)

    start_x = 180
    step_x = 220
    center_y = 380

    for idx, node in enumerate(process_nodes):
        x = start_x + (idx * step_x)
        y = center_y
        
        # Parallel pumps offset vertically
        if "B" in node.id and ("P-" in node.id or "PUMP" in node.type.upper()):
            y = center_y + 110
            base_tag = node.id.replace("B", "A")
            if base_tag in node_pos:
                x = node_pos[base_tag][0]
        
        node_pos[node.id] = (x, y)
        simplified_nodes.append(
            GraphNode(
                id=node.id,
                type=node.type,
                category=node.category,
                x=x,
                y=y,
                confidence=node.confidence,
                tag_id=node.tag_id,
                warnings=node.warnings
            )
        )

    # Attach instruments directly above connected equipment/valves as DCS faceplates
    for idx, inst in enumerate(instrument_nodes):
        connected_eq = None
        for edge in graph.edges:
            if edge.source == inst.id and edge.target in node_pos:
                connected_eq = edge.target
                break
            elif edge.target == inst.id and edge.source in node_pos:
                connected_eq = edge.source
                break

        if connected_eq and connected_eq in node_pos:
            base_x, base_y = node_pos[connected_eq]
            y_offset = -120 if idx % 2 == 0 else 120
            x = base_x + (idx % 2 * 30)
            y = base_y + y_offset
        else:
            x = start_x + (idx * 160)
            y = center_y - 140

        node_pos[inst.id] = (x, y)
        simplified_nodes.append(
            GraphNode(
                id=inst.id,
                type=inst.type,
                category=inst.category,
                x=x,
                y=y,
                confidence=inst.confidence,
                tag_id=inst.tag_id,
                warnings=inst.warnings
            )
        )

    return GraphSchema(
        version=graph.version,
        nodes=simplified_nodes,
        edges=graph.edges,
        warnings=graph.warnings
    )

