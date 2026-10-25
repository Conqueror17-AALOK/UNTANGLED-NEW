"""
P&ID Connection Verification & DCS I/O List Audit Engine.
Provides industrial engineering sanity checks to determine if:
1. Topological connections in P&ID diagrams are Correct or Wrong.
2. DCS I/O list records are Correct or Wrong against physical drawing tags.
3. Errors are categorized by Priority (P1 Critical, P2 High, P3 Medium, P4 Low)
   with direct time-saving recommendations so engineers do not have to hunt for issues.
"""

from typing import Any, Dict, List, Optional, Set, Tuple
from services.api.app.db.schemas import GraphEdge, GraphNode, GraphSchema
from services.api.app.engine.io_parser import IoItem


def _safe_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip().replace(",", "")
    if not val_str or val_str.lower() in ("none", "null", "na", "n/a", "-", "--"):
        return None
    try:
        return float(val_str)
    except (ValueError, TypeError):
        return None


# =============================================================================
# 1. P&ID Connection Verification Engine
# =============================================================================

class ConnectionValidator:
    """
    Validates topological process and signal connections in a P&ID drawing graph.
    Identifies correct connections, dead-ends, floating equipment, signal conflicts,
    and missing control loop links.
    Categorizes all issues by Priority (P1 Critical Safety, P2 Operational Hazard,
    P3 Audit Discrepancy, P4 Verified Safe) with immediate actionable recommendations.
    """

    @staticmethod
    def _get_spatial_meta(
        element_id: str,
        element_type: str,
        nodes_map: Dict[str, GraphNode],
        tags_map: Dict[str, Dict[str, Any]],
        edges_map: Optional[Dict[str, GraphEdge]] = None
    ) -> Tuple[List[float], int, float]:
        """
        Extract bounding box coordinates, drawing page number, and confidence score
        for quick visual crop rendering in reports.
        """
        if element_type == "node":
            tag_info = tags_map.get(element_id)
            if tag_info and tag_info.get("bbox"):
                return tag_info["bbox"], tag_info.get("page", 1), float(tag_info.get("confidence", 0.90))
            node = nodes_map.get(element_id)
            if node:
                return [node.x - 40, node.y - 40, node.x + 40, node.y + 40], 1, float(node.confidence)
        elif element_type == "edge" and edges_map:
            edge = edges_map.get(element_id)
            if edge:
                src = nodes_map.get(edge.source)
                dst = nodes_map.get(edge.target)
                if src and dst:
                    bx1 = min(src.x, dst.x) - 25
                    by1 = min(src.y, dst.y) - 25
                    bx2 = max(src.x, dst.x) + 25
                    by2 = max(src.y, dst.y) + 25
                    conf = min(float(src.confidence), float(dst.confidence))
                    return [bx1, by1, bx2, by2], 1, conf

        return [0.0, 0.0, 0.0, 0.0], 1, 0.90

    @staticmethod
    def validate_connections(
        graph: GraphSchema,
        resolved_tags: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        nodes_map = {n.id: n for n in graph.nodes}
        tags_map = {t["normalized_tag"]: t for t in (resolved_tags or [])}
        for t in (resolved_tags or []):
            tags_map[t["id"]] = t
        edges_map = {e.id: e for e in graph.edges}

        diagnostics: List[Dict[str, Any]] = []
        correct_count = 0
        warning_count = 0
        error_count = 0

        # Adjacency structures
        outgoing_edges: Dict[str, List[GraphEdge]] = {n.id: [] for n in graph.nodes}
        incoming_edges: Dict[str, List[GraphEdge]] = {n.id: [] for n in graph.nodes}

        for e in graph.edges:
            if e.source in outgoing_edges:
                outgoing_edges[e.source].append(e)
            if e.target in incoming_edges:
                incoming_edges[e.target].append(e)

        # ---------------------------------------------------------------------
        # Edge-level Validation: Line Compatibility
        # ---------------------------------------------------------------------
        for e in graph.edges:
            src_node = nodes_map.get(e.source)
            dst_node = nodes_map.get(e.target)
            bbox, page, conf = ConnectionValidator._get_spatial_meta(e.id, "edge", nodes_map, tags_map, edges_map)

            if not src_node or not dst_node:
                diagnostics.append({
                    "element_id": e.id,
                    "element_type": "edge",
                    "status": "WRONG",
                    "severity": "error",
                    "priority": "P1",
                    "priority_label": "P1 - Critical Routing Error",
                    "rule": "ORPHANED_EDGE",
                    "message": f"Connection '{e.id}' references non-existent node ('{e.source}' -> '{e.target}').",
                    "recommendation": "Remove broken connection or snap to recognized component tag.",
                    "time_savings_action": f"IMMEDIATE ACTION: Delete orphaned pipe segment '{e.id}' or connect to recognized nozzle.",
                    "bbox": bbox,
                    "page": page,
                    "confidence": conf
                })
                error_count += 1
                continue

            # Rule: Process fluid pipe directly terminating in electrical instrument bubble
            if e.line_type == "process" and src_node.category == "instrument" and dst_node.category == "instrument":
                diagnostics.append({
                    "element_id": e.id,
                    "element_type": "edge",
                    "status": "WRONG",
                    "severity": "error",
                    "priority": "P1",
                    "priority_label": "P1 - Critical Safety Risk",
                    "rule": "INCOMPATIBLE_LINE_TYPE",
                    "message": f"Process fluid line connected directly between two electrical instruments '{src_node.id}' and '{dst_node.id}'.",
                    "recommendation": "Change line type to instrument signal or pneumatic tubing.",
                    "time_savings_action": f"IMMEDIATE ACTION: Separate process pipeline '{e.id}' from instruments '{src_node.id}' / '{dst_node.id}'. Convert line to signal type.",
                    "bbox": bbox,
                    "page": page,
                    "confidence": conf
                })
                error_count += 1
                continue

            # Valid connection
            is_cross_sheet = "opc_bridge" in (e.id or "")
            conn_desc = f"Inter-sheet process pipeline '{src_node.id}' -> '{dst_node.id}'" if is_cross_sheet else f"Pipeline '{src_node.id}' -> '{dst_node.id}' ({e.line_type})"
            diagnostics.append({
                "element_id": e.id,
                "element_type": "edge",
                "status": "CORRECT",
                "severity": "info",
                "priority": "P4",
                "priority_label": "P4 - Verified Safe",
                "rule": "VALID_CONNECTION",
                "message": f"{conn_desc} is structurally valid.",
                "recommendation": "Connection verified.",
                "time_savings_action": "No action required. Connection structurally verified.",
                "bbox": bbox,
                "page": page,
                "confidence": conf
            })
            correct_count += 1

        # ---------------------------------------------------------------------
        # Node-level Validation: Equipment & Instrument Connectivity
        # ---------------------------------------------------------------------
        for n in graph.nodes:
            in_edges = incoming_edges.get(n.id, [])
            out_edges = outgoing_edges.get(n.id, [])
            all_edges = in_edges + out_edges
            bbox, page, conf = ConnectionValidator._get_spatial_meta(n.id, "node", nodes_map, tags_map)

            # 1. Major Equipment Check (Tank, Exchanger, Column)
            if n.category == "equipment" and "pump" not in n.type.lower():
                process_edges = [e for e in all_edges if e.line_type == "process"]
                if len(process_edges) == 0:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "WRONG",
                        "severity": "error",
                        "priority": "P1",
                        "priority_label": "P1 - Critical Safety Risk",
                        "rule": "FLOATING_EQUIPMENT",
                        "message": f"Major equipment '{n.id}' ({n.type}) has 0 connected process lines.",
                        "recommendation": "Connect inlet and outlet process streams to equipment nozzles.",
                        "time_savings_action": f"IMMEDIATE ACTION: Connect suction inlet and discharge process streams to equipment '{n.id}' nozzles.",
                        "bbox": bbox,
                        "page": page,
                        "confidence": conf
                    })
                    error_count += 1
                else:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "CORRECT",
                        "severity": "info",
                        "priority": "P4",
                        "priority_label": "P4 - Verified Safe",
                        "rule": "EQUIPMENT_CONNECTED",
                        "message": f"Equipment '{n.id}' ({n.type}) is correctly piped into process stream.",
                        "recommendation": "Verified nozzle connection.",
                        "time_savings_action": "No action required. Equipment nozzles properly connected.",
                        "bbox": bbox,
                        "page": page,
                        "confidence": conf
                    })
                    correct_count += 1

            # 2. Pump Flow Consistency (Suction & Discharge)
            elif "pump" in n.type.lower() or "P-" in n.id:
                if len(all_edges) == 0:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "WRONG",
                        "severity": "error",
                        "priority": "P1",
                        "priority_label": "P1 - Critical Operational Hazard",
                        "rule": "DISCONNECTED_PUMP",
                        "message": f"Pump '{n.id}' is disconnected and has no piping connected.",
                        "recommendation": "Connect suction inlet and discharge outlet lines.",
                        "time_savings_action": f"IMMEDIATE ACTION: Connect suction feed line from vessel and discharge header to pump '{n.id}'.",
                        "bbox": bbox,
                        "page": page,
                        "confidence": conf
                    })
                    error_count += 1
                elif len(in_edges) == 0 and len(out_edges) > 0:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "WARNING",
                        "severity": "warning",
                        "priority": "P2",
                        "priority_label": "P2 - Operational Hazard (Cavitation Risk)",
                        "rule": "MISSING_PUMP_SUCTION",
                        "message": f"Pump '{n.id}' has discharge line but suction inlet connection is missing.",
                        "recommendation": "Verify upstream suction line from feed vessel or tank.",
                        "time_savings_action": f"HIGH PRIORITY: Connect upstream suction supply line to pump '{n.id}' to prevent dry running.",
                        "bbox": bbox,
                        "page": page,
                        "confidence": conf
                    })
                    warning_count += 1
                elif len(out_edges) == 0 and len(in_edges) > 0:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "WARNING",
                        "severity": "warning",
                        "priority": "P2",
                        "priority_label": "P2 - Operational Hazard (Deadhead Risk)",
                        "rule": "MISSING_PUMP_DISCHARGE",
                        "message": f"Pump '{n.id}' has suction inlet but discharge line is missing.",
                        "recommendation": "Verify downstream discharge line to process header or exchanger.",
                        "time_savings_action": f"HIGH PRIORITY: Connect downstream discharge line from pump '{n.id}' to destination header.",
                        "bbox": bbox,
                        "page": page,
                        "confidence": conf
                    })
                    warning_count += 1
                else:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "CORRECT",
                        "severity": "info",
                        "priority": "P4",
                        "priority_label": "P4 - Verified Safe",
                        "rule": "PUMP_FLOW_VERIFIED",
                        "message": f"Pump '{n.id}' suction and discharge stream connections are valid.",
                        "recommendation": "Verified.",
                        "time_savings_action": "No action required. Pump suction and discharge continuity verified.",
                        "bbox": bbox,
                        "page": page,
                        "confidence": conf
                    })
                    correct_count += 1

            # 3. Control Valve Control Loop Continuity
            elif (n.category == "valve" or "valve" in n.type.lower()) and ("control" in n.type.lower() or any(p in n.id for p in ["CV-", "FV-", "PV-", "LV-", "TV-"])):
                process_lines = [e for e in all_edges if e.line_type == "process"]
                signal_lines = [e for e in all_edges if e.line_type in ["signal", "electrical", "pneumatic"]]

                if len(process_lines) == 0:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "WRONG",
                        "severity": "error",
                        "priority": "P1",
                        "priority_label": "P1 - Critical Safety Risk",
                        "rule": "FLOATING_VALVE",
                        "message": f"Control valve '{n.id}' is floating and not connected inline into any process piping.",
                        "recommendation": "Snap valve inline with process pipe.",
                        "time_savings_action": f"IMMEDIATE ACTION: Control valve '{n.id}' must be piped inline into process fluid stream.",
                        "bbox": bbox,
                        "page": page,
                        "confidence": conf
                    })
                    error_count += 1
                elif ("CV" in n.id or "control" in n.type.lower()) and len(signal_lines) == 0:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "WARNING",
                        "severity": "warning",
                        "priority": "P2",
                        "priority_label": "P2 - Control Loop Hazard",
                        "rule": "MISSING_CONTROL_SIGNAL",
                        "message": f"Modulating control valve '{n.id}' is inline with process pipe but lacks an actuation signal line from controller or DCS.",
                        "recommendation": "Connect control signal line from loop controller (e.g. FIC, LIC, PIC) to valve actuator.",
                        "time_savings_action": f"HIGH PRIORITY: Connect signal line from loop controller to valve '{n.id}' actuator.",
                        "bbox": bbox,
                        "page": page,
                        "confidence": conf
                    })
                    warning_count += 1
                else:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "CORRECT",
                        "severity": "info",
                        "priority": "P4",
                        "priority_label": "P4 - Verified Safe",
                        "rule": "VALVE_VERIFIED",
                        "message": f"Control valve '{n.id}' is correctly piped and controlled.",
                        "recommendation": "Verified.",
                        "time_savings_action": "No action required. Control valve piping and actuation verified.",
                        "bbox": bbox,
                        "page": page,
                        "confidence": conf
                    })
                    correct_count += 1

            # 4. Sensor Transmitter Output Check
            elif n.category == "instrument":
                if len(all_edges) == 0:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "WARNING",
                        "severity": "warning",
                        "priority": "P3",
                        "priority_label": "P3 - Audit Discrepancy",
                        "rule": "ISOLATED_INSTRUMENT",
                        "message": f"Instrument '{n.id}' ({n.type}) is isolated with no process port or signal connection.",
                        "recommendation": "Connect impulse line to process pipe and signal line to DCS/controller.",
                        "time_savings_action": f"MEDIUM PRIORITY: Connect impulse line from pipeline to instrument '{n.id}'.",
                        "bbox": bbox,
                        "page": page,
                        "confidence": conf
                    })
                    warning_count += 1
                else:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "CORRECT",
                        "severity": "info",
                        "priority": "P4",
                        "priority_label": "P4 - Verified Safe",
                        "rule": "INSTRUMENT_CONNECTED",
                        "message": f"Instrument '{n.id}' connection is structurally verified.",
                        "recommendation": "Verified.",
                        "time_savings_action": "No action required. Instrument loop connected.",
                        "bbox": bbox,
                        "page": page,
                        "confidence": conf
                    })
                    correct_count += 1

            # 5. Off-Page Connector Continuity
            elif "opc" in n.type.lower() or "connector" in n.type.lower() or "opc" in n.category.lower():
                if len(all_edges) == 0:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "WARNING",
                        "severity": "warning",
                        "priority": "P2",
                        "priority_label": "P2 - Multi-Sheet Disconnection",
                        "rule": "UNCONNECTED_OPC",
                        "message": f"Off-page continuation connector '{n.id}' is not connected to any pipeline.",
                        "recommendation": "Connect to boundary process pipe.",
                        "time_savings_action": f"HIGH PRIORITY: Connect off-page connector '{n.id}' to boundary process pipe.",
                        "bbox": bbox,
                        "page": page,
                        "confidence": conf
                    })
                    warning_count += 1
                else:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "CORRECT",
                        "severity": "info",
                        "priority": "P4",
                        "priority_label": "P4 - Verified Safe",
                        "rule": "OPC_STITCHED",
                        "message": f"Off-page connector '{n.id}' is linked to boundary pipeline.",
                        "recommendation": "Verified.",
                        "time_savings_action": "No action required. Inter-sheet continuation stitched.",
                        "bbox": bbox,
                        "page": page,
                        "confidence": conf
                    })
                    correct_count += 1

            # 6. Low AI Confidence Check (< 70% accuracy)
            if n.confidence < 0.70:
                diagnostics.append({
                    "element_id": n.id,
                    "element_type": "node",
                    "status": "WARNING",
                    "severity": "warning",
                    "priority": "P3",
                    "priority_label": "P3 - Low Model Accuracy (<70%)",
                    "rule": "LOW_CONFIDENCE_DETECTION",
                    "message": f"AI detection confidence for '{n.id}' is only {int(n.confidence * 100)}% (requires engineering visual check).",
                    "recommendation": "Inspect source blueprint crop to verify tag and connections.",
                    "time_savings_action": f"VERIFY BLUEPRINT: Check original drawing crop for '{n.id}' at coordinates X:{int(n.x)}, Y:{int(n.y)}.",
                    "bbox": bbox,
                    "page": page,
                    "confidence": conf
                })
                warning_count += 1

        # Priority Sorting: P1 first, then P2, P3, P4
        priority_order = {"P1": 0, "P2": 1, "P3": 2, "P4": 3}
        diagnostics.sort(key=lambda d: priority_order.get(d.get("priority", "P4"), 4))

        p1_critical_count = sum(1 for d in diagnostics if d.get("priority") == "P1")
        p2_high_count = sum(1 for d in diagnostics if d.get("priority") == "P2")
        p3_medium_count = sum(1 for d in diagnostics if d.get("priority") == "P3")
        p4_low_count = sum(1 for d in diagnostics if d.get("priority") == "P4")

        total_checks = correct_count + warning_count + error_count
        health_pct = round((correct_count / total_checks * 100), 1) if total_checks > 0 else 100.0
        overall_status = "PASSED" if error_count == 0 and warning_count == 0 else ("NEEDS_ATTENTION" if error_count == 0 else "FAILED")

        return {
            "status": overall_status,
            "health_score_pct": health_pct,
            "total_checks": total_checks,
            "correct_count": correct_count,
            "warning_count": warning_count,
            "error_count": error_count,
            "p1_critical_count": p1_critical_count,
            "p2_high_count": p2_high_count,
            "p3_medium_count": p3_medium_count,
            "p4_low_count": p4_low_count,
            "priority_summary": f"{p1_critical_count} Critical Safety Hazards, {p2_high_count} Operational Hazards" if (p1_critical_count > 0 or p2_high_count > 0) else "All Topological Connections Verified",
            "diagnostics": diagnostics
        }


# =============================================================================
# 2. DCS I/O List Comprehensive Verification Engine
# =============================================================================

class IoListValidator:
    """
    Validates DCS I/O list against physical P&ID drawing components.
    Categorizes every tag into:
    - CORRECT: Drawing and I/O match in identity, signal type, and engineering units.
    - WRONG / DISCREPANCY:
      * MISSING_IN_DRAWING: In I/O list, but missing from blueprint.
      * MISSING_IN_IO_LIST: Physical transmitter/valve on blueprint, but missing from I/O register.
      * SIGNAL_TYPE_MISMATCH: e.g. Analog transmitter configured as Digital Input.
      * INVALID_RANGE: Inverted calibration bounds or missing required engineering units.
    """

    @staticmethod
    def verify_io_and_drawing(
        resolved_tags: List[Dict[str, Any]],
        io_items: List[IoItem]
    ) -> Dict[str, Any]:
        drawing_map: Dict[str, Dict[str, Any]] = {}
        for t in resolved_tags:
            norm = t["normalized_tag"].upper().replace(" ", "-")
            drawing_map[norm] = t
            drawing_map[norm.replace("-", "")] = t

        io_map: Dict[str, IoItem] = {}
        for item in io_items:
            norm = item.tag.upper().replace(" ", "-")
            io_map[norm] = item
            io_map[norm.replace("-", "")] = item

        items_audit: List[Dict[str, Any]] = []
        correct_count = 0
        discrepancy_count = 0

        # Process all I/O items against drawing
        for item in io_items:
            norm = item.tag.upper().replace(" ", "-")
            draw_tag = drawing_map.get(norm) or drawing_map.get(norm.replace("-", ""))

            if not draw_tag:
                items_audit.append({
                    "tag": item.tag,
                    "status": "WRONG",
                    "priority": "P2",
                    "priority_label": "P2 - Missing in Blueprint",
                    "discrepancy_type": "MISSING_IN_DRAWING",
                    "drawing_found": False,
                    "io_found": True,
                    "drawing_type": None,
                    "io_signal_type": item.signal_type,
                    "expected_signal_type": item.signal_type,
                    "units": item.units,
                    "range_span": f"{item.range_low} - {item.range_high}" if (item.range_low is not None and item.range_high is not None) else None,
                    "message": f"DCS registered point '{item.tag}' ({item.signal_type}) not identified on drawing.",
                    "recommendation": "Confirm whether tag is physically present or obsolete."
                })
                discrepancy_count += 1
                continue

            # Verify Signal Type Compatibility
            draw_type = draw_tag.get("type", "").lower()
            io_sig = (item.signal_type or "").upper()
            sig_mismatch = False

            # Analog transmitters (PT, LT, FT, TT) must NOT be registered as Digital Input (DI)
            if any(k in draw_type for k in ["transmitter", "analog", "indicating", "flow", "pressure", "temperature", "level"]):
                if "DI" in io_sig and "AI" not in io_sig:
                    sig_mismatch = True
                    expected_sig = "AI"

            # Digital Switches (PSH, LSL, TSH) must NOT be registered as Analog
            elif any(k in draw_type for k in ["switch", "alarm", "contact"]):
                if "AI" in io_sig and "DI" not in io_sig:
                    sig_mismatch = True
                    expected_sig = "DI"

            # Modulating valves (CV) must NOT be registered as binary Digital Output only
            elif "control valve" in draw_type:
                if "DO" in io_sig and "AO" not in io_sig and "4-20" not in io_sig:
                    sig_mismatch = True
                    expected_sig = "AO"

            if sig_mismatch:
                items_audit.append({
                    "tag": item.tag,
                    "status": "WRONG",
                    "priority": "P2",
                    "priority_label": "P2 - Signal Type Mismatch",
                    "discrepancy_type": "SIGNAL_TYPE_MISMATCH",
                    "drawing_found": True,
                    "io_found": True,
                    "drawing_type": draw_tag.get("type"),
                    "io_signal_type": item.signal_type,
                    "expected_signal_type": expected_sig,
                    "units": item.units,
                    "range_span": f"{item.range_low} - {item.range_high}" if (item.range_low is not None and item.range_high is not None) else None,
                    "message": f"Signal mismatch: drawing indicates '{draw_tag.get('type')}', but DCS registers binary '{item.signal_type}'.",
                    "recommendation": f"Change registered signal type in DCS marshalling to '{expected_sig}'."
                })
                discrepancy_count += 1
                continue

            # Calibration Range Validation: High must exceed Low
            low_val = _safe_float(item.range_low)
            high_val = _safe_float(item.range_high)
            if low_val is not None and high_val is not None and high_val <= low_val:
                items_audit.append({
                    "tag": item.tag,
                    "status": "WRONG",
                    "priority": "P2",
                    "priority_label": "P2 - Calibration Inversion",
                    "discrepancy_type": "INVALID_CALIBRATION_RANGE",
                    "drawing_found": True,
                    "io_found": True,
                    "drawing_type": draw_tag.get("type"),
                    "io_signal_type": item.signal_type,
                    "expected_signal_type": item.signal_type,
                    "units": item.units,
                    "range_span": f"{item.range_low} - {item.range_high}",
                    "message": f"Inverted calibration range: min ({item.range_low}) >= max ({item.range_high}).",
                    "recommendation": "Correct calibration span endpoints in DCS database."
                })
                discrepancy_count += 1
                continue

            # All checks passed
            items_audit.append({
                "tag": item.tag,
                "status": "CORRECT",
                "priority": "P4",
                "priority_label": "P4 - Verified Safe",
                "discrepancy_type": None,
                "drawing_found": True,
                "io_found": True,
                "drawing_type": draw_tag.get("type"),
                "io_signal_type": item.signal_type,
                "expected_signal_type": item.signal_type,
                "units": item.units,
                "range_span": f"{item.range_low} - {item.range_high}" if (item.range_low is not None and item.range_high is not None) else None,
                "message": f"Verified match between drawing and registered DCS {item.signal_type or 'IO'} point.",
                "recommendation": "No discrepancy detected."
            })
            correct_count += 1

        # Check drawing tags missing from I/O list
        for t in resolved_tags:
            cat = t.get("category", "")
            norm = t["normalized_tag"].upper().replace(" ", "-")
            # Only instruments and motorized valves expect electrical I/O
            is_instrument = cat == "instrument" or any(k in t.get("type", "").lower() for k in ["transmitter", "sensor", "controller", "indicator"])
            is_control_valve = cat == "valve" and "control" in t.get("type", "").lower()

            if (is_instrument or is_control_valve) and norm not in io_map and norm.replace("-", "") not in io_map:
                items_audit.append({
                    "tag": t["normalized_tag"],
                    "status": "WRONG",
                    "priority": "P2",
                    "priority_label": "P2 - Missing in I/O Register",
                    "discrepancy_type": "MISSING_IN_IO_LIST",
                    "drawing_found": True,
                    "io_found": False,
                    "drawing_type": t.get("type"),
                    "io_signal_type": None,
                    "expected_signal_type": "AI" if is_instrument else "AO",
                    "units": None,
                    "range_span": None,
                    "message": f"Physical {t.get('type')} '{t['normalized_tag']}' found on drawing, but lacks a registered electrical DCS I/O channel.",
                    "recommendation": "Assign available DCS controller I/O point to this field device."
                })
                discrepancy_count += 1

        total_audited = correct_count + discrepancy_count
        accuracy_pct = round((correct_count / total_audited * 100), 1) if total_audited > 0 else 100.0
        audit_status = "PASSED" if discrepancy_count == 0 else "DISCREPANCIES_DETECTED"

        return {
            "status": audit_status,
            "accuracy_score_pct": accuracy_pct,
            "total_audited": total_audited,
            "correct_count": correct_count,
            "discrepancy_count": discrepancy_count,
            "items_audit": items_audit
        }
