"""
P&ID Connection Verification & DCS I/O List Audit Engine.
Provides industrial engineering sanity checks to determine if:
1. Topological connections in P&ID diagrams are Correct or Wrong.
2. DCS I/O list records are Correct or Wrong against physical drawing tags.
"""

from typing import Any, Dict, List, Optional, Set, Tuple
from services.api.app.db.schemas import GraphEdge, GraphNode, GraphSchema
from services.api.app.engine.io_parser import IoItem


# =============================================================================
# 1. P&ID Connection Verification Engine
# =============================================================================

class ConnectionValidator:
    """
    Validates topological process and signal connections in a P&ID drawing graph.
    Identifies correct connections, dead-ends, floating equipment, signal conflicts,
    and missing control loop links.
    """

    @staticmethod
    def validate_connections(
        graph: GraphSchema,
        resolved_tags: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        nodes_map = {n.id: n for n in graph.nodes}
        tags_map = {t["normalized_tag"]: t for t in (resolved_tags or [])}

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

            if not src_node or not dst_node:
                diagnostics.append({
                    "element_id": e.id,
                    "element_type": "edge",
                    "status": "WRONG",
                    "severity": "error",
                    "rule": "ORPHANED_EDGE",
                    "message": f"Connection '{e.id}' references non-existent node ('{e.source}' -> '{e.target}').",
                    "recommendation": "Remove broken connection or snap to recognized component tag."
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
                    "rule": "INCOMPATIBLE_LINE_TYPE",
                    "message": f"Process fluid line connected directly between two electrical instruments '{src_node.id}' and '{dst_node.id}'.",
                    "recommendation": "Change line type to instrument signal or pneumatic tubing."
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
                "rule": "VALID_CONNECTION",
                "message": f"{conn_desc} is structurally valid.",
                "recommendation": "Connection verified."
            })
            correct_count += 1

        # ---------------------------------------------------------------------
        # Node-level Validation: Equipment & Instrument Connectivity
        # ---------------------------------------------------------------------
        for n in graph.nodes:
            in_edges = incoming_edges.get(n.id, [])
            out_edges = outgoing_edges.get(n.id, [])
            all_edges = in_edges + out_edges

            # 1. Major Equipment Check (Tank, Exchanger, Column)
            if n.category == "equipment" and "pump" not in n.type.lower():
                process_edges = [e for e in all_edges if e.line_type == "process"]
                if len(process_edges) == 0:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "WRONG",
                        "severity": "error",
                        "rule": "FLOATING_EQUIPMENT",
                        "message": f"Major equipment '{n.id}' ({n.type}) has 0 connected process lines.",
                        "recommendation": "Connect inlet and outlet process streams to equipment nozzles."
                    })
                    error_count += 1
                else:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "CORRECT",
                        "severity": "info",
                        "rule": "EQUIPMENT_CONNECTED",
                        "message": f"Equipment '{n.id}' ({n.type}) is correctly piped into process stream.",
                        "recommendation": "Verified nozzle connection."
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
                        "rule": "DISCONNECTED_PUMP",
                        "message": f"Pump '{n.id}' is disconnected and has no piping connected.",
                        "recommendation": "Connect suction inlet and discharge outlet lines."
                    })
                    error_count += 1
                elif len(in_edges) == 0 and len(out_edges) > 0:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "WARNING",
                        "severity": "warning",
                        "rule": "MISSING_PUMP_SUCTION",
                        "message": f"Pump '{n.id}' has discharge line but suction inlet connection is missing.",
                        "recommendation": "Verify upstream suction line from feed vessel or tank."
                    })
                    warning_count += 1
                elif len(out_edges) == 0 and len(in_edges) > 0:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "WARNING",
                        "severity": "warning",
                        "rule": "MISSING_PUMP_DISCHARGE",
                        "message": f"Pump '{n.id}' has suction inlet but discharge line is missing.",
                        "recommendation": "Verify downstream discharge line to process header or exchanger."
                    })
                    warning_count += 1
                else:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "CORRECT",
                        "severity": "info",
                        "rule": "PUMP_FLOW_VERIFIED",
                        "message": f"Pump '{n.id}' suction and discharge stream connections are valid.",
                        "recommendation": "Verified."
                    })
                    correct_count += 1

            # 3. Control Valve Control Loop Continuity
            elif "valve" in n.category or "CV-" in n.id or "control" in n.type.lower():
                process_lines = [e for e in all_edges if e.line_type == "process"]
                signal_lines = [e for e in all_edges if e.line_type in ["signal", "electrical", "pneumatic"]]

                if len(process_lines) == 0:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "WRONG",
                        "severity": "error",
                        "rule": "FLOATING_VALVE",
                        "message": f"Control valve '{n.id}' is floating and not connected inline into any process piping.",
                        "recommendation": "Snap valve inline with process pipe."
                    })
                    error_count += 1
                elif ("CV" in n.id or "control" in n.type.lower()) and len(signal_lines) == 0:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "WARNING",
                        "severity": "warning",
                        "rule": "MISSING_CONTROL_SIGNAL",
                        "message": f"Modulating control valve '{n.id}' is inline with process pipe but lacks an actuation signal line from controller or DCS.",
                        "recommendation": "Connect control signal line from loop controller (e.g. FIC, LIC, PIC) to valve actuator."
                    })
                    warning_count += 1
                else:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "CORRECT",
                        "severity": "info",
                        "rule": "VALVE_VERIFIED",
                        "message": f"Control valve '{n.id}' is correctly piped and controlled.",
                        "recommendation": "Verified."
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
                        "rule": "ISOLATED_INSTRUMENT",
                        "message": f"Instrument '{n.id}' ({n.type}) is isolated with no process port or signal connection.",
                        "recommendation": "Connect impulse line to process pipe and signal line to DCS/controller."
                    })
                    warning_count += 1
                else:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "CORRECT",
                        "severity": "info",
                        "rule": "INSTRUMENT_CONNECTED",
                        "message": f"Instrument '{n.id}' connection is structurally verified.",
                        "recommendation": "Verified."
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
                        "rule": "UNCONNECTED_OPC",
                        "message": f"Off-page continuation connector '{n.id}' is not connected to any pipeline.",
                        "recommendation": "Connect to boundary process pipe."
                    })
                    warning_count += 1
                else:
                    diagnostics.append({
                        "element_id": n.id,
                        "element_type": "node",
                        "status": "CORRECT",
                        "severity": "info",
                        "rule": "OPC_STITCHED",
                        "message": f"Off-page connector '{n.id}' is linked to boundary pipeline.",
                        "recommendation": "Verified."
                    })
                    correct_count += 1

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

        # Known ISA-5.1 signal expectations
        # PT, FT, TT, LT, AT -> Analog Input (AI / 4-20mA / HART)
        # CV, FV, PV, LV, TV -> Analog Output (AO / 4-20mA)
        # XV, SDV, SOV, ESD -> Digital Output (DO)
        # ZS, PSH, PSL, TSH, TSL, LSH, LSL -> Digital Input (DI / Limit Switch)

        # 1. Audit all items defined in the DCS I/O register
        for item in io_items:
            norm = item.tag.upper().replace(" ", "-")
            drawing_match = drawing_map.get(norm) or drawing_map.get(norm.replace("-", ""))

            # A. Missing in Drawing
            if not drawing_match:
                items_audit.append({
                    "tag": item.tag,
                    "status": "WRONG",
                    "discrepancy_type": "MISSING_IN_DRAWING",
                    "drawing_found": False,
                    "io_found": True,
                    "drawing_type": None,
                    "io_signal_type": item.signal_type,
                    "expected_signal_type": IoListValidator._get_expected_signal_type(item.tag),
                    "units": item.units,
                    "range_span": f"{item.range_low} to {item.range_high}" if (item.range_low or item.range_high) else None,
                    "message": f"DCS Point '{item.tag}' is defined in I/O list, but missing from P&ID drawing.",
                    "recommendation": "Add instrument symbol to P&ID drawing or remove orphaned channel from DCS register."
                })
                discrepancy_count += 1
                continue

            # B. Check Signal Type Compatibility
            signal_mismatch, exp_sig = IoListValidator._check_signal_mismatch(item.tag, item.signal_type)
            if signal_mismatch:
                items_audit.append({
                    "tag": item.tag,
                    "status": "WRONG",
                    "discrepancy_type": "SIGNAL_TYPE_MISMATCH",
                    "drawing_found": True,
                    "io_found": True,
                    "drawing_type": drawing_match.get("type", "Instrument"),
                    "io_signal_type": item.signal_type,
                    "expected_signal_type": exp_sig,
                    "units": item.units,
                    "range_span": f"{item.range_low} to {item.range_high}" if (item.range_low or item.range_high) else None,
                    "message": f"Signal Type Mismatch on '{item.tag}': Configured as '{item.signal_type}', but ISA-5.1 standard expects '{exp_sig}'.",
                    "recommendation": f"Reconfigure DCS channel to '{exp_sig}' to match physical sensor."
                })
                discrepancy_count += 1
                continue

            # C. Check Calibration Range & Engineering Units
            range_err, range_msg = IoListValidator._check_calibration_range(item)
            if range_err:
                items_audit.append({
                    "tag": item.tag,
                    "status": "WRONG",
                    "discrepancy_type": "INVALID_CALIBRATION_RANGE",
                    "drawing_found": True,
                    "io_found": True,
                    "drawing_type": drawing_match.get("type", "Instrument"),
                    "io_signal_type": item.signal_type,
                    "expected_signal_type": exp_sig,
                    "units": item.units,
                    "range_span": f"{item.range_low} to {item.range_high}" if (item.range_low or item.range_high) else None,
                    "message": f"Calibration fault on '{item.tag}': {range_msg}",
                    "recommendation": "Correct calibration limits and provide valid engineering units."
                })
                discrepancy_count += 1
                continue

            # D. Fully Verified / Correct
            items_audit.append({
                "tag": item.tag,
                "status": "CORRECT",
                "discrepancy_type": None,
                "drawing_found": True,
                "io_found": True,
                "drawing_type": drawing_match.get("type", "Instrument"),
                "io_signal_type": item.signal_type,
                "expected_signal_type": exp_sig,
                "units": item.units,
                "range_span": f"{item.range_low} to {item.range_high}" if (item.range_low or item.range_high) else None,
                "message": f"DCS I/O record '{item.tag}' is 100% verified against physical P&ID drawing.",
                "recommendation": "Verified."
            })
            correct_count += 1

        # 2. Check for physical drawing instruments missing from the I/O list
        for t in resolved_tags:
            norm = t["normalized_tag"].upper().replace(" ", "-")
            io_match = io_map.get(norm) or io_map.get(norm.replace("-", ""))

            # Only flag instruments and automated valves that require electrical DCS I/O
            requires_io = IoListValidator._requires_dcs_io(t)
            if requires_io and not io_match:
                items_audit.append({
                    "tag": t["normalized_tag"],
                    "status": "WRONG",
                    "discrepancy_type": "MISSING_IN_IO_LIST",
                    "drawing_found": True,
                    "io_found": False,
                    "drawing_type": t.get("type", "Instrument"),
                    "io_signal_type": None,
                    "expected_signal_type": IoListValidator._get_expected_signal_type(t["normalized_tag"]),
                    "units": None,
                    "range_span": None,
                    "message": f"Physical instrument '{t['normalized_tag']}' ({t.get('type')}) is on P&ID blueprint, but missing from DCS I/O list.",
                    "recommendation": "Allocate a new DCS I/O channel and register signal wiring."
                })
                discrepancy_count += 1

        total_audited = correct_count + discrepancy_count
        accuracy_score = round((correct_count / total_audited * 100), 1) if total_audited > 0 else 100.0

        return {
            "status": "PASSED" if discrepancy_count == 0 else "DISCREPANCIES_DETECTED",
            "accuracy_score_pct": accuracy_score,
            "total_audited": total_audited,
            "correct_count": correct_count,
            "discrepancy_count": discrepancy_count,
            "items_audit": items_audit
        }

    @staticmethod
    def _requires_dcs_io(tag_item: Dict[str, Any]) -> bool:
        norm = tag_item["normalized_tag"].upper()
        cat = tag_item.get("category", "")
        # Major transmitters or automated valves
        if any(norm.startswith(p) for p in ["PT", "TT", "FT", "LT", "AT", "CV", "FV", "PV", "LV", "XV"]):
            return True
        if "transmitter" in tag_item.get("type", "").lower():
            return True
        return False

    @staticmethod
    def _get_expected_signal_type(tag_name: str) -> str:
        norm = tag_name.upper().replace("-", "")
        if any(norm.startswith(p) for p in ["PT", "FT", "TT", "LT", "AT"]):
            return "AI (Analog Input / 4-20mA)"
        if any(norm.startswith(p) for p in ["CV", "FV", "PV", "LV", "TV"]):
            return "AO (Analog Output / 4-20mA)"
        if any(norm.startswith(p) for p in ["XV", "SDV", "SOV"]):
            return "DO (Digital Output)"
        if any(norm.startswith(p) for p in ["ZS", "PSH", "PSL", "TSH", "TSL", "LSH", "LSL"]):
            return "DI (Digital Input)"
        return "Analog or Digital Signal"

    @staticmethod
    def _check_signal_mismatch(tag_name: str, signal_type: Optional[str]) -> Tuple[bool, str]:
        if not signal_type:
            return False, ""
        sig = signal_type.upper()
        norm = tag_name.upper().replace("-", "")

        # Analog transmitters must not be DI
        if any(norm.startswith(p) for p in ["PT", "FT", "TT", "LT"]) and "DI" in sig and "AI" not in sig:
            return True, "AI (Analog Input / 4-20mA)"
        # Modulating control valves must not be DO
        if any(norm.startswith(p) for p in ["CV", "FV", "PV", "LV"]) and "DO" in sig and "AO" not in sig:
            return True, "AO (Analog Output / 4-20mA)"
        # On/off shutdown valves must not be AI
        if any(norm.startswith(p) for p in ["XV", "SDV"]) and "AI" in sig:
            return True, "DO (Digital Output)"

        return False, ""

    @staticmethod
    def _check_calibration_range(item: IoItem) -> Tuple[bool, str]:
        if item.range_low is not None and item.range_high is not None:
            try:
                low = float(item.range_low)
                high = float(item.range_high)
                if high <= low:
                    return True, f"Inverted limits: high limit ({high}) <= low limit ({low})."
            except ValueError:
                pass

        # If transmitter has non-empty range but missing units
        norm = item.tag.upper().replace("-", "")
        if any(norm.startswith(p) for p in ["PT", "FT", "TT", "LT"]):
            if (item.range_low or item.range_high) and not item.units:
                return True, "Missing required engineering units (e.g. psi, bar, degC, m3/h)."

        return False, ""
