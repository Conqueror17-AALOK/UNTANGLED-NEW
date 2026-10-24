"""
Multi-Sheet P&ID Merging & Incremental Revision Diff Engine.
Provides:
1. MultiSheetMerger: stitches multiple P&ID sheets via Off-Page Connectors (OPCs) into a master plant topology.
2. RevisionDiffEngine: detects additions, modifications, and removals between P&ID revisions and I/O updates.
"""

from dataclasses import dataclass
import json
import math
import os
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from pydantic import BaseModel, Field

from services.api.app.db.schemas import (
    GraphEdge,
    GraphNode,
    GraphSchema,
    GraphWarning,
)


# =============================================================================
# Schemas for Multi-Sheet & Revision Diff
# =============================================================================

class TagDiffItem(BaseModel):
    tag: str
    tag_id: str
    page: int
    type: str
    category: str
    status: str
    change_type: str  # "added", "removed", "modified", "unchanged"
    details: Dict[str, Any] = Field(default_factory=dict)


class EdgeDiffItem(BaseModel):
    source: str
    target: str
    line_type: str
    change_type: str  # "added", "removed", "unchanged"


class RevisionDiffSummary(BaseModel):
    total_tags_v1: int
    total_tags_v2: int
    added_tags_count: int
    removed_tags_count: int
    modified_tags_count: int
    unchanged_tags_count: int
    added_edges_count: int
    removed_edges_count: int


class RevisionDiffSchema(BaseModel):
    job_v1: str
    job_v2: str
    summary: RevisionDiffSummary
    added_tags: List[TagDiffItem] = Field(default_factory=list)
    removed_tags: List[TagDiffItem] = Field(default_factory=list)
    modified_tags: List[TagDiffItem] = Field(default_factory=list)
    unchanged_tags: List[TagDiffItem] = Field(default_factory=list)
    edge_changes: List[EdgeDiffItem] = Field(default_factory=list)
    io_changes: List[Dict[str, Any]] = Field(default_factory=list)


# =============================================================================
# Part 1: Multi-Sheet P&ID Merging Engine
# =============================================================================

class MultiSheetMerger:
    """
    Merges multiple P&ID drawing sheets or jobs into a unified master topology.
    Correlates cross-sheet Off-Page Connectors (OPCs) and aligns coordinates.
    """

    def __init__(self, sheet_spacing_x: float = 2400.0):
        self.sheet_spacing_x = sheet_spacing_x

    def merge_graphs(
        self,
        graphs: List[GraphSchema],
        sheet_labels: Optional[List[str]] = None,
        all_opcs: Optional[List[Dict[str, Any]]] = None,
    ) -> GraphSchema:
        """
        Combine multiple subgraphs into a unified master graph.
        Stitches boundary pipelines using Off-Page Connector (OPC) metadata.
        """
        if not graphs:
            return GraphSchema(version=1, nodes=[], edges=[], warnings=[])
        if len(graphs) == 1:
            return graphs[0]

        merged_nodes: List[GraphNode] = []
        merged_edges: List[GraphEdge] = []
        merged_warnings: List[GraphWarning] = []
        seen_node_ids: Set[str] = set()

        edge_counter = 1

        for sheet_idx, g in enumerate(graphs):
            x_offset = sheet_idx * self.sheet_spacing_x
            label_prefix = sheet_labels[sheet_idx] if sheet_labels and sheet_idx < len(sheet_labels) else f"S{sheet_idx+1}"
            node_id_map: Dict[str, str] = {}

            # 1. Offset node coordinates horizontally so sheets sit side-by-side
            for n in g.nodes:
                # Disambiguate local IDs if needed, preserving major equipment tags
                node_id = n.id
                if node_id in seen_node_ids:
                    node_id = f"{label_prefix}:{n.id}"
                seen_node_ids.add(node_id)
                node_id_map[n.id] = node_id

                merged_nodes.append(
                    GraphNode(
                        id=node_id,
                        type=n.type,
                        category=n.category,
                        x=round(n.x + x_offset, 1),
                        y=n.y,
                        confidence=n.confidence,
                        tag_id=n.tag_id,
                        warnings=n.warnings,
                    )
                )

            # 2. Add intra-sheet edges with remapped node identifiers
            for e in g.edges:
                src = node_id_map.get(e.source, e.source)
                tgt = node_id_map.get(e.target, e.target)
                merged_edges.append(
                    GraphEdge(
                        id=f"m_e_{edge_counter:03d}",
                        source=src,
                        target=tgt,
                        line_type=e.line_type,
                        directed=e.directed,
                    )
                )
                edge_counter += 1

            for w in g.warnings:
                merged_warnings.append(w)

        # 3. Off-Page Connector (OPC) Boundary Cross-Sheet Stitching
        if all_opcs:
            opc_edges = self._stitch_opc_connectors(all_opcs, merged_nodes, edge_counter)
            merged_edges.extend(opc_edges)

        return GraphSchema(
            version=1,
            nodes=merged_nodes,
            edges=merged_edges,
            warnings=merged_warnings,
        )

    def _stitch_opc_connectors(
        self,
        opcs: List[Dict[str, Any]],
        nodes: List[GraphNode],
        start_edge_idx: int = 1,
    ) -> List[GraphEdge]:
        """
        Match outgoing connectors (TO SHEET X) with incoming connectors (FROM SHEET Y)
        or matching pipeline codes, and construct inter-sheet process pipe edges.
        """
        cross_edges: List[GraphEdge] = []
        edge_idx = start_edge_idx
        used_destinations: Set[int] = set()

        # Segregate into outgoing, incoming, and generic connectors
        outgoing = []
        incoming = []
        generic = []

        for idx, o in enumerate(opcs):
            lbl = o.get("label", "").upper()
            if "TO" in lbl or "CONT" in lbl:
                outgoing.append((idx, o))
            elif "FROM" in lbl:
                incoming.append((idx, o))
            else:
                generic.append((idx, o))

        # Pass 1: Match Outgoing <-> Incoming
        for src_idx, src in outgoing:
            src_lbl = src.get("label", "").upper()
            src_sheet = src.get("sheet", 1)
            src_line = self._extract_line_code(src_lbl)

            for dst_idx, dst in incoming:
                if dst_idx in used_destinations:
                    continue
                dst_lbl = dst.get("label", "").upper()
                dst_sheet = dst.get("sheet", 2)
                if src_sheet == dst_sheet:
                    continue

                dst_line = self._extract_line_code(dst_lbl)

                matched = False
                # Match A: Identical line code (e.g. 10-P-101, 2"-P-101)
                if src_line and dst_line and src_line == dst_line:
                    matched = True
                # Match B: Reciprocal sheet reference (TO SHEET 2 <-> FROM SHEET 1)
                elif f"SHEET {dst_sheet}" in src_lbl or f"DWG {dst_sheet}" in src_lbl or f"S{dst_sheet}" in src_lbl:
                    if f"SHEET {src_sheet}" in dst_lbl or f"DWG {src_sheet}" in dst_lbl or f"S{src_sheet}" in dst_lbl:
                        matched = True

                if matched:
                    src_node = self._find_nearest_node(src, nodes, src_sheet)
                    dst_node = self._find_nearest_node(dst, nodes, dst_sheet)

                    if src_node and dst_node and src_node != dst_node:
                        cross_edges.append(
                            GraphEdge(
                                id=f"opc_bridge_{edge_idx:02d}",
                                source=src_node,
                                target=dst_node,
                                line_type="process",
                                directed=True,
                            )
                        )
                        edge_idx += 1
                        used_destinations.add(dst_idx)
                        break

        # Pass 2: Match Generic connectors sharing identical line codes across different sheets
        all_connectors = outgoing + incoming + generic
        for i, (idx1, c1) in enumerate(all_connectors):
            code1 = self._extract_line_code(c1.get("label", ""))
            sheet1 = c1.get("sheet", 1)
            if not code1:
                continue

            for j, (idx2, c2) in enumerate(all_connectors):
                if j <= i or idx2 in used_destinations:
                    continue
                sheet2 = c2.get("sheet", 2)
                if sheet1 == sheet2:
                    continue

                code2 = self._extract_line_code(c2.get("label", ""))
                if code1 == code2:
                    node1 = self._find_nearest_node(c1, nodes, sheet1)
                    node2 = self._find_nearest_node(c2, nodes, sheet2)
                    if node1 and node2 and node1 != node2:
                        cross_edges.append(
                            GraphEdge(
                                id=f"opc_bridge_{edge_idx:02d}",
                                source=node1,
                                target=node2,
                                line_type="process",
                                directed=True,
                            )
                        )
                        edge_idx += 1
                        used_destinations.add(idx2)
                        break

        return cross_edges

    def _extract_line_code(self, label: str) -> Optional[str]:
        # 1. "LINE 10-P-101"
        m = re.search(r"LINE\s+([A-Z0-9\-]+)", label, re.IGNORECASE)
        if m:
            return m.group(1).upper()
        # 2. Piping spec pattern e.g. 10-P-101, 01-CW-204, 2"-P-101
        m2 = re.search(r"(\d{1,4}\"?\-[A-Z]{1,3}\-\d{3,4}(?:\-[A-Z0-9]+)?)", label)
        if m2:
            return m2.group(1).upper()
        # 3. Direct equipment link e.g. TO TK-101, FROM P-102
        m3 = re.search(r"(?:TO|FROM)\s+([A-Z]{1,3}\-\d{2,4}[A-Z]?)", label, re.IGNORECASE)
        if m3:
            return m3.group(1).upper()
        return None

    def _find_nearest_node(self, opc: Dict[str, Any], nodes: List[GraphNode], sheet: int) -> Optional[str]:
        # If label references a specific tag directly e.g. "TO TK-101", check if node exists
        code = self._extract_line_code(opc.get("label", ""))
        if code:
            for n in nodes:
                if n.id == code or (n.tag_id and n.tag_id == code):
                    return n.id

        bbox = opc.get("bbox", [0, 0, 0, 0])
        cx = (bbox[0] + bbox[2]) / 2.0
        cy = (bbox[1] + bbox[3]) / 2.0

        # Adjust for horizontal sheet spacing
        cx_offset = cx + (sheet - 1) * self.sheet_spacing_x

        best_node = None
        min_dist = float("inf")

        for n in nodes:
            dist = math.sqrt((n.x - cx_offset) ** 2 + (n.y - cy) ** 2)
            if dist < min_dist:
                min_dist = dist
                best_node = n.id

        return best_node if min_dist < 1200.0 else None


# =============================================================================
# Part 2: Incremental Revision Tracking & Diff Engine
# =============================================================================

class RevisionDiffEngine:
    """
    Computes exact differential changes (Delta) between baseline and updated P&ID revisions:
    - Added, Modified, Removed, and Unchanged equipment, instruments, and valves.
    - Preserves previous human review decisions and applies them to identical components.
    - Tracks changes in I/O list parameters and topological connections.
    """

    @staticmethod
    def compare_revisions(
        job_v1_id: str,
        tags_v1: List[Dict[str, Any]],
        graph_v1: Dict[str, Any],
        job_v2_id: str,
        tags_v2: List[Dict[str, Any]],
        graph_v2: Dict[str, Any],
        io_items_v1: Optional[List[Dict[str, Any]]] = None,
        io_items_v2: Optional[List[Dict[str, Any]]] = None,
    ) -> RevisionDiffSchema:
        """
        Compute full engineering delta between Rev 1 and Rev 2.
        """
        # Index tags by normalized_tag
        v1_by_tag: Dict[str, Dict[str, Any]] = {t["normalized_tag"]: t for t in tags_v1}
        v2_by_tag: Dict[str, Dict[str, Any]] = {t["normalized_tag"]: t for t in tags_v2}

        added_tags: List[TagDiffItem] = []
        removed_tags: List[TagDiffItem] = []
        modified_tags: List[TagDiffItem] = []
        unchanged_tags: List[TagDiffItem] = []

        # 1. Identify Added and Modified in V2
        for tag_name, t2 in v2_by_tag.items():
            if tag_name not in v1_by_tag:
                added_tags.append(
                    TagDiffItem(
                        tag=tag_name,
                        tag_id=t2["id"],
                        page=t2.get("page", 1),
                        type=t2.get("type", "Unknown"),
                        category=t2.get("category", "instrument"),
                        status=t2.get("status", "resolved"),
                        change_type="added",
                        details={"message": f"New component '{tag_name}' introduced in Revision 2."},
                    )
                )
            else:
                t1 = v1_by_tag[tag_name]
                changes = RevisionDiffEngine._detect_tag_modifications(t1, t2)
                if changes:
                    modified_tags.append(
                        TagDiffItem(
                            tag=tag_name,
                            tag_id=t2["id"],
                            page=t2.get("page", 1),
                            type=t2.get("type", "Unknown"),
                            category=t2.get("category", "instrument"),
                            status=t2.get("status", "resolved"),
                            change_type="modified",
                            details={"modifications": changes},
                        )
                    )
                else:
                    unchanged_tags.append(
                        TagDiffItem(
                            tag=tag_name,
                            tag_id=t2["id"],
                            page=t2.get("page", 1),
                            type=t2.get("type", "Unknown"),
                            category=t2.get("category", "instrument"),
                            status=t2.get("status", "resolved"),
                            change_type="unchanged",
                            details={},
                        )
                    )

        # 2. Identify Removed in V2 (existed in V1, missing in V2)
        for tag_name, t1 in v1_by_tag.items():
            if tag_name not in v2_by_tag:
                removed_tags.append(
                    TagDiffItem(
                        tag=tag_name,
                        tag_id=t1["id"],
                        page=t1.get("page", 1),
                        type=t1.get("type", "Unknown"),
                        category=t1.get("category", "instrument"),
                        status=t1.get("status", "resolved"),
                        change_type="removed",
                        details={"message": f"Component '{tag_name}' decommissioned or deleted in Revision 2."},
                    )
                )

        # 3. Compare Process Topology Edges
        v1_edges = {(e["source"], e["target"]): e for e in graph_v1.get("edges", [])}
        v2_edges = {(e["source"], e["target"]): e for e in graph_v2.get("edges", [])}

        edge_changes: List[EdgeDiffItem] = []
        for pair, e2 in v2_edges.items():
            if pair not in v1_edges:
                edge_changes.append(
                    EdgeDiffItem(
                        source=e2["source"],
                        target=e2["target"],
                        line_type=e2.get("line_type", "process"),
                        change_type="added",
                    )
                )
        for pair, e1 in v1_edges.items():
            if pair not in v2_edges:
                edge_changes.append(
                    EdgeDiffItem(
                        source=e1["source"],
                        target=e1["target"],
                        line_type=e1.get("line_type", "process"),
                        change_type="removed",
                    )
                )

        # 4. Compare DCS I/O List Records
        io_changes = RevisionDiffEngine._compare_io_lists(io_items_v1, io_items_v2)

        summary = RevisionDiffSummary(
            total_tags_v1=len(tags_v1),
            total_tags_v2=len(tags_v2),
            added_tags_count=len(added_tags),
            removed_tags_count=len(removed_tags),
            modified_tags_count=len(modified_tags),
            unchanged_tags_count=len(unchanged_tags),
            added_edges_count=sum(1 for e in edge_changes if e.change_type == "added"),
            removed_edges_count=sum(1 for e in edge_changes if e.change_type == "removed"),
        )

        return RevisionDiffSchema(
            job_v1=job_v1_id,
            job_v2=job_v2_id,
            summary=summary,
            added_tags=added_tags,
            removed_tags=removed_tags,
            modified_tags=modified_tags,
            unchanged_tags=unchanged_tags,
            edge_changes=edge_changes,
            io_changes=io_changes,
        )

    @staticmethod
    def _detect_tag_modifications(t1: Dict[str, Any], t2: Dict[str, Any]) -> List[str]:
        changes = []
        if t1.get("type") != t2.get("type"):
            changes.append(f"Type updated: '{t1.get('type')}' -> '{t2.get('type')}'")
        if t1.get("category") != t2.get("category"):
            changes.append(f"Category changed: '{t1.get('category')}' -> '{t2.get('category')}'")

        # Bounding box coordinate shift (>30px displacement indicates relocation)
        b1 = t1.get("bbox", [0, 0, 0, 0])
        b2 = t2.get("bbox", [0, 0, 0, 0])
        c1 = ((b1[0] + b1[2]) / 2.0, (b1[1] + b1[3]) / 2.0)
        c2 = ((b2[0] + b2[2]) / 2.0, (b2[1] + b2[3]) / 2.0)
        shift = math.sqrt((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2)
        if shift > 30.0:
            changes.append(f"Component relocated on drawing: shifted {int(shift)}px")

        # I/O match score or status shift
        io1 = t1.get("io_match", {}).get("io_tag")
        io2 = t2.get("io_match", {}).get("io_tag")
        if io1 != io2:
            changes.append(f"I/O mapping changed: '{io1}' -> '{io2}'")

        return changes

    @staticmethod
    def _compare_io_lists(
        v1: Optional[List[Dict[str, Any]]],
        v2: Optional[List[Dict[str, Any]]],
    ) -> List[Dict[str, Any]]:
        if not v1 or not v2:
            return []

        dict1 = {item.get("tag"): item for item in v1 if item.get("tag")}
        dict2 = {item.get("tag"): item for item in v2 if item.get("tag")}

        diffs = []
        for tag, item2 in dict2.items():
            if tag not in dict1:
                diffs.append({
                    "tag": tag,
                    "change": "added_to_io_list",
                    "description": item2.get("description", ""),
                    "signal_type": item2.get("signal_type", ""),
                })
            else:
                item1 = dict1[tag]
                param_changes = []
                for field in ["signal_type", "range_low", "range_high", "units", "description"]:
                    val1 = item1.get(field)
                    val2 = item2.get(field)
                    if str(val1).strip() != str(val2).strip() and (val1 or val2):
                        param_changes.append(f"{field}: '{val1}' -> '{val2}'")
                if param_changes:
                    diffs.append({
                        "tag": tag,
                        "change": "modified_in_io_list",
                        "modifications": param_changes,
                    })

        for tag, item1 in dict1.items():
            if tag not in dict2:
                diffs.append({
                    "tag": tag,
                    "change": "removed_from_io_list",
                    "description": item1.get("description", ""),
                })

        return diffs

    @staticmethod
    def carry_forward_human_decisions(
        baseline_tags: List[Dict[str, Any]],
        current_tags: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Carries forward human approvals, corrections, and rejections
        from the baseline revision to matching components in the updated revision.
        Preserves human engineering effort across revision cycles.
        """
        base_map = {t.get("normalized_tag"): t for t in baseline_tags if t.get("normalized_tag")}

        for t in current_tags:
            tag_name = t.get("normalized_tag")
            if not tag_name or tag_name not in base_map:
                continue

            base_t = base_map[tag_name]
            base_status = base_t.get("status")

            # If user marked it resolved or rejected in baseline revision
            if base_status in ["resolved", "rejected"]:
                t["status"] = base_status
                t["source"] = "carried_forward"
                t["reasoning"] = f"Decision carried forward from baseline revision (Status: {base_status})"

                # Carry forward any human-corrected type or category
                if base_t.get("type"):
                    t["type"] = base_t["type"]
                if base_t.get("category"):
                    t["category"] = base_t["category"]

        return current_tags
