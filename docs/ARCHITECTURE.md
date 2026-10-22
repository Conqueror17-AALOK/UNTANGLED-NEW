# UNTANGLE System Architecture

## 1. System Overview
```
+--------------------------------------------------------------------------+
|                        Browser (React 18 + TypeScript)                   |
|   UploadPage -> JobPage (WebSocket Tracker) -> Workspace (Canvas & Crop) |
|   ReviewQueue (Human Edits) -> ReportPage (Discrepancy Tables & Export)  |
+--------------------------------------------------------------------------+
                                  |       ^
            REST API (/api/v1)    |       | WebSocket (/ws/v1/jobs/{id})
                                  v       |
+--------------------------------------------------------------------------+
|                           FastAPI Gateway Layer                          |
|        Routers -> Services -> JobRunner (BackgroundTasks) + EventBus     |
+--------------------------------------------------------------------------+
          |                                                 |
          v                                                 v
+-----------------------------+       +------------------------------------+
|     PERCEPTION SERVICE      |       |      SEMANTIC & GRAPH ENGINE       |
|                             |       |                                    |
| 1. PDF Vector/Scanned Detect|       | 1. IO List Parser (openpyxl)       |
| 2. PyMuPDF Digital Extract  |       | 2. ISA-5.1 Grammar Cleanup         |
| 3. Adaptive Preprocessing   |       | 3. LLM Candidate Resolver (Gemini) |
| 4. Dual OCR (Tess + Paddle) |       | 4. Multi-Signal Confidence Fusion  |
| 5. Multi-Scale OpenCV Match |       | 5. Cross-Validation against IO     |
| 6. Bubble Contour Classifier|       | 6. Spatial Graph Snapping          |
| 7. Line & Crossing Detect   |       | 7. Simplifier & Collapse Rules     |
| 8. Off-Page Connectors      |       | 8. Layered SVG Layout Engine       |
+-----------------------------+       +------------------------------------+
          |                                                 |
          +--------------> data/jobs/<id>/ <----------------+
                             perception.json
                             graph.json
                             sketch.svg
                             report.json
```

## 2. Multi-Signal Confidence Formula
For each extracted tag, the final confidence $C_{\text{final}} \in [0.0, 1.0]$ is computed as:
$$C_{\text{final}} = w_{\text{ocr}} C_{\text{ocr}} + w_{\text{sym}} C_{\text{sym}} + w_{\text{io}} S_{\text{io}} + w_{\text{isa}} S_{\text{isa}} + w_{\text{llm}} C_{\text{llm}}$$
Where:
- $w_{\text{ocr}} = 0.20$: Optical character recognition quality score
- $w_{\text{sym}} = 0.20$: Symbol classification and port alignment score
- $w_{\text{io}} = 0.30$: RapidFuzz token sort match against the engineering IO List
- $w_{\text{isa}} = 0.15$: Standard ISA-5.1 naming convention validity
- $w_{\text{llm}} = 0.15$: LLM contextual reasoning certainty

## 3. Human-in-the-Loop Feedback Loop
When an operator modifies an ambiguous tag (e.g. `PT10l` to `PT-101`) in the Review Queue:
1. `PATCH /api/v1/jobs/{id}/tags/{tag_id}` updates the database row, assigns `confidence = 1.0`, `source = "human"`.
2. The change is recorded in the `corrections` audit log.
3. Client triggers `POST /api/v1/jobs/{id}/rebuild`, which reruns stages 6 through 9 (Graph builder, simplifier, layout, report) in under 1 second without recomputing OCR!

## 4. Backend Service Implementation (`services/api/app/`)
The semantic and graph engine is implemented as a modular FastAPI service:

| Module | Location | Purpose |
|---|---|---|
| `main.py` | `services/api/app/main.py` | FastAPI gateway, lifespan DB init, CORS, OpenAPI ErrorEnvelope handler |
| `config.py` | `services/api/app/config.py` | BaseSettings for thresholds, confidence weights, LLM keys, and DATA_DIR |
| `security.py` | `services/api/app/core/security.py` | Constant-time bearer token check, upload sandboxing & path traversal checks |
| `logging.py` | `services/api/app/core/logging.py` | JSON structured logger with request_id, job_id, stage, and latency metrics |
| `events.py` | `services/api/app/core/events.py` | In-memory pub/sub WebSocket EventBus for live 9-stage progress streaming |
| `models.py` | `services/api/app/db/models.py` | SQLAlchemy models: `JobModel`, `TagModel`, `CorrectionModel` with UTC timestamps |
| `schemas.py` | `services/api/app/db/schemas.py` | Strict Pydantic models matching `contracts/openapi.yaml` |
| `io_parser.py` | `services/api/app/engine/io_parser.py` | Openpyxl Excel parser with fuzzy column discovering |
| `isa51_rules.py` | `services/api/app/engine/isa51_rules.py` | ISA-5.1 naming convention validator and equipment/valve taxonomies |
| `cleanup.py` | `services/api/app/engine/cleanup.py` | OCR character-confusion resolver and spatial stacked bubble word-merging |
| `confidence.py` | `services/api/app/engine/confidence.py` | 5-signal weighted formula implementation and 3-tier decision categorization |
| `llm_resolver.py` | `services/api/app/engine/llm_resolver.py` | Gemini 1.5 Flash client with deterministic candidate matching fallback |
| `cross_validator.py` | `services/api/app/engine/cross_validator.py` | Detects `missing_in_drawing`, `missing_in_io_list`, and signal type mismatches |
| `graph_builder.py` | `services/api/app/engine/graph_builder.py` | Spatial line-to-port snapping and topological node linking |
| `simplifier.py` | `services/api/app/engine/simplifier.py` | Aligns process stream horizontally (left-to-right) with attached instrument branches |
| `svg_generator.py` | `services/api/app/engine/svg_generator.py` | Layered interactive SVG generator with confidence badges and data attributes |
| `report_generator.py` | `services/api/app/engine/report_generator.py` | Multi-language localization (English, Hindi, Marathi) for plant floor operators |
| `pipeline.py` | `services/api/app/engine/pipeline.py` | 9-stage orchestrator and sub-second rebuild runner |

