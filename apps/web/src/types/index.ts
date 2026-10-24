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
  signal_type?: string;
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

export interface ConnectionDiagnostic {
  element_id: string;
  element_type: 'node' | 'edge';
  status: 'CORRECT' | 'WARNING' | 'WRONG';
  severity: 'info' | 'warning' | 'error';
  rule: string;
  message: string;
  recommendation: string;
}

export interface ConnectionValidationData {
  status: 'PASSED' | 'NEEDS_ATTENTION' | 'FAILED';
  health_score_pct: number;
  total_checks: number;
  correct_count: number;
  warning_count: number;
  error_count: number;
  diagnostics: ConnectionDiagnostic[];
}

export interface IoAuditItem {
  tag: string;
  status: 'CORRECT' | 'WRONG';
  discrepancy_type?: string | null;
  drawing_found: boolean;
  io_found: boolean;
  drawing_type?: string | null;
  io_signal_type?: string | null;
  expected_signal_type?: string | null;
  units?: string | null;
  range_span?: string | null;
  message: string;
  recommendation: string;
}

export interface IoVerificationData {
  status: 'PASSED' | 'DISCREPANCIES_DETECTED';
  accuracy_score_pct: number;
  total_audited: number;
  correct_count: number;
  discrepancy_count: number;
  items_audit: IoAuditItem[];
}

export interface VerificationReportData {
  job_id: string;
  connection_validation: ConnectionValidationData;
  io_verification: IoVerificationData;
}

export interface ReportData {
  summary: ReportSummary;
  missing_in_drawing: MissingInDrawing[];
  missing_in_io_list: MissingInIOList[];
  type_mismatches: TypeMismatch[];
  graph_warnings: GraphWarning[];
  connection_validation?: ConnectionValidationData | null;
  io_verification?: IoVerificationData | null;
  lang?: string;
  i18n_labels?: Record<string, string>;
}

export type WebSocketEvent =
  | { event: 'stage_started'; job_id: string; stage: PipelineStage; progress: number }
  | { event: 'stage_done'; job_id: string; stage: PipelineStage; progress: number; stats?: Record<string, unknown> }
  | { event: 'job_done'; job_id: string; summary: JobSummary }
  | { event: 'job_failed'; job_id: string; error: { code: string; message: string } }
  | { event: 'graph_rebuilt'; job_id: string; version: number };

export interface MergeJobsRequest {
  job_ids: string[];
  merged_job_name?: string;
}

export interface MergeJobsResponse {
  merged_job_id: string;
  status: string;
  nodes_count: number;
  edges_count: number;
  source_jobs: string[];
  cross_sheet_connections: number;
}

export interface TagDiffItem {
  tag: string;
  tag_id: string;
  page: number;
  type: string;
  category: string;
  status: string;
  change_type: 'added' | 'removed' | 'modified' | 'unchanged';
  details: Record<string, unknown>;
}

export interface EdgeDiffItem {
  source: string;
  target: string;
  line_type: string;
  change_type: 'added' | 'removed' | 'unchanged';
}

export interface RevisionDiffSummary {
  total_tags_v1: number;
  total_tags_v2: number;
  added_tags_count: number;
  removed_tags_count: number;
  modified_tags_count: number;
  unchanged_tags_count: number;
  added_edges_count: number;
  removed_edges_count: number;
}

export interface RevisionDiffData {
  job_v1: string;
  job_v2: string;
  summary: RevisionDiffSummary;
  added_tags: TagDiffItem[];
  removed_tags: TagDiffItem[];
  modified_tags: TagDiffItem[];
  unchanged_tags: TagDiffItem[];
  edge_changes: EdgeDiffItem[];
  io_changes: Array<Record<string, unknown>>;
}
