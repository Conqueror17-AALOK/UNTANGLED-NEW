from typing import Dict, List, Tuple
from services.api.app.db.schemas import GraphEdge, GraphNode, GraphSchema


def simplify_graph_layout(graph: GraphSchema) -> GraphSchema:
    """
    Simplify and align node coordinates for a clean, operator-friendly schematic sketch.
    Arranges process equipment left-to-right along a primary flow axis, with instruments attached vertically.
    """
    simplified_nodes: List[GraphNode] = []
    
    # Separate equipment/valves (main process flow) from instruments
    process_nodes = [n for n in graph.nodes if n.category in ["equipment", "valve"]]
    instrument_nodes = [n for n in graph.nodes if n.category == "instrument"]

    # Sort process nodes primarily by x-coordinate (flow left-to-right)
    process_nodes.sort(key=lambda n: n.x)

    # Assign aligned coordinates along flow line
    start_x = 120
    step_x = 180
    center_y = 350

    node_pos: Dict[str, Tuple[float, float]] = {}

    for idx, node in enumerate(process_nodes):
        x = start_x + (idx * step_x)
        # Pumps in parallel: offset slightly vertically
        y = center_y
        if "P-101B" in node.id:
            y = center_y + 110
            x = node_pos.get("P-101A", (x, center_y))[0]
        
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

    # Attach instruments near their connected equipment or valves
    for idx, inst in enumerate(instrument_nodes):
        # Find which equipment this instrument is connected to
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
            # Alternate instrument positions above and below
            y_offset = -140 if idx % 2 == 0 else 140
            x = base_x + (idx % 2 * 30)
            y = base_y + y_offset
        else:
            x = start_x + (idx * 160)
            y = center_y - 150

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
