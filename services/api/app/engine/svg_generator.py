from typing import Dict, List, Tuple
from services.api.app.db.schemas import GraphEdge, GraphNode, GraphSchema


def render_symbol_svg(node: GraphNode) -> str:
    x, y = node.x, node.y
    tag = node.id
    cat = node.category
    conf_pct = int(node.confidence * 100)
    
    # Confidence border color
    badge_color = "#10B981" if node.confidence >= 0.85 else ("#F59E0B" if node.confidence >= 0.60 else "#EF4444")

    # 1. Tank
    if "tank" in node.type.lower() or "TK-" in tag:
        w, h = 90, 130
        rx, ry = x - w/2, y - h/2
        return f"""
        <g class="pid-node equipment-tank" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <!-- Tank Shell -->
            <rect x="{rx}" y="{ry}" width="{w}" height="{h}" rx="14" ry="14" fill="#1E293B" stroke="#38BDF8" stroke-width="2.5" />
            <path d="M {rx} {ry+20} L {rx+w} {ry+20} M {rx} {ry+h-20} L {rx+w} {ry+h-20}" stroke="#334155" stroke-dasharray="3,3" />
            <!-- Tag & Label -->
            <text x="{x}" y="{y-12}" font-family="Inter, sans-serif" font-weight="700" font-size="13" fill="#F8FAFC" text-anchor="middle">{tag}</text>
            <text x="{x}" y="{y+8}" font-family="Inter, sans-serif" font-size="10" fill="#94A3B8" text-anchor="middle">{node.type}</text>
            <!-- Confidence Badge -->
            <rect x="{x-22}" y="{ry+h-14}" width="44" height="16" rx="4" fill="{badge_color}" />
            <text x="{x}" y="{ry+h-2}" font-family="Inter, sans-serif" font-size="9" font-weight="600" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 2. Pump
    elif "pump" in node.type.lower() or "P-" in tag:
        r = 30
        return f"""
        <g class="pid-node equipment-pump" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <circle cx="{x}" cy="{y}" r="{r}" fill="#1E293B" stroke="#38BDF8" stroke-width="2.5" />
            <!-- Tangential discharge triangle -->
            <polygon points="{x-8},{y-r} {x+8},{y-r} {x},{y-r-16}" fill="#38BDF8" />
            <text x="{x}" y="{y-4}" font-family="Inter, sans-serif" font-weight="700" font-size="12" fill="#F8FAFC" text-anchor="middle">{tag}</text>
            <text x="{x}" y="{y+12}" font-family="Inter, sans-serif" font-size="9" fill="#94A3B8" text-anchor="middle">PUMP</text>
            <!-- Badge -->
            <rect x="{x-18}" y="{y+r+4}" width="36" height="14" rx="3" fill="{badge_color}" />
            <text x="{x}" y="{y+r+14}" font-family="Inter, sans-serif" font-size="8" font-weight="600" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 3. Heat Exchanger
    elif "exchanger" in node.type.lower() or "E-" in tag:
        w, h = 80, 50
        rx, ry = x - w/2, y - h/2
        return f"""
        <g class="pid-node equipment-hex" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <rect x="{rx}" y="{ry}" width="{w}" height="{h}" rx="25" fill="#1E293B" stroke="#38BDF8" stroke-width="2.5" />
            <path d="M {rx+15} {y} L {rx+w-15} {y}" stroke="#64748B" stroke-width="2" />
            <text x="{x}" y="{y-5}" font-family="Inter, sans-serif" font-weight="700" font-size="12" fill="#F8FAFC" text-anchor="middle">{tag}</text>
            <text x="{x}" y="{y+10}" font-family="Inter, sans-serif" font-size="9" fill="#94A3B8" text-anchor="middle">EXCHANGER</text>
            <rect x="{x-18}" y="{ry+h+4}" width="36" height="14" rx="3" fill="{badge_color}" />
            <text x="{x}" y="{ry+h+14}" font-family="Inter, sans-serif" font-size="8" font-weight="600" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 4. Control Valve
    elif "valve" in cat or "valve" in node.type.lower() or "CV-" in tag or "XV-" in tag or "PSV-" in tag or "HV-" in tag:
        # Opposing bowtie triangles + actuator
        is_control = "CV" in tag or "control" in node.type.lower()
        is_manual = "HV" in tag or "manual" in node.type.lower()
        return f"""
        <g class="pid-node valve" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <!-- Left and Right Triangles -->
            <polygon points="{x-22},{y-12} {x},{y} {x-22},{y+12}" fill="#1E293B" stroke="#F59E0B" stroke-width="2" />
            <polygon points="{x+22},{y-12} {x},{y} {x+22},{y+12}" fill="#1E293B" stroke="#F59E0B" stroke-width="2" />
            <!-- Stem and Actuator -->
            <line x1="{x}" y1="{y}" x2="{x}" y2="{y-16}" stroke="#F59E0B" stroke-width="2" />
            {'<path d="M ' + str(x-14) + ' ' + str(y-16) + ' A 14 10 0 0 1 ' + str(x+14) + ' ' + str(y-16) + ' Z" fill="#F59E0B" />' if is_control else ('<line x1="' + str(x-12) + '" y1="' + str(y-16) + '" x2="' + str(x+12) + '" y2="' + str(y-16) + '" stroke="#F59E0B" stroke-width="2.5" />' if is_manual else '<circle cx="' + str(x) + '" cy="' + str(y-16) + '" r="5" fill="#F59E0B" />')}
            <text x="{x}" y="{y+26}" font-family="Inter, sans-serif" font-weight="700" font-size="11" fill="#F8FAFC" text-anchor="middle">{tag}</text>
            <rect x="{x-18}" y="{y+32}" width="36" height="13" rx="3" fill="{badge_color}" />
            <text x="{x}" y="{y+41}" font-family="Inter, sans-serif" font-size="8" font-weight="600" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 5. ISA-5.1 Instrument Bubble
    else:
        r = 24
        is_dcs = "IC" in tag or "FIC" in tag or "LIC" in tag
        dash_style = 'stroke-dasharray="4,3"' if is_dcs else ''
        return f"""
        <g class="pid-node instrument-bubble" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <circle cx="{x}" cy="{y}" r="{r}" fill="#0F172A" stroke="#E2E8F0" stroke-width="2" />
            <!-- Internal Division Line -->
            <line x1="{x-r+2}" y1="{y}" x2="{x+r-2}" y2="{y}" stroke="#E2E8F0" stroke-width="1.5" {dash_style} />
            <text x="{x}" y="{y-6}" font-family="Inter, sans-serif" font-weight="700" font-size="10" fill="#38BDF8" text-anchor="middle">{tag.split('-')[0] if '-' in tag else tag[:2]}</text>
            <text x="{x}" y="{y+13}" font-family="Inter, sans-serif" font-size="10" fill="#F8FAFC" text-anchor="middle">{tag.split('-')[1] if '-' in tag else tag[2:]}</text>
            <rect x="{x-16}" y="{y+r+3}" width="32" height="13" rx="3" fill="{badge_color}" />
            <text x="{x}" y="{y+r+12}" font-family="Inter, sans-serif" font-size="8" font-weight="600" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """


def generate_svg_sketch(graph: GraphSchema) -> str:
    """
    Render clean, interactive, responsive SVG process sketch from simplified GraphSchema.
    """
    node_map = {n.id: n for n in graph.nodes}

    # Calculate bounding envelope
    max_x = max((n.x for n in graph.nodes), default=1200) + 150
    max_y = max((n.y for n in graph.nodes), default=600) + 150
    width = max(1400, int(max_x))
    height = max(700, int(max_y))

    svg_parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%" style="background-color: #0B0F19;">',
        """
        <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8" />
            </marker>
            <marker id="arrow-signal" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#A855F7" />
            </marker>
            <!-- Grid Pattern -->
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" stroke-width="0.8" />
            </pattern>
        </defs>
        <!-- Background Grid -->
        <rect width="100%" height="100%" fill="url(#grid)" />
        """
    ]

    # Draw Edges (Lines)
    svg_parts.append('<g class="edges-layer">')
    for edge in graph.edges:
        src = node_map.get(edge.source)
        dst = node_map.get(edge.target)
        if not src or not dst:
            continue

        is_process = edge.line_type == "process"
        color = "#38BDF8" if is_process else "#A855F7"
        width_stroke = 2.5 if is_process else 1.5
        dash = "" if is_process else 'stroke-dasharray="5,4"'
        marker = 'marker-end="url(#arrow)"' if (edge.directed and is_process) else ('marker-end="url(#arrow-signal)"' if edge.directed else '')

        # Manhattan routing: horizontal-then-vertical or direct
        if abs(src.y - dst.y) < 15:
            d_path = f"M {src.x} {src.y} L {dst.x} {dst.y}"
        else:
            mid_x = (src.x + dst.x) / 2
            d_path = f"M {src.x} {src.y} L {mid_x} {src.y} L {mid_x} {dst.y} L {dst.x} {dst.y}"

        svg_parts.append(
            f'<path d="{d_path}" fill="none" stroke="{color}" stroke-width="{width_stroke}" {dash} {marker} '
            f'data-source="{edge.source}" data-target="{edge.target}" data-line-type="{edge.line_type}" opacity="0.85" />'
        )
    svg_parts.append('</g>')

    # Draw Nodes (Symbols)
    svg_parts.append('<g class="nodes-layer">')
    for node in graph.nodes:
        svg_parts.append(render_symbol_svg(node))
    svg_parts.append('</g>')

    # Drawing Title & Metadata overlay
    svg_parts.append(f"""
    <g class="title-block" transform="translate(40, 40)">
        <text font-family="Inter, sans-serif" font-size="16" font-weight="700" fill="#F8FAFC">FEED PRETREATMENT &amp; PUMPING PROCESS</text>
        <text y="22" font-family="Inter, sans-serif" font-size="11" fill="#64748B">UNTANGLE Operator Verified Schematic • Nodes: {len(graph.nodes)} • Edges: {len(graph.edges)}</text>
    </g>
    """)

    svg_parts.append('</svg>')
    return "\n".join(svg_parts)
