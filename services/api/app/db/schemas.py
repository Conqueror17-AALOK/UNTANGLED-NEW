from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ConfBreakdown(BaseModel):
    ocr: float = 1.0
    symbol: float = 1.0
    io_match: float = 1.0
    grammar: float = 1.0
    llm: float = 1.0


class IoMatch(BaseModel):
    matched: bool = False
    io_tag: Optional[str] = None
    score: Optional[float] = None


class TagSchema(BaseModel):
    id: str
    page: int
    raw_text: str
    normalized_tag: str
    type: str
    category: str
    bbox: List[float] = Field(..., min_length=4, max_length=4)
    confidence: float
    conf_breakdown: ConfBreakdown
    status: Literal["resolved", "needs_review", "rejected"]
    io_match: IoMatch
    reasoning: Optional[str] = ""
    source: Optional[str] = "auto"

    class Config:
        from_attributes = True


class TagUpdateSchema(BaseModel):
    normalized_tag: str = Field(..., pattern=r"^[A-Z0-9-_\s]+$")
    type: Optional[str] = None


class JobSummarySchema(BaseModel):
    resolved: int = 0
    needs_review: int = 0
    rejected: int = 0


class JobResponseSchema(BaseModel):
    job_id: str
    status: Literal["queued", "running", "done", "failed"]
    stage: Literal["perception", "io_parse", "cleanup", "llm_resolve", "validate", "graph", "simplify", "layout", "report"]
    progress: float = Field(..., ge=0.0, le=1.0)
    pages: int = 1
    summary: JobSummarySchema = Field(default_factory=JobSummarySchema)
    error: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class GraphNode(BaseModel):
    id: str
    type: str
    category: str
    x: float
    y: float
    confidence: float
    tag_id: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    line_type: str = "process"
    directed: bool = True


class GraphWarning(BaseModel):
    node: str
    code: str
    message: str


class GraphSchema(BaseModel):
    version: int = 1
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    warnings: List[GraphWarning] = Field(default_factory=list)


class ReportSummary(BaseModel):
    tags_total: int
    resolved: int
    needs_review: int
    rejected: int
    auto_pct: float
    llm_pct: float
    human_pct: float
    average_confidence: float = 0.0
    high_confidence_count: int = 0
    medium_confidence_count: int = 0
    low_confidence_count: int = 0
    confidence_breakdown_avg: Dict[str, float] = Field(default_factory=dict)


class MissingInDrawingItem(BaseModel):
    io_tag: str
    description: Optional[str] = None


class MissingInIoListItem(BaseModel):
    tag: str
    tag_id: str


class TypeMismatchItem(BaseModel):
    tag: str
    drawing_type: str
    io_signal: str


class ReportSchema(BaseModel):
    summary: ReportSummary
    missing_in_drawing: List[MissingInDrawingItem] = Field(default_factory=list)
    missing_in_io_list: List[MissingInIoListItem] = Field(default_factory=list)
    type_mismatches: List[TypeMismatchItem] = Field(default_factory=list)
    graph_warnings: List[Dict[str, Any]] = Field(default_factory=list)
    connection_validation: Optional[Dict[str, Any]] = None
    io_verification: Optional[Dict[str, Any]] = None


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[List[Dict[str, Any]]] = None
    request_id: Optional[str] = None


class ErrorEnvelope(BaseModel):
    error: ErrorDetail
