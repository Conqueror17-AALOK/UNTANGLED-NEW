import math
import re
from typing import Dict, List, Tuple
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
        # e.g., ['14', 'FIC', '15701'] -> ('14-FIC', '15701')
        prefix = f"{parts[0]}-{parts[1]}"
        loop = "-".join(parts[2:])
        return prefix, loop
    elif len(parts) == 2:
        return parts[0], parts[1]
    
    # Non-hyphenated string: attempt regex split
    m = re.match(r'^(\d*[A-Za-z]+)(\d+.*)$', tag)
    if m:
        return m.group(1), m.group(2)

    # Fallback: split in half
    mid = len(tag) // 2
    return tag[:mid], tag[mid:]


def get_node_boundary_point(node: GraphNode, target_x: float, target_y: float) -> Tuple[float, float]:
    """
    Compute orthogonal or direct connection port on the outer perimeter of a node symbol.
    Prevents lines and arrows from being drawn inside the symbol text and circle.
    """
    x, y = float(node.x), float(node.y)
    dx = target_x - x
    dy = target_y - y

    cat = node.category.lower()
    ntype = node.type.lower()
    tag = node.id.upper()

    # Determine rough boundary shape & radius/dimensions
    if "tank" in ntype or "TK-" in tag:
        hw, hh = 45.0, 65.0
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
        # Standard ISA bubble
        hw, hh = 26.0, 26.0

    if abs(dx) >= abs(dy):
        # Attach to left or right port
        port_x = x + (hw if dx > 0 else -hw)
        port_y = y
    else:
        # Attach to top or bottom port
        port_x = x
        port_y = y + (hh if dy > 0 else -hh)

    return port_x, port_y


def _render_symbol_base(node: GraphNode) -> str:
    x, y = float(node.x), float(node.y)
    tag = node.id
    cat = node.category.lower()
    ntype = node.type.lower()
    conf_pct = int(node.confidence * 100)

    # Confidence indicator color
    badge_color = "#10B981" if node.confidence >= 0.85 else ("#F59E0B" if node.confidence >= 0.60 else "#EF4444")
    line1, line2 = parse_tag_display(tag)

    # 1. Vertical Pressure Vessel / Distillation Column / Separator Drum
    if any(k in ntype or k in tag.upper() for k in ["vessel", "column", "separator", "drum", "V-", "C-", "D-"]):
        w, h = 80, 140
        rx, ry = x - w/2, y - h/2
        return f"""
        <g class="pid-node equipment-vessel" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <!-- Vessel Body with Elliptical Dished Heads -->
            <path d="M {rx} {ry+22} 
                     C {rx} {ry-10}, {rx+w} {ry-10}, {rx+w} {ry+22} 
                     L {rx+w} {ry+h-22} 
                     C {rx+w} {ry+h+10}, {rx} {ry+h+10}, {rx} {ry+h-22} Z" 
                  fill="#111827" stroke="#38BDF8" stroke-width="2.5" />
            <!-- Internal Demister / Tray Indication -->
            <line x1="{rx+8}" y1="{y-15}" x2="{rx+w-8}" y2="{y-15}" stroke="#475569" stroke-dasharray="3,3" stroke-width="1.5" />
            <line x1="{rx+8}" y1="{y+15}" x2="{rx+w-8}" y2="{y+15}" stroke="#475569" stroke-dasharray="3,3" stroke-width="1.5" />
            <!-- Top Vapor Nozzle Stub -->
            <line x1="{x}" y1="{ry-6}" x2="{x}" y2="{ry-16}" stroke="#38BDF8" stroke-width="2" />
            <line x1="{x-6}" y1="{ry-16}" x2="{x+6}" y2="{ry-16}" stroke="#38BDF8" stroke-width="2" />
            <!-- Skirt / Support Legs -->
            <line x1="{rx+10}" y1="{ry+h-10}" x2="{rx+5}" y2="{ry+h+14}" stroke="#64748B" stroke-width="2.5" />
            <line x1="{rx+w-10}" y1="{ry+h-10}" x2="{rx+w-5}" y2="{ry+h+14}" stroke="#64748B" stroke-width="2.5" />
            <!-- Tag & Functional Type -->
            <text x="{x}" y="{y-2}" font-family="Inter, sans-serif" font-weight="700" font-size="12" fill="#F8FAFC" text-anchor="middle">{tag}</text>
            <text x="{x}" y="{y+14}" font-family="Inter, sans-serif" font-size="9" font-weight="600" fill="#94A3B8" text-anchor="middle">VESSEL</text>
            <!-- Confidence Badge -->
            <rect x="{x-22}" y="{ry+h+16}" width="44" height="15" rx="3.5" fill="{badge_color}" />
            <text x="{x}" y="{ry+h+27}" font-family="Inter, sans-serif" font-size="8.5" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 2. Storage Tank (Conical / Flat Bottom Tank)
    elif "tank" in ntype or "TK-" in tag.upper():
        w, h = 90, 120
        rx, ry = x - w/2, y - h/2
        return f"""
        <g class="pid-node equipment-tank" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <!-- Tank Shell (Dome roof + flat bottom) -->
            <path d="M {rx} {ry+16} 
                     C {rx+15} {ry-6}, {rx+w-15} {ry-6}, {rx+w} {ry+16} 
                     L {rx+w} {ry+h} 
                     L {rx} {ry+h} Z" 
                  fill="#111827" stroke="#38BDF8" stroke-width="2.5" />
            <!-- Liquid Level Indicator Line -->
            <line x1="{rx+10}" y1="{y-10}" x2="{rx+w-10}" y2="{y-10}" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.6" />
            <!-- Tag & Label -->
            <text x="{x}" y="{y+6}" font-family="Inter, sans-serif" font-weight="700" font-size="12" fill="#F8FAFC" text-anchor="middle">{tag}</text>
            <text x="{x}" y="{y+20}" font-family="Inter, sans-serif" font-size="9" fill="#94A3B8" text-anchor="middle">STORAGE TANK</text>
            <!-- Confidence Badge -->
            <rect x="{x-22}" y="{ry+h+6}" width="44" height="15" rx="3.5" fill="{badge_color}" />
            <text x="{x}" y="{ry+h+17}" font-family="Inter, sans-serif" font-size="8.5" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 3. Centrifugal Pump
    elif "pump" in ntype or "P-" in tag.upper():
        r = 28
        return f"""
        <g class="pid-node equipment-pump" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <!-- Circular Volute Casing -->
            <circle cx="{x}" cy="{y}" r="{r}" fill="#111827" stroke="#38BDF8" stroke-width="2.5" />
            <!-- Tangential Top Discharge Nozzle with Flange -->
            <polygon points="{x-7},{y-r} {x+7},{y-r} {x+4},{y-r-16} {x-4},{y-r-16}" fill="#38BDF8" />
            <line x1="{x-8}" y1="{y-r-16}" x2="{x+8}" y2="{y-r-16}" stroke="#38BDF8" stroke-width="2" />
            <!-- Suction Center Circle / Impeller Hub -->
            <circle cx="{x}" cy="{y}" r="6" fill="#1E293B" stroke="#64748B" stroke-width="1.5" />
            <!-- Motor Driver Shaft -->
            <line x1="{x+r}" y1="{y}" x2="{x+r+14}" y2="{y}" stroke="#64748B" stroke-width="3" />
            <rect x="{x+r+14}" y="{y-12}" width="16" height="24" rx="2" fill="#1E293B" stroke="#64748B" stroke-width="1.5" />
            <!-- Tag & Label -->
            <text x="{x}" y="{y-10}" font-family="Inter, sans-serif" font-weight="700" font-size="11" fill="#F8FAFC" text-anchor="middle">{tag}</text>
            <text x="{x}" y="{y+16}" font-family="Inter, sans-serif" font-size="8.5" font-weight="600" fill="#94A3B8" text-anchor="middle">PUMP</text>
            <!-- Badge -->
            <rect x="{x-18}" y="{y+r+5}" width="36" height="14" rx="3" fill="{badge_color}" />
            <text x="{x}" y="{y+r+15}" font-family="Inter, sans-serif" font-size="8" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 4. Shell & Tube Heat Exchanger / Cooler / Reboiler
    elif any(k in ntype or k in tag.upper() for k in ["exchanger", "reboiler", "cooler", "heater", "E-"]):
        w, h = 90, 52
        rx, ry = x - w/2, y - h/2
        return f"""
        <g class="pid-node equipment-hex" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <!-- Shell Body with Rounded Channel Heads -->
            <rect x="{rx}" y="{ry}" width="{w}" height="{h}" rx="26" fill="#111827" stroke="#38BDF8" stroke-width="2.5" />
            <!-- Internal Tube Pass Baffle Lines -->
            <line x1="{rx+16}" y1="{y-6}" x2="{rx+w-16}" y2="{y-6}" stroke="#64748B" stroke-width="1.5" stroke-dasharray="3,3" />
            <line x1="{rx+16}" y1="{y+6}" x2="{rx+w-16}" y2="{y+6}" stroke="#64748B" stroke-width="1.5" stroke-dasharray="3,3" />
            <!-- Tag & Label -->
            <text x="{x}" y="{y-6}" font-family="Inter, sans-serif" font-weight="700" font-size="11" fill="#F8FAFC" text-anchor="middle">{tag}</text>
            <text x="{x}" y="{y+10}" font-family="Inter, sans-serif" font-size="8.5" font-weight="600" fill="#94A3B8" text-anchor="middle">EXCHANGER</text>
            <!-- Badge -->
            <rect x="{x-18}" y="{ry+h+4}" width="36" height="14" rx="3" fill="{badge_color}" />
            <text x="{x}" y="{ry+h+14}" font-family="Inter, sans-serif" font-size="8" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 5. Valves (Control Valve, Safety Valve PSV, Hand Valve, Check Valve)
    elif "valve" in cat or "valve" in ntype or any(tag.upper().startswith(p) for p in ["CV-", "XV-", "PSV-", "HV-", "FV-", "LV-", "PV-", "TV-", "NRV-"]):
        is_control = any(k in tag.upper() or k in ntype for k in ["CV", "CONTROL", "FV", "LV", "PV", "TV", "XV"])
        is_psv = any(k in tag.upper() or k in ntype for k in ["PSV", "PRV", "RELIEF", "SAFETY"])
        is_manual = any(k in tag.upper() or k in ntype for k in ["HV", "MANUAL", "HAND", "GATE", "GLOBE", "BALL"])

        if is_psv:
            # 90-degree angular Safety Relief Valve
            return f"""
            <g class="pid-node valve-psv" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
                <!-- Inlet Triangle (Vertical) & Discharge Triangle (Horizontal) -->
                <polygon points="{x-8},{y+16} {x+8},{y+16} {x},{y}" fill="#111827" stroke="#EF4444" stroke-width="2" />
                <polygon points="{x},{y} {x+16},{y-8} {x+16},{y+8}" fill="#111827" stroke="#EF4444" stroke-width="2" />
                <!-- Spring Housing on Top -->
                <rect x="{x-6}" y="{y-20}" width="12" height="20" fill="#1E293B" stroke="#EF4444" stroke-width="1.8" />
                <line x1="{x}" y1="{y-20}" x2="{x}" y2="{y-25}" stroke="#EF4444" stroke-width="2" />
                <!-- Tag -->
                <text x="{x}" y="{y+30}" font-family="Inter, sans-serif" font-weight="700" font-size="10.5" fill="#F8FAFC" text-anchor="middle">{tag}</text>
                <rect x="{x-18}" y="{y+36}" width="36" height="13" rx="3" fill="{badge_color}" />
                <text x="{x}" y="{y+45}" font-family="Inter, sans-serif" font-size="8" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
            </g>
            """
        else:
            # Opposing Triangles (Bowtie)
            actuator_svg = ""
            if is_control:
                # Diaphragm Actuator Dome + Positioner Box
                actuator_svg = f"""
                <line x1="{x}" y1="{y}" x2="{x}" y2="{y-16}" stroke="#F59E0B" stroke-width="2" />
                <path d="M {x-14} {y-16} C {x-14} {y-26}, {x+14} {y-26}, {x+14} {y-16} Z" fill="#1E293B" stroke="#F59E0B" stroke-width="2" />
                <rect x="{x+5}" y="{y-14}" width="8" height="8" fill="#F59E0B" rx="1" />
                """
            elif is_manual:
                # Handwheel T-Bar
                actuator_svg = f"""
                <line x1="{x}" y1="{y}" x2="{x}" y2="{y-14}" stroke="#F59E0B" stroke-width="2" />
                <line x1="{x-11}" y1="{y-14}" x2="{x+11}" y2="{y-14}" stroke="#F59E0B" stroke-width="2.5" />
                """
            else:
                actuator_svg = f"""
                <line x1="{x}" y1="{y}" x2="{x}" y2="{y-12}" stroke="#F59E0B" stroke-width="2" />
                <circle cx="{x}" cy="{y-12}" r="4" fill="#F59E0B" />
                """

            return f"""
            <g class="pid-node valve" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
                <!-- Opposing Bowtie Triangles -->
                <polygon points="{x-22},{y-11} {x},{y} {x-22},{y+11}" fill="#111827" stroke="#F59E0B" stroke-width="2" />
                <polygon points="{x+22},{y-11} {x},{y} {x+22},{y+11}" fill="#111827" stroke="#F59E0B" stroke-width="2" />
                {actuator_svg}
                <!-- Tag -->
                <text x="{x}" y="{y+25}" font-family="Inter, sans-serif" font-weight="700" font-size="10.5" fill="#F8FAFC" text-anchor="middle">{tag}</text>
                <rect x="{x-18}" y="{y+31}" width="36" height="13" rx="3" fill="{badge_color}" />
                <text x="{x}" y="{y+40}" font-family="Inter, sans-serif" font-size="8" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
            </g>
            """

    # 6. Off-Page Connector (OPC Chevron Flag)
    elif "opc" in ntype or "connector" in ntype or "opc" in cat:
        w, h = 110, 30
        return f"""
        <g class="pid-node opc-flag" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            <!-- Chevron flag shape -->
            <polygon points="{x-w/2},{y-h/2} {x+w/2-14},{y-h/2} {x+w/2},{y} {x+w/2-14},{y+h/2} {x-w/2},{y+h/2}" 
                     fill="#0F172A" stroke="#10B981" stroke-width="2" />
            <text x="{x-4}" y="{y+4}" font-family="Inter, sans-serif" font-weight="700" font-size="10" fill="#10B981" text-anchor="middle">{tag}</text>
            <rect x="{x-w/2+4}" y="{y+h/2+3}" width="34" height="13" rx="3" fill="{badge_color}" />
            <text x="{x-w/2+21}" y="{y+h/2+12}" font-family="Inter, sans-serif" font-size="8" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """

    # 7. ISA-5.1 Instrument Bubble
    else:
        r = 24
        is_dcs = any(k in tag.upper() for k in ["IC", "FIC", "LIC", "PIC", "TIC", "AIC", "DCS"])
        is_shared = any(k in tag.upper() for k in ["FIC-", "LIC-", "PIC-"])
        
        # Division line style per ISA-5.1:
        # Solid horizontal line = Main DCS / Board-mounted (accessible to operator)
        # Dashed line = Auxiliary / rear-panel mounted
        dash_style = '' if is_dcs else 'stroke-dasharray="3,3"'

        # If shared display / DCS controller: draw square bounding box around circle
        outer_box = ""
        if is_shared:
            outer_box = f'<rect x="{x-r-4}" y="{y-r-4}" width="{(r+4)*2}" height="{(r+4)*2}" rx="5" fill="none" stroke="#64748B" stroke-width="1.2" stroke-dasharray="3,2" />'

        return f"""
        <g class="pid-node instrument-bubble" data-id="{tag}" data-category="{cat}" data-confidence="{conf_pct}" style="cursor: pointer;">
            {outer_box}
            <circle cx="{x}" cy="{y}" r="{r}" fill="#0F172A" stroke="#E2E8F0" stroke-width="2" />
            <!-- Internal Division Line -->
            <line x1="{x-r+2}" y1="{y}" x2="{x+r-2}" y2="{y}" stroke="#94A3B8" stroke-width="1.5" {dash_style} />
            <!-- Functional Prefix (Line 1) -->
            <text x="{x}" y="{y-6}" font-family="Inter, sans-serif" font-weight="700" font-size="10.5" fill="#38BDF8" text-anchor="middle">{line1}</text>
            <!-- Loop Number (Line 2) -->
            <text x="{x}" y="{y+13}" font-family="Inter, sans-serif" font-weight="600" font-size="10" fill="#F8FAFC" text-anchor="middle">{line2}</text>
            <!-- Confidence Badge -->
            <rect x="{x-16}" y="{y+r+4}" width="32" height="13" rx="3" fill="{badge_color}" />
            <text x="{x}" y="{y+r+13}" font-family="Inter, sans-serif" font-size="8" font-weight="700" fill="#FFFFFF" text-anchor="middle">{conf_pct}%</text>
        </g>
        """


def render_symbol_svg(node: GraphNode, issue: Optional[Dict[str, Any]] = None) -> str:
    """
    Render standard ISA-5.1 symbol and decorate with priority alert callouts
    (P1 Critical Red, P2 Operational Amber, P3/Low Accuracy Purple) if an issue exists.
    """
    raw_svg = _render_symbol_base(node)
    
    # Check if this node has an active diagnostic issue or low accuracy
    has_issue = issue is not None and issue.get("priority") in ("P1", "P2", "P3")
    is_low_conf = node.confidence < 0.70

    if not has_issue and not is_low_conf:
        return raw_svg

    x, y = float(node.x), float(node.y)
    conf_pct = int(node.confidence * 100)
    pri = issue.get("priority", "P3") if issue else "P3"
    rule = issue.get("rule", "LOW_ACCURACY") if issue else "LOW_ACCURACY"

    if pri == "P1":
        alert_markup = f"""
        <!-- P1 Critical Safety Hazard Callout -->
        <circle cx="{x}" cy="{y}" r="42" fill="none" stroke="#EF4444" stroke-width="3" stroke-dasharray="6,3" />
        <g class="hazard-callout" transform="translate({x-70}, {y-52})">
            <rect width="140" height="18" rx="3.5" fill="#EF4444" stroke="#FFFFFF" stroke-width="0.8" />
            <text x="70" y="12.5" font-family="Inter, sans-serif" font-size="8" font-weight="800" fill="#FFFFFF" text-anchor="middle">P1: CRITICAL ({rule[:14]})</text>
        </g>
        """
    elif pri == "P2":
        alert_markup = f"""
        <!-- P2 Operational Warning Callout -->
        <circle cx="{x}" cy="{y}" r="40" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-dasharray="5,2" />
        <g class="hazard-callout" transform="translate({x-70}, {y-50})">
            <rect width="140" height="17" rx="3.5" fill="#F59E0B" stroke="#000000" stroke-width="0.6" />
            <text x="70" y="12" font-family="Inter, sans-serif" font-size="7.8" font-weight="700" fill="#000000" text-anchor="middle">P2: WARNING ({rule[:14]})</text>
        </g>
        """
    else:
        alert_markup = f"""
        <!-- Low Accuracy / Model Confidence Callout -->
        <circle cx="{x}" cy="{y}" r="38" fill="none" stroke="#A855F7" stroke-width="2" stroke-dasharray="4,2" />
        <g class="hazard-callout" transform="translate({x-70}, {y-48})">
            <rect width="140" height="16" rx="3" fill="#8B5CF6" stroke="#FFFFFF" stroke-width="0.6" />
            <text x="70" y="11.5" font-family="Inter, sans-serif" font-size="7.5" font-weight="700" fill="#FFFFFF" text-anchor="middle">LOW ACCURACY ({conf_pct}%)</text>
        </g>
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
    Render clean, interactive, responsive SVG process sketch from simplified GraphSchema.
    Features:
      - Authentic ISA-5.1 instrument bubbles, control valves, vessels, and pumps.
      - Full loop numbers preserved (e.g. 14-FIC-15701 Line 1: '14-FIC', Line 2: '15701').
      - Manhattan orthogonal pipe routing with port boundary snapping.
      - Priority-wise connection error highlights (P1 Red, P2 Amber, Low Accuracy Purple).
      - Crisp flow direction arrows.
      - Engineering title block and symbol legend.
    """
    node_map = {n.id: n for n in graph.nodes}

    # Index diagnostics by element_id
    node_issues: Dict[str, Dict[str, Any]] = {}
    edge_issues: Dict[str, Dict[str, Any]] = {}
    if diagnostics:
        priority_rank = {"P1": 0, "P2": 1, "P3": 2, "P4": 3}
        for d in diagnostics:
            el_type = d.get("element_type")
            el_id = d.get("element_id")
            pri = d.get("priority", "P4")
            if el_type == "node" and el_id:
                cur = node_issues.get(el_id)
                if not cur or priority_rank.get(pri, 4) < priority_rank.get(cur.get("priority", "P4"), 4):
                    node_issues[el_id] = d
            elif el_type == "edge" and el_id:
                cur = edge_issues.get(el_id)
                if not cur or priority_rank.get(pri, 4) < priority_rank.get(cur.get("priority", "P4"), 4):
                    edge_issues[el_id] = d

    # Calculate bounding envelope with generous margins
    max_x = max((n.x for n in graph.nodes), default=1200) + 200
    max_y = max((n.y for n in graph.nodes), default=600) + 220
    width = max(1500, int(max_x))
    height = max(800, int(max_y))

    svg_parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%" style="background-color: #080C14;">',
        """
        <defs>
            <!-- Arrow markers -->
            <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#38BDF8" />
            </marker>
            <marker id="arrow-signal" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 2 L 8 5 L 0 8 z" fill="#C084FC" />
            </marker>
            <marker id="arrow-opc" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#10B981" />
            </marker>
            <marker id="arrow-error" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#EF4444" />
            </marker>
            <!-- Engineering Grid Background -->
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#161F30" stroke-width="0.8" />
            </pattern>
        </defs>
        <!-- Background Grid -->
        <rect width="100%" height="100%" fill="url(#grid)" />
        <!-- CAD Outer Border -->
        <rect x="15" y="15" width="{w_inner}" height="{h_inner}" fill="none" stroke="#1E293B" stroke-width="1.5" />
        """.format(w_inner=width - 30, h_inner=height - 30)
    ]

    # Draw Edges (Pipes & Signal Lines) with Port Snapping & Manhattan Routing
    svg_parts.append('<g class="edges-layer">')
    for edge in graph.edges:
        src = node_map.get(edge.source)
        dst = node_map.get(edge.target)
        if not src or not dst:
            continue

        edge_issue = edge_issues.get(edge.id)
        has_edge_issue = edge_issue is not None and edge_issue.get("priority") in ("P1", "P2")

        is_process = edge.line_type == "process"
        is_cross_sheet = "opc_bridge" in (edge.id or "")
        
        # Color & Stroke attributes
        if has_edge_issue:
            color = "#EF4444"
            width_stroke = 3.5
            dash = 'stroke-dasharray="6,3"'
            marker = 'marker-end="url(#arrow-error)"'
        elif is_cross_sheet:
            color = "#10B981"
            width_stroke = 3.0
            dash = 'stroke-dasharray="8,4"'
            marker = 'marker-end="url(#arrow-opc)"'
        elif is_process:
            color = "#38BDF8"
            width_stroke = 2.5
            dash = ""
            marker = 'marker-end="url(#arrow)"' if edge.directed else ""
        else:
            color = "#C084FC"
            width_stroke = 1.5
            dash = 'stroke-dasharray="5,4"'
            marker = 'marker-end="url(#arrow-signal)"' if edge.directed else ""

        # Compute port snapping on node boundaries
        p1_x, p1_y = get_node_boundary_point(src, dst.x, dst.y)
        p2_x, p2_y = get_node_boundary_point(dst, src.x, src.y)

        # Manhattan Orthogonal Routing
        if abs(p1_y - p2_y) < 12:
            # Direct horizontal
            d_path = f"M {p1_x} {p1_y} L {p2_x} {p2_y}"
        elif abs(p1_x - p2_x) < 12:
            # Direct vertical
            d_path = f"M {p1_x} {p1_y} L {p2_x} {p2_y}"
        else:
            # Orthogonal step: horizontal to mid, then vertical, then horizontal to target
            mid_x = (p1_x + p2_x) / 2.0
            d_path = f"M {p1_x} {p1_y} L {mid_x} {p1_y} L {mid_x} {p2_y} L {p2_x} {p2_y}"

        svg_parts.append(
            f'<path d="{d_path}" fill="none" stroke="{color}" stroke-width="{width_stroke}" {dash} {marker} '
            f'data-source="{edge.source}" data-target="{edge.target}" data-line-type="{edge.line_type}" opacity="0.9" />'
        )

        if has_edge_issue:
            mid_x = (p1_x + p2_x) / 2.0
            mid_y = (p1_y + p2_y) / 2.0
            svg_parts.append(f"""
            <!-- Edge Alert Hazard Icon -->
            <g class="edge-alert" transform="translate({mid_x-10}, {mid_y-10})">
                <rect width="20" height="20" rx="3" fill="#EF4444" stroke="#FFFFFF" stroke-width="1.2" />
                <text x="10" y="14" font-family="Inter, sans-serif" font-size="11" font-weight="900" fill="#FFFFFF" text-anchor="middle">!</text>
            </g>
            """)
    svg_parts.append('</g>')

    # Draw Nodes (ISA-5.1 Symbols with Priority Diagnostics)
    svg_parts.append('<g class="nodes-layer">')
    for node in graph.nodes:
        issue = node_issues.get(node.id)
        svg_parts.append(render_symbol_svg(node, issue=issue))
    svg_parts.append('</g>')

    # Engineering Title Block (Bottom Right)
    is_merged = any("opc_bridge" in (e.id or "") for e in graph.edges) or width > 3000
    title_text = "MULTI-SHEET INTEGRATED PLANT TOPOLOGY" if is_merged else "SMART VECTOR PROCESS &amp; INSTRUMENTATION SCHEMATIC"
    sub_title = "UNTANGLED Multi-Sheet Spatial Stitching" if is_merged else "UNTANGLED AI-Verified Engineering Flow Diagram"

    tb_w, tb_h = 420, 95
    tb_x = width - tb_w - 25
    tb_y = height - tb_h - 25

    svg_parts.append(f"""
    <!-- Official Title Block -->
    <g class="title-block" transform="translate({tb_x}, {tb_y})">
        <rect width="{tb_w}" height="{tb_h}" fill="#0B132B" stroke="#38BDF8" stroke-width="1.8" rx="4" />
        <line x1="0" y1="36" x2="{tb_w}" y2="36" stroke="#1E293B" stroke-width="1.2" />
        <line x1="280" y1="36" x2="280" y2="{tb_h}" stroke="#1E293B" stroke-width="1.2" />
        <!-- Title & Subtitle -->
        <text x="14" y="24" font-family="Inter, sans-serif" font-size="12" font-weight="700" fill="#38BDF8">{title_text}</text>
        <text x="14" y="55" font-family="Inter, sans-serif" font-size="9" fill="#94A3B8">{sub_title}</text>
        <text x="14" y="74" font-family="Inter, sans-serif" font-size="9" font-weight="600" fill="#F8FAFC">STANDARDS: ISA-5.1 / ISO 10628</text>
        <!-- Revision & Stats -->
        <text x="294" y="55" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#10B981">REV: 01 (VERIFIED)</text>
        <text x="294" y="74" font-family="Inter, sans-serif" font-size="8.5" fill="#94A3B8">NODES: {len(graph.nodes)} | EDGES: {len(graph.edges)}</text>
    </g>
    """)

    # Symbol Legend Block (Bottom Left) with Priority Alert Indicators
    leg_w, leg_h = 480, 92
    leg_x = 25
    leg_y = height - leg_h - 25
    svg_parts.append(f"""
    <!-- Legend Block -->
    <g class="legend-block" transform="translate({leg_x}, {leg_y})">
        <rect width="{leg_w}" height="{leg_h}" fill="#0B132B" stroke="#1E293B" stroke-width="1.2" rx="4" opacity="0.95" />
        <text x="12" y="18" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="#F8FAFC">LEGEND &amp; PRIORITY INDICATORS</text>
        <!-- Row 1: Line types -->
        <line x1="12" y1="36" x2="40" y2="36" stroke="#38BDF8" stroke-width="2.5" />
        <text x="46" y="39" font-family="Inter, sans-serif" font-size="8" fill="#94A3B8">Major Process Pipe</text>
        
        <line x1="140" y1="36" x2="168" y2="36" stroke="#C084FC" stroke-width="1.5" stroke-dasharray="4,3" />
        <text x="174" y="39" font-family="Inter, sans-serif" font-size="8" fill="#94A3B8">DCS Signal Line</text>

        <line x1="260" y1="36" x2="288" y2="36" stroke="#10B981" stroke-width="2.5" stroke-dasharray="6,3" />
        <text x="294" y="39" font-family="Inter, sans-serif" font-size="8" fill="#94A3B8">OPC Bridge</text>

        <line x1="370" y1="36" x2="398" y2="36" stroke="#EF4444" stroke-width="2.5" stroke-dasharray="4,2" />
        <text x="404" y="39" font-family="Inter, sans-serif" font-size="8" fill="#EF4444">Routing Error</text>

        <!-- Row 2: Priority Badges -->
        <circle cx="22" cy="62" r="7" fill="none" stroke="#EF4444" stroke-width="2" stroke-dasharray="3,2" />
        <text x="36" y="65" font-family="Inter, sans-serif" font-size="8" font-weight="700" fill="#EF4444">P1: Critical Safety</text>

        <circle cx="150" cy="62" r="7" fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="3,2" />
        <text x="164" y="65" font-family="Inter, sans-serif" font-size="8" font-weight="700" fill="#F59E0B">P2: Operational</text>

        <circle cx="270" cy="62" r="7" fill="none" stroke="#A855F7" stroke-width="2" stroke-dasharray="3,2" />
        <text x="284" y="65" font-family="Inter, sans-serif" font-size="8" font-weight="700" fill="#A855F7">Low Accuracy (&lt;70%)</text>
    </g>
    """)

    svg_parts.append('</svg>')
    return "\n".join(svg_parts)
