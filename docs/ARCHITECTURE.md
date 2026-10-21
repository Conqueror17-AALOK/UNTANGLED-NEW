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
