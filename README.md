# 🔍 UNTANGLE: Intelligent P&ID Digitization & Cross-Validation Engine

> **Win on trust, not feature count.**  
> Transform messy, cluttered industrial Piping and Instrumentation Diagrams (P&IDs) and DCS IO Lists into clean, verified, operator-friendly interactive process sketches with per-tag multi-signal confidence and human-in-the-loop validation.

---

## 🌟 Key Differentiators

1. **Cross-Validation Between Drawing & IO List (Core Value):**  
   Cross-references extracted tags with engineering IO lists to detect discrepancies:
   - Tags in IO List but missing from drawing (flagged under `missing_in_drawing`).
   - Tags in drawing but missing from IO List (e.g. manual hand valves flagged under `missing_in_io_list`).
   - Signal type mismatches (e.g. `PT` mapped to digital input).
2. **Multi-Signal Confidence Scoring:**  
   Combines OCR confidence, symbol matching score, IO fuzzy match distance, ISA-5.1 grammar validity, and LLM reasoning into an interpretable score with a transparent breakdown.
3. **Three-Tier Decision Logic:**  
   - **High Confidence ($\ge 0.85$):** Auto-accepted without human intervention.
   - **Medium Confidence ($0.60 - 0.85$):** Resolved via targeted LLM few-shot candidate resolution.
   - **Low Confidence ($< 0.60$):** Dispatched to the Human Review Queue.
4. **Visual Traceability:**  
   Clicking any node on the simplified sketch jumps to the high-resolution source crop with bounding box overlay, raw OCR read, and resolution rationale.
5. **Interactive Before/After View:**  
   Side-by-side comparison with a draggable divider showing the cluttered original drawing alongside the simplified operator sketch.

---

## 🏗️ Architecture & Ownership

UNTANGLE is built as a modular monorepo with strict directory boundaries:

| Directory | Owner | Responsibility |
|---|---|---|
| `services/perception/` | **Aalok** | PyMuPDF vector/raster extraction, OpenCV preprocessing, dual OCR voting, symbol templates, line/junction detection |
| `services/api/` | **Indra** | FastAPI backend, SQLite/SQLAlchemy repository, ISA-5.1 grammar cleanup, LLM resolver, Graph builder & layout |
| `apps/web/` | **Yash** | React 18 + Vite + Tailwind CSS SPA, SVG sketch canvas with pan/zoom, live WebSocket stage tracker, Review Queue |
| `infra/` & `docs/` | **Aalok** | Dockerfiles, Docker Compose, CI/CD, Benchmarks, Runbook, Demo script |
| `contracts/` | **Shared** | OpenAPI 3.0 specification (`openapi.yaml`) and strict JSON Schemas |

---

## 🚀 Quickstart

### Prerequisites
- Python 3.11+
- Tesseract OCR (`brew install tesseract` on macOS or `apt-get install tesseract-ocr` on Linux)
- Node.js 20+ & npm

### Option A: Local Development Setup

1. **Clone & Setup Environment:**
   ```bash
   git clone <repo-url>
   cd "UNTANGLED VIT"
   cp .env.example .env
   ```

2. **Perception & API Setup:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r services/perception/requirements.txt
   ```

3. **Run Perception Pipeline on Sample P&ID:**
   ```bash
   python -m services.perception.perception.run contracts/samples/sample_pid_01.pdf data/jobs/demo_job
   ```
   *Outputs `perception.json` and visual bounding box overlay `debug_overlay_page_1.png` in `data/jobs/demo_job/`.*

4. **Run Benchmark Script:**
   ```bash
   python infra/scripts/benchmark.py
   ```

5. **Run Pytest Suite:**
   ```bash
   pytest services/perception/tests/ -v
   ```

### Option B: Docker Compose (Full Stack)

```bash
docker compose up --build
```
- Frontend Web App: `http://localhost:3000`
- FastAPI Documentation: `http://localhost:8000/docs`
- Healthcheck: `http://localhost:8000/api/v1/health`

---

## 📊 Benchmark & Ablation Results

Evaluated on the benchmark ground truth dataset (`contracts/samples/sample_pid_01.pdf` & `docs/GROUND_TRUTH.md`):

| Pipeline Stage | Tag Acc (%) | Symbol Acc (%) | Connection F1 |
|---|---|---|---|
| **1. Raw Perception (OCR / Vector)** | 60.0% | 33.3% | 71.4% |
| **2. + ISA-5.1 & Rule Cleanup** | 73.3% | 33.3% | 85.7% |
| **3. + LLM Resolver & IO Cross-val** | **100.0%** | **100.0%** | **92.8%** |

---

## 📋 Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `API_TOKEN` | *(empty)* | Optional bearer token for deployed demo authentication |
| `DATABASE_URL` | `sqlite:///./data/untangle.db` | Database URL |
| `DATA_DIR` | `./data/jobs` | Local storage directory for jobs and overlays |
| `LLM_PROVIDER` | `gemini` | LLM service provider (`gemini` or `claude`) |
| `GEMINI_API_KEY` | *(secret)* | API key for Google Gemini |
| `CONF_AUTO_THRESHOLD` | `0.85` | Score threshold for auto-acceptance |
| `CONF_REVIEW_THRESHOLD` | `0.60` | Score threshold for review queue |
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend API base URL for frontend |

---

## 🛡️ License & Acknowledgments
Built for the Hackathon 2026. Designed for chemical, power, and industrial plant reliability.
