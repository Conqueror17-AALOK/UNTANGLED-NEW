from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class TextItem(BaseModel):
    id: str
    text: str
    bbox: List[float] = Field(..., description="[x1, y1, x2, y2]")
    ocr_confidence: float = Field(..., ge=0.0, le=1.0)
    rotation: Literal[0, 90, 180, 270] = 0
    source: Literal["vector", "ocr"] = "vector"

class SymbolItem(BaseModel):
    model_config = {"populate_by_name": True}
    id: str
    symbol_class: Literal[
        "pump",
        "tank",
        "valve_manual",
        "valve_control",
        "instrument_bubble",
        "heat_exchanger",
        "filter",
        "compressor",
        "check_valve",
        "safety_valve"
    ] = Field(..., alias="class")
    bbox: List[float] = Field(..., description="[x1, y1, x2, y2]")
    confidence: float = Field(..., ge=0.0, le=1.0)
    ports: List[List[float]] = Field(default_factory=list, description="[[x, y], ...]")
    metadata: Dict[str, Any] = Field(default_factory=dict)

class LineSegment(BaseModel):
    id: str
    points: List[List[float]] = Field(..., min_length=2, description="[[x, y], ...]")
    line_type: Literal["process", "signal", "pneumatic", "electrical"] = "process"
    arrow_direction: Literal["forward", "backward", "none"] = "none"

class Crossing(BaseModel):
    point: List[float] = Field(..., min_length=2, max_length=2)
    is_junction: bool
    intersecting_lines: List[str] = Field(default_factory=list)

class OffPageConnector(BaseModel):
    id: str
    bbox: List[float] = Field(..., description="[x1, y1, x2, y2]")
    label: str
    target_sheet: Optional[str] = None

class PagePerception(BaseModel):
    page_number: int
    width: float
    height: float
    is_vector: bool = True
    text_items: List[TextItem] = Field(default_factory=list)
    symbols: List[SymbolItem] = Field(default_factory=list)
    line_segments: List[LineSegment] = Field(default_factory=list)
    crossings: List[Crossing] = Field(default_factory=list)
    off_page_connectors: List[OffPageConnector] = Field(default_factory=list)

class PerceptionOutput(BaseModel):
    job_id: str
    source_file: str
    total_pages: int
    pages: List[PagePerception]
