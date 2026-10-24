# UNTANGLE: Industrial P&ID Digitization, Validation, and Topological Graph Engine

An offline, privacy-preserving engineering platform that digitizes complex Piping and Instrumentation Diagrams (P&IDs), cross-validates them against Distributed Control System (DCS) I/O spreadsheets, and reconstructs verified topological process graphs.

---

## Executive Summary

Engineering drawings in industrial plants (chemical, oil and gas, power, pharmaceutical) are frequently siloed in scanned, low-resolution, or cluttered vector PDF files. Reconciling these diagrams against instrumentation databases and DCS I/O lists traditionally requires weeks of manual engineering labor.

UNTANGLE automates this workflow end-to-end using local computer vision and vision-language models. The system operates entirely on-premise with zero external cloud API dependencies, ensuring confidential engineering assets remain strictly within the local environment.

---

## Key Capabilities

1. **Local Neural Symbol Detection (YOLO11)**:
   Detects micro-symbols, instrument bubbles, control valves, relief devices, and piping transitions across 17 ISA-5.1 standard classes using a custom fine-tuned YOLO11 model accelerated by Apple Silicon Metal Performance Shaders (MPS). Inference latency is approximately 28 ms per 640x640 tile crop.

2. **Vision-Language Grounding (Florence-2 VLM)**:
   Integrates a fine-tuned Florence-2 Vision-Language Model that produces simultaneous spatial bounding box coordinates and rich technical descriptions (e.g., tagging a component as a pneumatic diaphragm flow control valve fail-close rather than merely returning a class identifier).

3. **Restoration for Degraded & Blurred Blueprints**:
   Implements an adaptive image restoration pipeline featuring Contrast-Limited Adaptive Histogram Equalization (CLAHE), Unsharp Masking, and Sauvola adaptive local binarization to recover faint line-work and low-contrast text from degraded historical blueprints.

4. **Bi-Directional Cross-Validation**:
   Cross-references drawing components against DCS I/O lists to isolate discrepancies:
   - Items in the I/O list missing from the diagram (`missing_in_drawing`).
   - Physical equipment on drawings not registered in control databases (`missing_in_io_list`).
   - Signal type mismatches (e.g., analog 4-20 mA transmitter wired to a discrete digital input channel).

5. **Topological Graph & Port Snapping**:
   Synthesizes directed process pipeline graphs (`graph.json`) by snapping line endpoints directly to cardinal symbol connection ports (inlet/outlet flanges, pump suction/discharge, actuator stems, and vessel nozzles).

6. **Automated Simplified Schematics**:
   Generates abstracted, de-cluttered single-line Process Flow Diagrams (`simplified_diagram.svg` and `simplified_diagram.pdf`) to provide operators with an immediate, readable high-level overview.

7. **Multi-Lingual Engineering Audit Reports**:
   Exports comprehensive discrepancy dossiers and Bill of Materials (BOM) in English, Hindi, and Marathi (`lang=en,hi,mr`) with downloadable JSON and printable PDF packages.

---

## Technical Architecture

```
[Raw P&ID PDF / Scanned Drawing]      [DCS I/O Spreadsheet (.xlsx / .csv)]
               │                                      │
               ▼                                      ▼
    Perception & Restoration Engine            I/O Parser & Normalizer
    - CLAHE & Unsharp Masking                  - Flexible header detection
    - PyMuPDF Vector / Rasterizer              - Tag normalization
    - Dual OCR Voting (Tesseract + Paddle)     - Signal type mapping
    - YOLO11 Symbol Localization                      │
    - Florence-2 Vision-Language Grounding            │
               │                                      │
               └──────────────────┬───────────────────┘
                                  ▼
                   Cross-Validation & Decision Engine
                   - Multi-signal confidence calculation
                   - Discrepancy matrix synthesis
                   - ISA-5.1 syntactic verification
                                  │
                                  ▼
                    Topological Process Graph Synthesis
                    - Port-constrained line snapping
                    - Flow direction & arrow propagation
                    - Multi-sheet off-page connector stitching
                                  │
                                  ▼
                    Downstream Delivery & Artifacts
                    - Interactive Canvas Workspace (React 18 + Vite)
                    - Human-in-the-Loop Review Queue
                    - Simplified PFD Vector Diagram (.svg / .pdf)
                    - Multi-Lingual Audit Dossier (.json / .pdf)
```

---

## Machine Learning Specifications

### 1. YOLO11 P&ID Symbol Detector
- **Architecture**: YOLO11n backbone fine-tuned on tiled industrial drawing crops.
- **Hardware Acceleration**: Apple Silicon MPS GPU (`device="mps"`).
- **Inference Speed**: ~28.6 ms per 640x640 tile.
- **Weights Location**: `models/yolo11_pid.pt` (5.3 MB).
- **Supported Classes (17 ISA-5.1 Categories)**:
  - Instruments: `instrument_field`, `instrument_dcs` (divided bubble), `instrument_aux`, `instrument_shared`, `instrument_logic`.
  - Valves: `valve_gate`, `valve_globe`, `valve_check`, `valve_ball`, `valve_butterfly`, `valve_control_diaphragm`, `valve_safety_psv`.
  - Piping Details: `flange`, `reducer`, `orifice_plate`.
  - Equipment: `pump_centrifugal`, `tank_vessel`.

### 2. Florence-2 Vision-Language Model
- **Architecture**: Sequence-to-Sequence Vision-Language Transformer (`microsoft/Florence-2-base`).
- **Input**: Image tile + Task Prompt (`<DENSE_REGION_CAPTION>`, `<CAPTION_TO_PHRASE_GROUNDING>`, `<OD>`).
- **Output**: Quantized spatial coordinate tokens (`<loc_Y1><loc_X1><loc_Y2><loc_X2>`) aligned with technical descriptions.
- **Model Checkpoint**: `models/florence2_finetuned/`.

---

## Project Structure

```
UNTANGLED-NEW/
├── apps/
│   └── web/                                # React 18 + TypeScript + Vite frontend
│       ├── src/
│       │   ├── components/                 # Canvas, Navbar, UI primitives
│       │   ├── pages/                      # Upload, Job, Workspace, Review, Report
│       │   └── api/                        # Typed REST client
│       └── package.json
├── contracts/
│   ├── openapi.yaml                        # OpenAPI 3.0 specification
│   ├── schemas/                            # Strict JSON Schemas (perception, graph)
│   └── samples/                            # Benchmark drawings and test I/O lists
├── models/
│   ├── yolo11_pid.pt                       # Fine-tuned YOLO11 symbol weights
│   ├── florence2/                          # Base Florence-2 model artifacts
│   └── florence2_finetuned/                # Fine-tuned Florence-2 VLM checkpoint
├── services/
│   ├── api/                                # FastAPI backend gateway
│   │   └── app/
│   │       ├── db/                         # SQLite repositories and Pydantic models
│   │       ├── engine/                     # Graph builder, simplifier, cross-validator
│   │       └── routes/                     # API endpoint controllers
│   └── perception/                         # Computer vision & neural detection engine
│       ├── perception/
│       │   ├── lines/                      # Line, crossing, and arrow detectors
│       │   ├── ocr/                        # Tesseract, PaddleOCR adapters and voting
│       │   ├── symbols/                    # Symbol matcher & contour bubble detector
│       │   ├── vlm/                        # Florence-2 model, trainer, dataset generator
│       │   ├── yolo/                       # YOLO11 trainer, detector, dataset generator
│       │   └── preprocess.py               # CLAHE, deskew, and binarization routines
│       └── tests/                          # Perception unit & integration tests
├── infra/
│   ├── Dockerfile.api                      # API service container definition
│   ├── Dockerfile.web                      # Web frontend container definition
│   ├── docker-compose.yml                  # Multi-container local orchestration
│   └── scripts/                            # Smoke test and validation utilities
└── pyproject.toml                          # Python project configuration
```

---

## Getting Started

### Prerequisites
- Python 3.11 or higher
- Node.js 20 or higher with npm
- Tesseract OCR (`brew install tesseract` on macOS, `apt-get install tesseract-ocr` on Debian/Ubuntu)

### Local Environment Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Conqueror17-AALOK/UNTANGLED-NEW.git
   cd UNTANGLED-NEW
   ```

2. **Configure Python Virtual Environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip
   pip install -r services/perception/requirements.txt
   pip install -r services/api/requirements.txt
   ```

3. **Start the FastAPI Backend Service**:
   ```bash
   python -m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   - API Gateway: `http://127.0.0.1:8000`
   - Interactive OpenAPI Documentation: `http://127.0.0.1:8000/docs`
   - Healthcheck: `http://127.0.0.1:8000/api/v1/health`

4. **Start the Frontend Application**:
   In a separate terminal:
   ```bash
   cd apps/web
   npm install
   npm run dev -- --host 127.0.0.1 --port 3000
   ```
   - Application URL: `http://127.0.0.1:3000`

---

## Containerized Deployment (Docker)

To deploy the complete application stack via Docker Compose:

```bash
docker compose -f infra/docker-compose.yml up --build
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API Health Status: `http://localhost:8000/api/v1/health`

---

## Testing & Verification

The test suite covers backend models, perception algorithms, neural detectors, schema contracts, and frontend components.

### Run All Backend Tests (35 Tests Passing)
```bash
PYTHONPATH=. .venv/bin/pytest services/
```

### Run Subsystem Tests
```bash
# Perception, YOLO11, and Florence-2 VLM tests:
PYTHONPATH=. .venv/bin/pytest services/perception/tests/

# API, Cross-Validation, and I/O Parser tests:
PYTHONPATH=. .venv/bin/pytest services/api/tests/
```

### End-to-End Pipeline Smoke Test
```bash
bash infra/scripts/smoke.sh
```
*Validates API health, uploads sample P&ID blueprints and DCS I/O lists, polls job processing, and asserts topological graph generation.*

### Frontend Production Build
```bash
npm --prefix apps/web run build
```

---

## REST API Reference

All endpoints adhere strictly to the OpenAPI specification defined in `contracts/openapi.yaml`.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/jobs` | Submit P&ID PDF and DCS I/O spreadsheet for processing. |
| `GET` | `/api/v1/jobs/{id}` | Retrieve job processing status, stage, and completion progress. |
| `GET` | `/api/v1/jobs/{id}/tags` | Fetch resolved engineering tags and confidence breakdowns. |
| `PATCH` | `/api/v1/jobs/{id}/tags/{tag_id}` | Submit human-in-the-loop tag corrections and overrides. |
| `GET` | `/api/v1/jobs/{id}/graph` | Retrieve synthesized topological process connectivity graph. |
| `GET` | `/api/v1/jobs/{id}/report` | Generate discrepancy audit report with language support (`lang=en,hi,mr`). |
| `GET` | `/api/v1/jobs/{id}/export` | Export bundled results as JSON, SVG, or printable PDF. |
| `GET` | `/api/v1/health` | Perform deep health check (database, file storage, OCR, neural models). |

---

## License

Proprietary engineering software. All rights reserved.
Developed for industrial reliability, functional safety, and asset integrity verification.
