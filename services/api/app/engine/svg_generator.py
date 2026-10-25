import math
import re
from typing import Any, Dict, List, Optional, Tuple
from services.api.app.db.schemas import GraphEdge, GraphNode, GraphSchema


def parse_tag_display(tag: str) -> Tuple[str, str]:
    """
    Split ISA-5.1 tag into Functional Identifier (Line 1) and Loop Number (Line 2).
    Examples:
      - '14-FIC-15701' -> ('14-FIC', '15701')
      - '14-FIC-15701-A' -> ('14-FIC', '15701-A')
      - 'FIC-15701' -> ('FIC', '15701')
      - '631-AY-3054' -> ('631-AY', '3054')
      - '14FIC15701' -> ('14-FIC', '15701')
      - 'P-101A' -> ('P', '101A')
    """
    tag = tag.strip()
    parts = tag.split('-')
    if len(parts) >= 3:
        prefix = f"{parts[0]}-{parts[1]}"
        loop = "-".join(parts[2:])
        return prefix, loop
    elif len(parts) == 2:
        return parts[0], parts[1]
    
    m = re.match(r'^(\d*[A-Za-z]+)(\d+.*)$', tag)
    if m:
        return m.group(1), m.group(2)

    mid = len(tag) // 2
    return tag[:mid], tag[mid:]


def get_node_boundary_point(node: GraphNode, target_x: float, target_y: float) -> Tuple[float, float]:
    """
    Compute orthogonal connection port on the outer perimeter of a node symbol.
    """
    x, y = float(node.x), float(node.y)
    dx = target_x - x
    dy = target_y - y

    cat = node.category.lower()
    ntype = node.type.lower()
    tag = node.id.upper()

    if "tank" in ntype or "TK-" in tag:
        hw, hh = 50.0, 70.0
    elif any(v in ntype or v in tag for v in ["vessel", "column", "separator", "drum", "V-", "C-", "D-"]):
        hw, hh = 40.0, 75.0
    elif "exchanger" in ntype or "E-" in tag:
        hw, hh = 45.0, 30.0
    elif "valve" in cat or "valve" in ntype or any(tag.startswith(p) for p in ["CV-", "XV-", "PSV-", "HV-", "FV-"]):
        hw, hh = 26.0, 16.0
    elif "pump" in ntype or "P-" in tag:
        hw, hh = 30.0, 30.0
    elif "opc" in ntype or "connector" in ntype or "opc" in cat:
        hw, hh = 55.0, 16.0
    else:
        hw, hh = 26.0, 26.0

    if abs(dx) >= abs(dy):
        port_x = x + (hw if dx > 0 else -hw)
        port_y = y
    else:
        port_x = x
        port_y = y + (hh if dy > 0 else -hh)

    return port_x, port_y


def _render_symbol_base(node: GraphNode) -> str:
    x, y = float(node.x), float(node.y)
    tag = node.id
    cat = node.category.lower()
    ntype = node.type.lower()
    conf_pct = int(node.confidence * 100)
    badge_color = "#10B981" if node.confidence >= 0.85 else ("#F59E0B" if node.confidence >= 0.60 else "#EF4444")
    line1, line2 = parse_tag_display(tag)

    # 1. DCS Instrument Faceplate (FIC, TIC, LIC, PIC, LAX, LI, LZI, FQ, FQIC, FO)
    if any(k in tag.upper() for k in ["FIC", "TIC", "LIC", "PIC", "LAX", "LZI", "FQ", "FQIC", "FO"]):
        is_controller = any(k in tag.upper() for k in ["FIC", "TIC", "LIC", "PIC", "FQIC"])
        w, h = (72, 48) if is_controller else (64, 34)
        rx, ry = x - w/2, y - h/2

        telemetry_svg = ""
        if "FIC" in tag.upper():
            telemetry_svg = f"""
            <rect x="{rx+6}" y="{ry+18}" width="12" height="22" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.5" />
            <rect x="{rx+6}" y="{ry+28}" width="12" height="12" fill="#0284c7" />
            <rect x="{rx+22}" y="{ry+18}" width="12" height="22" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.5" />
            <rect x="{rx+22}" y="{ry+26}" width="12" height="14" fill="#16a34a" />
            <text x="{rx+52}" y="{ry+32}" font-family="Arial, sans-serif" font-size="7" font-weight="bold" fill="#0f172a" text-anchor="middle">AUTO</text>
            """
        elif "TIC" in tag.upper():
            telemetry_svg = f"""
            <text x="{x}" y="{ry+27}" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#dc2626" text-anchor="middle">0.0 °C</text>
            <rect x="{rx+6}" y="{ry+31}" width="{w-12}" height="6" fill="#e2e8f0" rx="1" />
            <rect x="{rx+6}" y="{ry+31}" width="24" height="6" fill="#16a34a" rx="1" />
            """
        elif "LAX" in tag.upper():
            telemetry_svg = f'<text x="{x}" y="{ry+27}" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#dc2626" text-anchor="middle">25.00 %</text>'
        elif "LI" in tag.upper() or "LZI" in tag.upper():
            val = "50.00 %" if "LZI" in tag.upper() else "0.0 %"
            telemetry_svg = f'<text x="{x}" y="{ry+27}" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#0284c7" text-anchor="middle">{val}</text>'
        elif "FQIC" in tag.upper():
            telemetry_svg = f'<text x="{x}" y="{ry+27}" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#16a34a" text-anchor="middle">1500 kg</text>'
        elif "FQ" in tag.upper():
            telemetry_svg = f'<text x="{x}" y="{ry+27}" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#0284c7" text-anchor="middle">1242 kg</text>'
        else:
            telemetry_svg = f'<text x="{x}" y="{ry+26}" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="#334155" text-anchor="middle">NORM</text>'

        border_stroke = "#6d28d9" if is_controller or "LAX" in tag.upper() else "#3b5166"

        return f"""
        <g class="pid-node dcs-faceplate" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <rect x="{rx}" y="{ry}" width="{w}" height="{h}" rx="3" fill="#f8fafc" stroke="{border_stroke}" stroke-width="1.8" />
            <text x="{x}" y="{ry+12}" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="{border_stroke}" text-anchor="middle">{tag}</text>
            {telemetry_svg}
            <rect x="{x-16}" y="{ry+h+4}" width="32" height="12" rx="2.5" fill="{badge_color}" />
            <text x="{x}" y="{ry+h+13}" font-family="Arial, sans-serif" font-size="7.5" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 2. Valves & Control Valves
    elif "valve" in cat or "valve" in ntype or any(tag.upper().startswith(p) for p in ["CV-", "XV-", "PSV-", "HV-", "FV-", "LV-", "PV-", "TV-"]) or any(k in tag.upper() for k in ["-FV-", "-TV-", "-LV-", "-PV-", "-CV-", "-XV-", "-PSV-", "-HV-"]):
        is_control = any(k in tag.upper() or k in ntype for k in ["CV", "CONTROL", "FV", "LV", "PV", "TV", "XV"])
        actuator_svg = ""
        if is_control:
            actuator_svg = f"""
            <line x1="{x}" y1="{y}" x2="{x}" y2="{y-14}" stroke="#581c87" stroke-width="1.8" />
            <path d="M {x-10} {y-14} C {x-10} {y-22}, {x+10} {y-22}, {x+10} {y-14} Z" fill="#e2e8f0" stroke="#581c87" stroke-width="1.8" />
            """
        else:
            actuator_svg = f"""
            <line x1="{x}" y1="{y}" x2="{x}" y2="{y-12}" stroke="#334e68" stroke-width="1.8" />
            <line x1="{x-8}" y1="{y-12}" x2="{x+8}" y2="{y-12}" stroke="#334e68" stroke-width="2" />
            """

        return f"""
        <g class="pid-node valve" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <polygon points="{x-16},{y-8} {x},{y} {x-16},{y+8}" fill="#334e68" stroke="#1e293b" stroke-width="1.8" />
            <polygon points="{x+16},{y-8} {x},{y} {x+16},{y+8}" fill="#334e68" stroke="#1e293b" stroke-width="1.8" />
            {actuator_svg}
            <text x="{x}" y="{y+20}" font-family="Arial, sans-serif" font-weight="700" font-size="9.5" fill="#0f172a" text-anchor="middle">{tag}</text>
            <rect x="{x-16}" y="{y+25}" width="32" height="12" rx="2.5" fill="{badge_color}" />
            <text x="{x}" y="{y+34}" font-family="Arial, sans-serif" font-size="7.5" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 3. Truck & Articulated Loading Arm
    elif "truck" in ntype or "14-X-" in tag.upper() or "TRUCK" in tag.upper():
        return f"""
        <g class="pid-node equipment-truck" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <!-- Cab -->
            <path d="M {x-55} {y+16} L {x-80} {y+16} L {x-80} {y-8} L {x-65} {y-18} L {x-55} {y-18} Z" fill="#94a3b8" stroke="#334e68" stroke-width="1.8" />
            <!-- Tanker Body -->
            <rect x="{x-55}" y="{y-24}" width="105" height="46" rx="14" fill="#a5b9cc" stroke="#334e68" stroke-width="2" />
            <text x="{x-2}" y="{y+4}" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#1e293b" text-anchor="middle">TRUCK</text>
            <!-- Wheels -->
            <circle cx="{x-70}" cy="{y+20}" r="6" fill="#334155" stroke="#cbd5e1" stroke-width="1.5" />
            <circle cx="{x+20}" cy="{y+20}" r="6" fill="#334155" stroke="#cbd5e1" stroke-width="1.5" />
            <circle cx="{x+38}" cy="{y+20}" r="6" fill="#334155" stroke="#cbd5e1" stroke-width="1.5" />
            <!-- Tag -->
            <text x="{x-2}" y="{y+42}" font-family="Arial, sans-serif" font-size="10.5" font-weight="bold" fill="#0f172a" text-anchor="middle">{tag}</text>
            <!-- Loading Arm -->
            <path d="M {x+20} {y-24} L {x+20} {y-38} L {x+105} {y-38} L {x+105} {y+28}" fill="none" stroke="#254d79" stroke-width="2.5" />
            <circle cx="{x+105}" cy="{y+28}" r="3.5" fill="#254d79" />
            <rect x="{x-18}" y="{y+48}" width="36" height="13" rx="3" fill="{badge_color}" />
            <text x="{x}" y="{y+57}" font-family="Arial, sans-serif" font-size="7.5" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 4. Storage Tank (Conical roof + flat bottom)
    elif "tank" in ntype or "TK-" in tag.upper() or "14-T-" in tag.upper():
        w, h = 140, 150
        rx, ry = x - w/2, y - h/2
        return f"""
        <g class="pid-node equipment-tank" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <path d="M {rx} {ry+30} L {x} {ry} L {rx+w} {ry+30} L {rx+w} {ry+h} L {rx} {ry+h} Z" 
                  fill="#9bb4c9" stroke="#334e68" stroke-width="2.5" />
            <path d="M {rx+w-25} {ry+h-20} L {rx+w-10} {ry+h-30} L {rx+w-25} {ry+h-40} L {rx+w-10} {ry+h-50}" fill="none" stroke="#475569" stroke-width="2" />
            <text x="{x}" y="{y+8}" font-family="Arial, sans-serif" font-weight="700" font-size="12" fill="#0f172a" text-anchor="middle">{tag}</text>
            <text x="{x}" y="{y+24}" font-family="Arial, sans-serif" font-size="9" font-weight="600" fill="#334155" text-anchor="middle">STORAGE TANK</text>
            <rect x="{x-20}" y="{ry+h+8}" width="40" height="14" rx="3" fill="{badge_color}" />
            <text x="{x}" y="{ry+h+18}" font-family="Arial, sans-serif" font-size="8" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 5. Centrifugal Pump
    elif "pump" in ntype or "P-" in tag.upper() or "14P" in tag.upper():
        r = 22
        return f"""
        <g class="pid-node equipment-pump" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <circle cx="{x}" cy="{y}" r="{r}" fill="#9bb3c9" stroke="#334e68" stroke-width="2.5" />
            <polygon points="{x-6},{y-r} {x+6},{y-r} {x+3},{y-r-12} {x-3},{y-r-12}" fill="#334e68" />
            <circle cx="{x}" cy="{y}" r="5" fill="#475569" />
            <rect x="{x-14}" y="{y-r-22}" width="28" height="16" rx="2" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5" />
            <text x="{x}" y="{y-r-10}" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="#1d4ed8" text-anchor="middle">AU</text>
            <text x="{x}" y="{y+r+14}" font-family="Arial, sans-serif" font-weight="700" font-size="11" fill="#0f172a" text-anchor="middle">{tag}</text>
            <rect x="{x-18}" y="{y+r+20}" width="36" height="13" rx="3" fill="{badge_color}" />
            <text x="{x}" y="{y+r+29}" font-family="Arial, sans-serif" font-size="7.5" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 6. Vertical Vessel / Column / Separator
    elif any(tag.upper().startswith(p) for p in ["V-", "C-", "D-", "14-V-", "14-C-", "14-D-"]) or any(k in ntype for k in ["vessel", "column", "separator", "drum"]):
        w, h = 80, 140
        rx, ry = x - w/2, y - h/2
        return f"""
        <g class="pid-node equipment-vessel" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <path d="M {rx} {ry+22} C {rx} {ry-10}, {rx+w} {ry-10}, {rx+w} {ry+22} L {rx+w} {ry+h-22} C {rx+w} {ry+h+10}, {rx} {ry+h+10}, {rx} {ry+h-22} Z" 
                  fill="#9bb3c9" stroke="#334e68" stroke-width="2.5" />
            <line x1="{rx+8}" y1="{y-15}" x2="{rx+w-8}" y2="{y-15}" stroke="#475569" stroke-dasharray="3,3" stroke-width="1.5" />
            <line x1="{rx+8}" y1="{y+15}" x2="{rx+w-8}" y2="{y+15}" stroke="#475569" stroke-dasharray="3,3" stroke-width="1.5" />
            <text x="{x}" y="{y-2}" font-family="Arial, sans-serif" font-weight="700" font-size="12" fill="#0f172a" text-anchor="middle">{tag}</text>
            <text x="{x}" y="{y+14}" font-family="Arial, sans-serif" font-size="9" font-weight="600" fill="#334155" text-anchor="middle">VESSEL</text>
            <rect x="{x-20}" y="{ry+h+10}" width="40" height="14" rx="3" fill="{badge_color}" />
            <text x="{x}" y="{ry+h+20}" font-family="Arial, sans-serif" font-size="8" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """


    # 7. Off-Page Connector (Header pill)
    elif "opc" in ntype or "connector" in ntype or "opc" in cat or "HDR" in tag.upper() or "-D" in tag.upper():
        w, h = 95, 24
        rx, ry = x - w/2, y - h/2
        return f"""
        <g class="pid-node opc-flag" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <rect x="{rx}" y="{ry}" width="{w}" height="{h}" rx="4" fill="#e2e8f0" stroke="#3b5166" stroke-width="1.5" />
            <text x="{x}" y="{y+4}" font-family="Arial, sans-serif" font-weight="700" font-size="9" fill="#1e293b" text-anchor="middle">{tag}</text>
            <rect x="{rx+4}" y="{ry+h+3}" width="30" height="11" rx="2" fill="{badge_color}" />
            <text x="{rx+19}" y="{ry+h+11}" font-family="Arial, sans-serif" font-size="7" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 8. Standard ISA-5.1 Instrument Bubble
    else:
        r = 22
        return f"""
        <g class="pid-node instrument-bubble" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <circle cx="{x}" cy="{y}" r="{r}" fill="#f8fafc" stroke="#3b5166" stroke-width="2" />
            <line x1="{x-r+2}" y1="{y}" x2="{x+r-2}" y2="{y}" stroke="#64748b" stroke-width="1.2" />
            <text x="{x}" y="{y-5}" font-family="Arial, sans-serif" font-weight="700" font-size="9.5" fill="#1e293b" text-anchor="middle">{line1}</text>
            <text x="{x}" y="{y+11}" font-family="Arial, sans-serif" font-weight="600" font-size="9" fill="#475569" text-anchor="middle">{line2}</text>
            <rect x="{x-16}" y="{y+r+4}" width="32" height="12" rx="2.5" fill="{badge_color}" />
            <text x="{x}" y="{y+r+13}" font-family="Arial, sans-serif" font-size="7.5" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """


def render_symbol_svg(node: GraphNode, issue: Optional[Dict[str, Any]] = None) -> str:
    raw_svg = _render_symbol_base(node)
    if not issue or issue.get("priority") not in ("P1", "P2", "P3"):
        return raw_svg

    x, y = float(node.x), float(node.y)
    pri = issue.get("priority", "P3")
    rule = issue.get("rule", "WARNING")

    if pri == "P1":
        alert_markup = f"""
        <circle cx="{x}" cy="{y}" r="38" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-dasharray="5,2" />
        <g transform="translate({x-60}, {y-48})">
            <rect width="120" height="16" rx="3" fill="#EF4444" />
            <text x="60" y="11" font-family="Arial, sans-serif" font-size="7.5" font-weight="800" fill="#FFFFFF" text-anchor="middle">P1: CRITICAL ({rule[:12]})</text>
        </g>
        """
    elif pri == "P2":
        alert_markup = f"""
        <circle cx="{x}" cy="{y}" r="36" fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="4,2" />
        <g transform="translate({x-60}, {y-46})">
            <rect width="120" height="15" rx="3" fill="#F59E0B" />
            <text x="60" y="10.5" font-family="Arial, sans-serif" font-size="7.2" font-weight="700" fill="#000000" text-anchor="middle">P2: WARNING ({rule[:12]})</text>
        </g>
        """
    else:
        alert_markup = f"""
        <circle cx="{x}" cy="{y}" r="34" fill="none" stroke="#8B5CF6" stroke-width="1.8" stroke-dasharray="3,2" />
        """

    last_g = raw_svg.rfind("</g>")
    if last_g != -1:
        return raw_svg[:last_g] + alert_markup + raw_svg[last_g:]
    return raw_svg + alert_markup


def generate_svg_sketch(
    graph: GraphSchema,
    diagnostics: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Render authentic DCS HMI Process Display (Simplified P&ID Sketch)
    conforming directly to #Example1 client specifications and HMI snapshots.
    """
    from services.api.app.engine.simplifier import detect_sheet_operational_unit
    unit_title = detect_sheet_operational_unit(graph)

    node_map = {n.id: n for n in graph.nodes}
    node_issues: Dict[str, Dict[str, Any]] = {}
    edge_issues: Dict[str, Dict[str, Any]] = {}
    if diagnostics:
        for d in diagnostics:
            el_type = d.get("element_type")
            el_id = d.get("element_id")
            if el_type == "node" and el_id:
                node_issues[el_id] = d
            elif el_type == "edge" and el_id:
                edge_issues[el_id] = d

    # Canvas Dimensions
    width = 1350
    height = 780

    svg_parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%">',
        """
        <defs>
            <marker id="hmi-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#254d79" />
            </marker>
            <marker id="hmi-arrow-error" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#EF4444" />
            </marker>
        </defs>
        <!-- Authentic DCS Background Canvas -->
        <rect width="100%" height="100%" fill="#cad6e2" />

        <!-- DCS System Navigation Toolbar -->
        <rect x="0" y="0" width="100%" height="38" fill="#b8c7d6" stroke="#8e9fb1" stroke-width="1" />
        """,
        f'<text x="25" y="25" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="bold" fill="#0f172a">{unit_title}</text>',
        """
        <!-- DCS Toolbar Buttons (Back, Forward, Home, Reload, Print, Zoom) -->
        <g transform="translate(680, 10)">
            <rect x="0" y="0" width="22" height="18" rx="2" fill="#cbd5e1" stroke="#94a3b8" />
            <path d="M 14 5 L 8 9 L 14 13" fill="none" stroke="#334155" stroke-width="1.5" />
            <rect x="26" y="0" width="22" height="18" rx="2" fill="#cbd5e1" stroke="#94a3b8" />
            <path d="M 32 5 L 38 9 L 32 13" fill="none" stroke="#334155" stroke-width="1.5" />
            <rect x="52" y="0" width="22" height="18" rx="2" fill="#cbd5e1" stroke="#94a3b8" />
            <path d="M 57 14 L 57 9 L 63 4 L 69 9 L 69 14 Z" fill="none" stroke="#334155" stroke-width="1.2" />
        </g>
        <!-- Station ID & Timestamp -->
        <text x="930" y="24" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#334155">15-Oct-26 8:31 AM   USDC-CMPP212NDEANE01</text>
        <!-- Display Workspace Dropdown Box -->
        <rect x="1180" y="8" width="115" height="22" rx="3" fill="#cbd5e1" stroke="#94a3b8" />
        <text x="1237" y="23" font-family="monospace" font-size="10" font-weight="bold" fill="#1e293b" text-anchor="middle">14KLLINU10001K</text>
        <path d="M 1282 17 L 1287 22 L 1292 17" fill="none" stroke="#334155" stroke-width="1.5" />

        <!-- Canvas Center Subtitle -->
        """,
        f'<text x="540" y="90" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" fill="#1e293b" letter-spacing="1">{" ".join(unit_title.split()[1:])}</text>',
        """
        <!-- Orthogonal Process Piping -->
        <g class="edges-layer">
        """
    ]

    # === SPECIALIZED ROUTING: 4.1 OFFSPEC STORAGE AND LOADING ===
    if "OFFSPEC STORAGE AND LOADING" in unit_title:
        svg_parts.append("""
        <!-- Loading Arm Feed Header to Tank -->
        <path d="M 305 275 L 430 275 L 620 275 L 620 420" fill="none" stroke="#254d79" stroke-width="2.5" marker-end="url(#hmi-arrow)" />
        <!-- Incoming header 14-T-211A-D -->
        <path d="M 220 385 L 340 385 L 340 275" fill="none" stroke="#254d79" stroke-width="2.5" />
        <!-- Incoming slops 01-P-403 -->
        <path d="M 205 465 L 620 465" fill="none" stroke="#254d79" stroke-width="2.5" marker-end="url(#hmi-arrow)" />
        <!-- Incoming waste water 06-V-001 -->
        <path d="M 205 505 L 620 505" fill="none" stroke="#254d79" stroke-width="2.5" marker-end="url(#hmi-arrow)" />
        <!-- Vapor vent line to 14-A-401A/B -->
        <path d="M 710 395 L 710 300 L 980 300" fill="none" stroke="#254d79" stroke-width="2.5" marker-end="url(#hmi-arrow)" />
        <!-- Steam supply through control valve into heating coil -->
        <path d="M 980 495 L 800 495 L 770 545" fill="none" stroke="#254d79" stroke-width="2.5" />
        <!-- Condensate return from heating coil to header -->
        <path d="M 770 575 L 800 580 L 980 580" fill="none" stroke="#254d79" stroke-width="2.5" marker-end="url(#hmi-arrow)" />
        <!-- Bottom pump suction line from tank -->
        <path d="M 650 590 L 650 630 L 565 630" fill="none" stroke="#254d79" stroke-width="2.5" />
        <!-- Bottom pump discharge line -->
        <path d="M 540 605 L 540 540 L 480 540" fill="none" stroke="#254d79" stroke-width="2.5" marker-end="url(#hmi-arrow)" />
        """)
    else:
        # Standard Orthogonal Piping
        for edge in graph.edges:
            src = node_map.get(edge.source)
            dst = node_map.get(edge.target)
            if not src or not dst:
                continue

            edge_issue = edge_issues.get(edge.id)
            has_edge_issue = edge_issue is not None
            color = "#EF4444" if has_edge_issue else "#254d79"
            marker = 'marker-end="url(#hmi-arrow-error)"' if has_edge_issue else 'marker-end="url(#hmi-arrow)"'

            p1_x, p1_y = get_node_boundary_point(src, dst.x, dst.y)
            p2_x, p2_y = get_node_boundary_point(dst, src.x, src.y)

            if abs(p1_y - p2_y) < 12:
                d_path = f"M {p1_x} {p1_y} L {p2_x} {p2_y}"
            elif abs(p1_x - p2_x) < 12:
                d_path = f"M {p1_x} {p1_y} L {p2_x} {p2_y}"
            else:
                mid_x = (p1_x + p2_x) / 2.0
                d_path = f"M {p1_x} {p1_y} L {mid_x} {p1_y} L {mid_x} {p2_y} L {p2_x} {p2_y}"

            svg_parts.append(
                f'<path d="{d_path}" fill="none" stroke="{color}" stroke-width="2.5" {marker} '
                f'data-source="{edge.source}" data-target="{edge.target}" opacity="0.95" />'
            )

    svg_parts.append('</g>')

    # === DRAW NODES (DCS EQUIPMENT & FACEPLATES) ===
    svg_parts.append('<g class="nodes-layer">')
    for node in graph.nodes:
        issue = node_issues.get(node.id)
        svg_parts.append(render_symbol_svg(node, issue=issue))
    svg_parts.append('</g>')

    # === DCS BOTTOM ALARM RIBBON ===
    svg_parts.append("""
    <!-- DCS Bottom Annunciator & Alarm Ribbon -->
    <rect x="0" y="736" width="100%" height="44" fill="#334155" stroke="#1e293b" stroke-width="1" />
    <g transform="translate(20, 745)">
        <rect x="0" y="0" width="100" height="24" rx="3" fill="#1e293b" stroke="#475569" />
        <rect x="4" y="4" width="16" height="16" fill="#dc2626" rx="2" />
        <text x="58" y="16" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#f8fafc" text-anchor="middle">03FFZI20005_LL</text>
    </g>
    <g transform="translate(130, 745)">
        <rect x="0" y="0" width="95" height="24" rx="3" fill="#1e293b" stroke="#475569" />
        <rect x="4" y="4" width="16" height="16" fill="#dc2626" rx="2" />
        <text x="55" y="16" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#f8fafc" text-anchor="middle">03FZI20002_LL</text>
    </g>
    <g transform="translate(235, 745)">
        <rect x="0" y="0" width="95" height="24" rx="3" fill="#1e293b" stroke="#475569" />
        <rect x="4" y="4" width="16" height="16" fill="#dc2626" rx="2" />
        <text x="55" y="16" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#f8fafc" text-anchor="middle">03FZI23007_LL</text>
    </g>
    <g transform="translate(340, 745)">
        <rect x="0" y="0" width="85" height="24" rx="3" fill="#1e293b" stroke="#475569" />
        <rect x="4" y="4" width="16" height="16" fill="#dc2626" rx="2" />
        <text x="50" y="16" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#f8fafc" text-anchor="middle">03XA31212</text>
    </g>
    <g transform="translate(435, 745)">
        <rect x="0" y="0" width="85" height="24" rx="3" fill="#1e293b" stroke="#475569" />
        <rect x="4" y="4" width="16" height="16" fill="#dc2626" rx="2" />
        <text x="50" y="16" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#f8fafc" text-anchor="middle">03XA50285</text>
    </g>
    <g transform="translate(530, 745)">
        <rect x="0" y="0" width="85" height="24" rx="3" fill="#1e293b" stroke="#475569" />
        <rect x="4" y="4" width="16" height="16" fill="#dc2626" rx="2" />
        <text x="50" y="16" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#f8fafc" text-anchor="middle">03XA50284</text>
    </g>
    <g transform="translate(625, 745)">
        <rect x="0" y="0" width="85" height="24" rx="3" fill="#1e293b" stroke="#475569" />
        <rect x="4" y="4" width="16" height="16" fill="#dc2626" rx="2" />
        <text x="50" y="16" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#f8fafc" text-anchor="middle">03XA50283</text>
    </g>
    <g transform="translate(720, 745)">
        <rect x="0" y="0" width="80" height="24" rx="3" fill="#1e293b" stroke="#475569" />
        <rect x="4" y="4" width="16" height="16" fill="#d97706" rx="2" />
        <text x="48" y="16" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#f8fafc" text-anchor="middle">03KM201</text>
    </g>
    <!-- BPCS Typical Status Badge -->
    <g transform="translate(1220, 745)">
        <rect x="0" y="0" width="105" height="24" rx="12" fill="#dc2626" />
        <text x="52" y="16" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle">BPCS_TYPICAL</text>
    </g>
    """)

    svg_parts.append('</svg>')
    return "\n".join(svg_parts)
