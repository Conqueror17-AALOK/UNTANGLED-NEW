# 🔍 UNTANGLE: Intelligent P&ID Digitization & Cross-Validation Engine

> **Win on trust, not feature count.**  
> Transform messy, cluttered industrial Piping and Instrumentation Diagrams (P&IDs) and DCS IO Lists into clean, verified, operator-friendly interactive process sketches with per-tag multi-signal confidence, NVIDIA NIM LLM reasoning, and human-in-the-loop validation.

---

## 🌟 Key Differentiators

1. **Cross-Validation Between Drawing & IO List (Core Value):**  
   Cross-references extracted tags with engineering DCS IO lists to detect discrepancies:
   - Tags in IO List but missing from drawing (`missing_in_drawing`).
   - Tags in drawing but missing from IO List (e.g. manual hand valves flagged under `missing_in_io_list`).
   - Signal type mismatches (e.g. `PT` mapped to digital input instead of analog 4-20mA).
2. **NVIDIA NIM LLM Tag Resolution (GLM 5.3 Flash & DeepSeek V4.1 Flash):**  
   High-throughput contextual resolution powered by **NVIDIA NIM**:
   - **Fast Model:** `z-ai/glm-5.3-flash` for sub-second tag candidate clarification with step-by-step reasoning extraction.
   - **Strong Model:** `deepseek-ai/deepseek-v4.1-flash` for complex ambiguous cases.
   - **Resilient Fallback:** 8-second non-blocking timeout with automatic graceful fallback to deterministic rule normalization and fuzzy IO list matching.
3. **Multi-Signal Confidence Scoring:**  
   Combines OCR confidence ($w=0.20$), symbol matching ($w=0.20$), IO fuzzy match ($w=0.30$), ISA-5.1 grammar validity ($w=0.15$), and LLM reasoning ($w=0.15$) into an interpretable score ($0.0 - 1.0$) with transparent breakdown.
4. **Three-Tier Decision Logic:**  
   - **High Confidence ($\ge 0.85$):** Auto-accepted without human intervention.
   - **Medium Confidence ($0.60 - 0.85$):** Resolved via targeted NVIDIA LLM candidate resolution.
   - **Low Confidence ($< 0.60$):** Dispatched to the Human Review Queue.
5. **Authentic ISA-5.1 Industrial CAD Symbols:**  
   Interactive vector graphics conforming strictly to ANSI/ISA-5.1 standards:
   - Centrifugal pumps with tangential discharge nozzles, control valves with dome diaphragms, manual valves with handwheels, and divided instrument bubbles with confidence halo rings.
6. **Visual Traceability & Draggable Before/After:**  
   Clicking any node on the simplified sketch jumps to the high-resolution source crop with bounding box overlay, raw OCR read, and resolution rationale. Draggable comparison slider compares original drawing with untangled schematic.
7. **Multilingual Audit Reports (English, Hindi, Marathi):**  
   Instant translation of audit summaries, discrepancy matrices, and tag inventories for regional plant technicians and field operators (`lang=en,hi,mr`).

---

## 🏗️ Architecture & Monorepo Ownership

UNTANGLE is built as a modular monorepo with strict directory boundaries:

| Directory | Owner | Responsibility | Status |
|---|---|---|---|
| `services/perception/` | **Aalok** | PyMuPDF vector/raster extraction, OpenCV preprocessing, dual OCR voting, symbol templates, line/crossing detection | **Complete** ✅ |
| `services/api/` | **Indra** | FastAPI backend, SQLite repository, ISA-5.1 grammar cleanup, NVIDIA NIM LLM candidate resolver, Cross-validation engine, Graph builder & SVG layout | **Complete** ✅ |
| `apps/web/` | **Yash** | Industrial CAD-styled React 18 + Vite SPA, SVG sketch canvas with pan/zoom, live WebSocket 9-stage tracker, Review Queue, Multilingual reports | **Complete** ✅ |
| `infra/` & `docs/` | **Aalok** | Dockerfiles, Docker Compose, CI/CD, Benchmarks, Runbook, Demo script | **Complete** ✅ |
| `contracts/` | **Shared** | OpenAPI 3.0 specification (`openapi.yaml`) and strict JSON Schemas | **Complete** ✅ |

---

## 🔄 The 9-Stage Processing Pipeline

```
  [PDF Drawing] + [DCS IO List]
              │
              ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. Perception & Dual OCR Voting (PyMuPDF + Tess / Vector)    │
  │ 2. IO List Parsing (openpyxl fuzzy header detection)         │
  │ 3. Rule Cleanup (ISA-5.1 grammar & character confusion)     │
  │ 4. LLM Resolver (NVIDIA GLM 5.3 Flash & DeepSeek V4.1)      │
  │ 5. Cross-Validation (Drawing vs IO List discrepancy matrix)  │
  │ 6. Spatial Graph Assembly (Line-to-port topological snapping)│
  │ 7. Graph Simplification (Stream alignment & valve collapse) │
  │ 8. Layered SVG Layout Engine (Deterministic CAD synthesis)  │
  │ 9. Multilingual Engineering Report (EN / HI / MR + PDF)     │
  └─────────────────────────────────────────────────────────────┘
              │
              ▼
  [Interactive Simplified Process Sketch & Audit Dossier]
```

---

## 🚀 Quickstart

### Prerequisites
- Python 3.11+ (Python 3.12 recommended)
- Tesseract OCR (`brew install tesseract` on macOS or `apt-get install tesseract-ocr` on Linux)
- Node.js 20+ & npm

---

### Option A: Local Development Setup

#### 1. Clone & Setup Environment
```bash
git clone https://github.com/Conqueror17-AALOK/UNTANGLED-NEW.git
cd UNTANGLED-NEW
cp .env.example .env
```

#### 2. Backend Setup (Perception & API)
```bash
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows PowerShell:
# .\.venv\Scripts\Activate.ps1

pip install -r services/perception/requirements.txt
pip install -r services/api/requirements.txt
```

#### 3. Start FastAPI Backend Gateway
```bash
python -m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8000 --reload
```
- OpenAPI Swagger UI: `http://localhost:8000/docs`
- Deep Healthcheck: `http://localhost:8000/api/v1/health`
- Live WebSocket: `ws://localhost:8000/ws/v1/jobs/{job_id}`

#### 4. Frontend Setup & Launch
In a new terminal:
```bash
cd apps/web
npm install
npm run dev
```
- Web Application: `http://localhost:3000`

#### 5. One-Click Instant Demo
Click **"Load Benchmark P&ID"** on the home page or trigger via API:
```bash
curl -X POST http://127.0.0.1:8000/api/v1/jobs/load-sample
```

---

### Option B: Docker Compose (Full Stack)

Run the entire containerized stack with a single command:
```bash
docker compose up --build
```
- Frontend Web App: `http://localhost:3000`
- FastAPI Documentation: `http://localhost:8000/docs`
- Healthcheck: `http://localhost:8000/api/v1/health`

---

## 🧪 Testing & Verification

UNTANGLE maintains complete test coverage across backend algorithms and frontend components:

### 1. Backend Pytest Suite (31 Tests Passing - 100%)
```bash
# Run all backend tests:
pytest -v

# Or run by subsystem:
pytest services/api/tests -v          # 15 tests: Endpoints, LLM resolver, Confidence, IO Parser, Cleanup
pytest services/perception/tests -v   # 16 tests: Lines, OCR, Symbols, Bubbles, Tiling, End-to-End
```

### 2. Frontend Vitest & TypeScript Build
```bash
cd apps/web
npm test -- --run     # 3/3 unit tests passing
npm run build         # Type checking & production bundle synthesis
```

### 3. Perception CLI Diagnostic Check
```bash
python -m services.perception.perception.run contracts/samples/sample_pid_01.pdf data/jobs/demo_job
```
*Outputs `perception.json` and visual bounding box overlay `debug_overlay_page_1.png` in `data/jobs/demo_job/`.*

### 4. Benchmark & Ablation Script
```bash
python infra/scripts/benchmark.py
```

---

## 🔌 API Endpoints Reference

All endpoints conform strictly to [`contracts/openapi.yaml`](contracts/openapi.yaml):

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/jobs` | Upload P&ID PDF and IO List XLSX, start 9-stage pipeline |
| `POST` | `/api/v1/jobs/load-sample` | Pre-load benchmark sample P&ID & IO list for instant demo |
| `GET` | `/api/v1/jobs/{id}` | Real-time status, pipeline stage (1–9), and progress metrics |
| `GET` | `/api/v1/jobs/{id}/tags` | Extracted and resolved tags with 5-signal confidence breakdown |
| `PATCH` | `/api/v1/jobs/{id}/tags/{tag_id}` | Human tag correction (updates to 100% confidence, logs audit trail) |
| `POST` | `/api/v1/jobs/{id}/rebuild` | Sub-second (<400ms) re-simplification of stages 6–9 after human edits |
| `GET` | `/api/v1/jobs/{id}/graph` | Simplified topological process graph JSON |
| `GET` | `/api/v1/jobs/{id}/sketch` | Interactive SVG process sketch with confidence badges |
| `GET` | `/api/v1/jobs/{id}/source/{page}/crop` | High-res source crop with cyan bounding box overlay |
| `GET` | `/api/v1/jobs/{id}/report` | Cross-validation discrepancy audit report (supports `lang=en,hi,mr`) |
| `GET` | `/api/v1/jobs/{id}/export` | Export bundled results as JSON, SVG, or printable HTML/PDF |
| `GET` | `/api/v1/health` | Deep system health check (DB, Storage, OCR, NVIDIA NIM LLM) |
| `WS` | `/ws/v1/jobs/{id}` | Live WebSocket stage & progress stream |

---

## 📊 Benchmark & Ablation Results

Evaluated on the benchmark ground truth dataset (`contracts/samples/sample_pid_01.pdf` & `docs/GROUND_TRUTH.md`):

| Pipeline Stage | Tag Acc (%) | Symbol Acc (%) | Connection F1 |
|---|---|---|---|
| **1. Raw Perception (OCR / Vector)** | 60.0% | 33.3% | 71.4% |
| **2. + ISA-5.1 & Rule Cleanup** | 73.3% | 33.3% | 85.7% |
| **3. + NVIDIA NIM LLM & IO Cross-val** | **100.0%** | **100.0%** | **92.8%** |

---

## 📋 Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `API_TOKEN` | *(empty)* | Optional bearer token for deployed demo authentication |
| `DATABASE_URL` | `sqlite:///./data/untangle.db` | SQLite database connection string |
| `DATA_DIR` | `./data/jobs` | Local storage directory for jobs, crops, and SVG overlays |
| `LLM_PROVIDER` | `nvidia` | Active LLM service provider (`nvidia`, `gemini`, or `heuristic`) |
| `NVIDIA_API_KEY_GLM` | *(secret)* | API key for NVIDIA NIM GLM 5.3 Flash (Fast LLM model) |
| `NVIDIA_API_KEY_DEEPSEEK` | *(secret)* | API key for NVIDIA NIM DeepSeek V4.1 Flash (Strong LLM model) |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | Base URL for NVIDIA OpenAI-compatible inference endpoint |
| `LLM_MODEL_FAST` | `z-ai/glm-5.3-flash` | Fast model for high-throughput tag candidate resolution |
| `LLM_MODEL_STRONG` | `deepseek-ai/deepseek-v4.1-flash` | Strong reasoning model for complex ambiguity fallback |
| `CONF_AUTO_THRESHOLD` | `0.85` | Score threshold for auto-acceptance |
| `CONF_REVIEW_THRESHOLD` | `0.60` | Score threshold for review queue |
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend API base URL for frontend |

---

## 🛡️ License & Acknowledgments
Built for Hackathon 2026. Designed for chemical, power, and industrial plant process safety and reliability.
- **Team**: Aalok (Perception & Infra), Indra (API & Engine), Yash (Frontend Web App).
