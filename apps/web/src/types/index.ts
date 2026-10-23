export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export type PipelineStage = 
  | 'perception'
  | 'io_parse'
  | 'cleanup'
  | 'llm_resolve'
  | 'validate'
  | 'graph'
  | 'simplify'
  | 'layout'
  | 'report';

export interface JobSummary {
  resolved: number;
  needs_review: number;
  rejected: number;
}

export interface Job {
  job_id: string;
  status: JobStatus;
  stage: PipelineStage;
  progress: number;
  pages?: number;
  summary?: JobSummary;
  error?: {
    code: string;
    message: string;
  } | null;
}

export interface ConfidenceBreakdown {
  ocr?: number;
  symbol?: number;
  io_match?: number;
  grammar?: number;
  llm?: number;
}

export interface IOMatch {
  matched: boolean;
  io_tag?: string;
  score?: number;
}

export interface Tag {
  id: string;
  page: number;
  raw_text: string;
  normalized_tag: string;
  type: string;
  category: 'instrument' | 'equipment' | 'valve' | 'line' | string;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number;
  conf_breakdown: ConfidenceBreakdown;
  status: 'resolved' | 'needs_review' | 'rejected';
  io_match: IOMatch;
  reasoning?: string;
  source?: 'auto' | 'llm' | 'human';
}

export interface GraphNode {
  id: string;
  type: string;
  category: string;
  x: number;
  y: number;
  confidence: number;
  tag_id?: string;
  warnings?: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  line_type: 'process' | 'signal' | 'pneumatic' | 'electrical' | string;
  directed: boolean;
}

export interface GraphWarning {
  node: string;
  code: string;
  message: string;
}

export interface GraphData {
  version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: GraphWarning[];
}

export interface ReportSummary {
  tags_total: number;
  resolved: number;
  needs_review: number;
  rejected: number;
  auto_pct: number;
  llm_pct: number;
  human_pct: number;
}

export interface MissingInDrawing {
  io_tag: string;
  description?: string;
}

export interface MissingInIOList {
  tag: string;
  tag_id: string;
}

export interface TypeMismatch {
  tag: string;
  drawing_type: string;
  io_signal: string;
}

export interface ReportData {
  summary: ReportSummary;
  missing_in_drawing: MissingInDrawing[];
  missing_in_io_list: MissingInIOList[];
  type_mismatches: TypeMismatch[];
  graph_warnings: GraphWarning[];
}

export type WebSocketEvent =
  | { event: 'stage_started'; job_id: string; stage: PipelineStage; progress: number }
  | { event: 'stage_done'; job_id: string; stage: PipelineStage; progress: number; stats?: Record<string, unknown> }
  | { event: 'job_done'; job_id: string; summary: JobSummary }
  | { event: 'job_failed'; job_id: string; error: { code: string; message: string } }
  | { event: 'graph_rebuilt'; job_id: string; version: number };
