import { GraphData, ReportData, Tag } from '../types';

export const INITIAL_TAGS: Tag[] = [
  {
    id: "tag_0001",
    page: 1,
    raw_text: "TK-101",
    normalized_tag: "TK-101",
    type: "Storage Tank",
    category: "equipment",
    bbox: [100, 300, 240, 580],
    confidence: 0.98,
    conf_breakdown: { ocr: 0.99, symbol: 0.96, io_match: 1.0, grammar: 1.0, llm: 0.98 },
    status: "resolved",
    io_match: { matched: true, io_tag: "TK-101", score: 100 },
    reasoning: "Exact match in drawing and IO list. Atmospheric feed vessel."
  },
  {
    id: "tag_0002",
    page: 1,
    raw_text: "P-101A",
    normalized_tag: "P-101A",
    type: "Duty Feed Pump",
    category: "equipment",
    bbox: [520, 260, 580, 320],
    confidence: 0.97,
    conf_breakdown: { ocr: 0.98, symbol: 0.95, io_match: 1.0, grammar: 1.0, llm: 0.97 },
    status: "resolved",
    io_match: { matched: true, io_tag: "P-101A", score: 100 },
    reasoning: "Centrifugal pump symbol matched with suction strainer FL-101."
  },
  {
    id: "tag_0003",
    page: 1,
    raw_text: "P-101B",
    normalized_tag: "P-101B",
    type: "Standby Feed Pump",
    category: "equipment",
    bbox: [520, 420, 580, 480],
    confidence: 0.96,
    conf_breakdown: { ocr: 0.97, symbol: 0.95, io_match: 1.0, grammar: 1.0, llm: 0.96 },
    status: "resolved",
    io_match: { matched: true, io_tag: "P-101B", score: 100 },
    reasoning: "Identical standby train pump matched in IO list."
  },
  {
    id: "tag_0004",
    page: 1,
    raw_text: "PT10l",
    normalized_tag: "PT-101",
    type: "Pressure Transmitter",
    category: "instrument",
    bbox: [220, 160, 280, 210],
    confidence: 0.72,
    conf_breakdown: { ocr: 0.72, symbol: 0.92, io_match: 1.0, grammar: 1.0, llm: 0.88 },
    status: "needs_review",
    io_match: { matched: true, io_tag: "PT-101", score: 92 },
    reasoning: "Trailing 'l' optical noise read as '1'; matched PT-101 in IO list. Requires confirmation."
  },
  {
    id: "tag_0005",
    page: 1,
    raw_text: "FT-101",
    normalized_tag: "FT-101",
    type: "Flow Transmitter",
    category: "instrument",
    bbox: [850, 220, 910, 270],
    confidence: 0.96,
    conf_breakdown: { ocr: 0.96, symbol: 0.94, io_match: 1.0, grammar: 1.0, llm: 0.96 },
    status: "resolved",
    io_match: { matched: true, io_tag: "FT-101", score: 100 },
    reasoning: "Standard ISA-5.1 orifice transmitter on discharge line."
  },
  {
    id: "tag_0006",
    page: 1,
    raw_text: "FIC-101",
    normalized_tag: "FIC-101",
    type: "Flow Indicating Controller",
    category: "instrument",
    bbox: [850, 130, 910, 180],
    confidence: 0.94,
    conf_breakdown: { ocr: 0.94, symbol: 0.92, io_match: 1.0, grammar: 1.0, llm: 0.94 },
    status: "resolved",
    io_match: { matched: true, io_tag: "FIC-101", score: 100 },
    reasoning: "DCS loop controller receiving 4-20mA from FT-101."
  },
  {
    id: "tag_0007",
    page: 1,
    raw_text: "CV-101",
    normalized_tag: "CV-101",
    type: "Control Valve",
    category: "valve",
    bbox: [940, 260, 990, 310],
    confidence: 0.95,
    conf_breakdown: { ocr: 0.95, symbol: 0.93, io_match: 1.0, grammar: 1.0, llm: 0.95 },
    status: "resolved",
    io_match: { matched: true, io_tag: "CV-101", score: 100 },
    reasoning: "Pneumatic diaphragm control valve on battery limit line."
  },
  {
    id: "tag_0008",
    page: 1,
    raw_text: "HV-77",
    normalized_tag: "HV-77",
    type: "Manual Hand Valve",
    category: "valve",
    bbox: [1040, 270, 1080, 310],
    confidence: 0.68,
    conf_breakdown: { ocr: 0.88, symbol: 0.85, io_match: 0.0, grammar: 0.9, llm: 0.70 },
    status: "needs_review",
    io_match: { matched: false },
    reasoning: "Manual mechanical valve detected in drawing; absent from electrical/instrument IO list."
  }
];

export const MOCK_GRAPH: GraphData = {
  version: 1,
  nodes: [
    { id: "TK-101", type: "Storage Tank", category: "equipment", x: 140, y: 320, confidence: 0.98, tag_id: "tag_0001" },
    { id: "P-101A", type: "Duty Pump", category: "equipment", x: 440, y: 240, confidence: 0.97, tag_id: "tag_0002" },
    { id: "P-101B", type: "Standby Pump", category: "equipment", x: 440, y: 400, confidence: 0.96, tag_id: "tag_0003" },
    { id: "E-101", type: "Heat Exchanger", category: "equipment", x: 620, y: 240, confidence: 0.95 },
    { id: "PT-101", type: "Pressure Transmitter", category: "instrument", x: 140, y: 150, confidence: 0.72, tag_id: "tag_0004" },
    { id: "FT-101", type: "Flow Transmitter", category: "instrument", x: 740, y: 150, confidence: 0.96, tag_id: "tag_0005" },
    { id: "FIC-101", type: "Flow Controller", category: "instrument", x: 860, y: 150, confidence: 0.94, tag_id: "tag_0006" },
    { id: "CV-101", type: "Control Valve", category: "valve", x: 860, y: 240, confidence: 0.95, tag_id: "tag_0007" },
    { id: "HV-77", type: "Manual Valve", category: "valve", x: 1000, y: 240, confidence: 0.68, tag_id: "tag_0008" },
    { id: "UNIT-200", type: "Battery Limit", category: "equipment", x: 1140, y: 240, confidence: 0.99 }
  ],
  edges: [
    { id: "e1", source: "TK-101", target: "P-101A", line_type: "process", directed: true },
    { id: "e2", source: "TK-101", target: "P-101B", line_type: "process", directed: true },
    { id: "e3", source: "P-101A", target: "E-101", line_type: "process", directed: true },
    { id: "e4", source: "P-101B", target: "E-101", line_type: "process", directed: true },
    { id: "e5", source: "E-101", target: "CV-101", line_type: "process", directed: true },
    { id: "e6", source: "CV-101", target: "HV-77", line_type: "process", directed: true },
    { id: "e7", source: "HV-77", target: "UNIT-200", line_type: "process", directed: true },
    { id: "e8", source: "TK-101", target: "PT-101", line_type: "electrical", directed: false },
    { id: "e9", source: "FT-101", target: "FIC-101", line_type: "signal", directed: true },
    { id: "e10", source: "FIC-101", target: "CV-101", line_type: "signal", directed: true }
  ],
  warnings: []
};

export const MOCK_REPORT: ReportData = {
  summary: {
    tags_total: 8,
    resolved: 6,
    needs_review: 2,
    rejected: 0,
    auto_pct: 75.0,
    llm_pct: 12.5,
    human_pct: 12.5
  },
  missing_in_drawing: [
    { io_tag: "FT-310", description: "Secondary Recycle Flow Sensor defined in DCS IO List, not found on sheet 1." }
  ],
  missing_in_io_list: [
    { tag: "HV-77", tag_id: "tag_0008" }
  ],
  type_mismatches: [
    { tag: "PT-101", drawing_type: "PT (Headspace)", io_signal: "4-20mA AI" }
  ],
  graph_warnings: []
};
