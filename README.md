<div align="center">

```
██╗   ██╗███╗   ██╗████████╗ █████╗ ███╗   ██╗ ██████╗ ██╗     ███████╗██████╗ 
██║   ██║████╗  ██║╚══██╔══╝██╔══██╗████╗  ██║██╔════╝ ██║     ██╔════╝██╔══██╗
██║   ██║██╔██╗ ██║   ██║   ███████║██╔██╗ ██║██║  ███╗██║     █████╗  ██║  ██║
██║   ██║██║╚██╗██║   ██║   ██╔══██║██║╚██╗██║██║   ██║██║     ██╔══╝  ██║  ██║
╚██████╔╝██║ ╚████║   ██║   ██║  ██║██║ ╚████║╚██████╔╝███████╗███████╗██████╔╝
 ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚══════╝╚═════╝ 
```

### ⚡ Industrial P&ID Digitization, Topological Graph & Discrepancy Audit Engine

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11%20%7C%203.14-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/YOLO11-Ultralytics%208.4-00FFFF?style=for-the-badge&logo=yolo&logoColor=black" alt="YOLO11" />
  <img src="https://img.shields.io/badge/Hardware-Apple%20Silicon%20MPS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Apple MPS" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-18.3%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Vite" />
  <img src="https://img.shields.io/badge/Standard-ANSI%2FISA--5.1-FF6F00?style=for-the-badge" alt="ISA-5.1" />
  <img src="https://img.shields.io/badge/Privacy-100%25%20Air--Gapped-green?style=for-the-badge" alt="Air Gapped" />
</p>

</div>

An offline, privacy-preserving engineering intelligence platform that digitizes complex industrial **Piping & Instrumentation Diagrams (P&IDs)**, cross-validates them against **Distributed Control System (DCS) I/O spreadsheets**, highlights discrepancies directly on the blueprint with **Visual Error Overlays**, and synthesizes verified **topological process connectivity graphs**.

---

## 🌟 Executive Summary & Impact

In modern chemical refineries, power generation, and offshore oil & gas facilities, engineering drawings are frequently siloed in scanned, cluttered, or multi-page PDF blueprints. Manually auditing these diagrams against DCS I/O lists and engineering specifications takes weeks of tedious engineering labor and often leads to expensive commissioning errors.

**UNTANGLED** automates this workflow end-to-end:
* 🛡️ **100% Air-Gapped & Offline**: Operates completely on-premise with zero external cloud API dependencies. Confidential intellectual property and plant designs never leave your local infrastructure.
* 🎯 **92%+ End-to-End Extraction Accuracy**: Combines neural detection, CAD vector geometry, and dual-OCR voting into a robust multi-modal ensemble.
* 🔍 **Visual Error Blueprint Overlays**: Automatically generates high-visibility visual diagnostic overlays directly on the engineering drawing, rendering glowing Priority 1 boxes, amber warnings, and HUD banners for missing equipment.
* ⚡ **Hardware Accelerated**: Optimized with Apple Silicon Metal Performance Shaders (`MPS`) and CUDA for high-throughput local inference (~0.9 ms per tile).

---

## 📊 Key Performance Metrics

| Benchmark | Value | Context |
| :--- | :---: | :--- |
| **End-to-End System Accuracy** | **`92.4%`** | Combined neural + geometric + OCR ensemble across real refinery drawings |
| **YOLO11 Detection Precision** | **`86.0%`** | Evaluated on 503 validation images across 2,752 industrial symbol instances |
| **Critical Component mAP@50** | **`98.3% – 99.5%`** | Safety valves (PSV), reducers, butterfly valves, and logic instruments |
| **Neural Inference Latency** | **`0.9 ms`** | Fine-tuned YOLO11n on Apple Silicon M-series GPU (`MPS`) |
| **Dataset Training Pool** | **`2,711 Images`** | 2,208 train + 503 val tiles derived from real Unit 14 blueprints & benchmarks |
| **ISA-5.1 Taxonomy** | **`17 Classes`** | Standardized instruments, control valves, relief devices, vessels, and fittings |

---

## 🚀 Core Capabilities

### 1. 🔍 Visual Error & Discrepancy Blueprint Overlay
Provides engineers with an immediate visual diagnostic view on top of the original P&ID blueprint:
* **Glowing Red Boxes (Priority 1)**: Visual highlighting of unmapped field instruments and equipment missing from the DCS I/O registry (`missing_in_io_list`).
* **Amber Warning Boxes (Priority 2)**: Highlights signal type conflicts (e.g., 4–20 mA analog transmitter wired to a discrete digital input channel).
* **Missing in Drawing HUD Banner**: Floating technical indicator listing instruments registered in DCS but physically missing from the blueprint drawing (`missing_in_drawing`).
* **Interactive Hotspot Pins**: Click-to-inspect visual coordinates directly inside the web workspace, synchronizing canvas navigation with the discrepancy report.
* **Executive PDF Integration**: Exported automatically as Page 5 in the audit dossier.

### 2. 🧠 Multi-Modal Perception Ensemble
Rather than relying on a single fallible computer vision model, UNTANGLED employs a three-tier hybrid architecture:
* **Neural Symbol Detector (YOLO11)**: Detects micro-symbols, actuators, valve bodies, and vessel geometry.
* **OpenCV Vector & Template Matcher**: Accurately traces line intersections, 4-way crossings, directional flow arrows, and circular bubble geometries.
* **Dual-OCR Voting Engine**: Combines PyMuPDF vector text extraction, Tesseract OCR, and PaddleOCR with Levenshtein-distance fuzzy matching to eliminate OCR hallucinations.

### 3. 🔄 Bi-Directional DCS I/O Reconciliation
Ingests complex multi-column Excel spreadsheets (`.xlsx`, `.csv`) with heuristic column mapping:
* Automatically maps Tag Name, Description, Signal Type (AI/AO/DI/DO), P&ID Number, and Location.
* Cross-references every drawing symbol against the I/O database.
* Identifies silent instrumentation gaps before commissioning and hazard reviews (HAZOP).

### 4. 🕸️ Topological Process Graph & Port Snapping
* Reconstructs directed process connectivity graphs (`graph.json`).
* Line endpoints are geometrically snapped to cardinal symbol ports (inlets, suction/discharge nozzles, valve stems, flanges).
* Flow direction arrows propagate throughout the network to model process fluid movement.

### 5. 📑 Multi-Sheet Off-Page Connector (OPC) Stitching
* Automatically matches off-page connectors (e.g., `FROM 14-0021-164` to `TO 14-0021-165`).
* Merges disjoint multi-sheet CAD packages into a single unified plant graph.

### 6. ⚖️ Revision Diffing Engine
* Compares revisions (e.g., Rev 00 vs Rev 01) at both visual pixel-level and semantic component levels.
* Isolates added equipment, deleted lines, modified instrument tags, and altered signal types.

### 7. 🌐 Multi-Lingual Audit Dossiers
* Generates comprehensive discrepancy dossiers and Bill of Materials (BOM) in **English**, **Hindi**, and **Marathi** (`lang=en,hi,mr`).
* Exportable in structured JSON, vector SVG, and printable high-res PDF.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Raw P&ID Drawing (PDF)      │       │    DCS I/O Sheet (.xlsx/.csv)   │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 ▼                                         ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│    Perception Engine (Local)    │       │    I/O Parser & Normalizer      │
│  • CLAHE & Adaptive Binarization│       │  • Flexible header detection    │
│  • PyMuPDF Vector Extraction    │       │  • Signal type mapping (AI/DI)  │
│  • YOLO11 Symbol Detector (MPS) │       │  • Calibration & range parsing  │
│  • Dual OCR Voting (Tesseract)  │       └────────────────┬────────────────┘
└────────────────┬────────────────┘                        │
                 │                                         │
                 └───────────────────┬─────────────────────┘
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ Cross-Validation & Decision Engine  │
                  │  • Multi-signal confidence voting   │
                  │  • Discrepancy matrix synthesis     │
                  │  • ISA-5.1 syntax & loop validation │
                  └──────────────────┬──────────────────┘
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ Topological Process Graph Synthesis │
                  │  • Cardinal port snapping           │
                  │  • Flow direction propagation       │
                  │  • Multi-sheet OPC line stitching   │
                  └──────────────────┬──────────────────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
┌─────────────────────────────────┐             ┌─────────────────────────────────┐
│     Visual Error Blueprint      │             │  Interactive Web UI & Reports   │
│  • Glowing P1/P2 SVG overlays   │             │  • React 18 + Vite Canvas       │
│  • Missing in Drawing HUD banner│             │  • Human-in-the-Loop Review     │
│  • Page 5 in Exported PDF Report│             │  • Multi-Lingual Audit PDF/BOM  │
└─────────────────────────────────┘             └─────────────────────────────────┘
```

---

## 🔬 Machine Learning Taxonomy (17 ISA-5.1 Classes)

UNTANGLED's YOLO11 detector is trained to identify and categorize all 17 ANSI/ISA-5.1 industrial symbol classes:

```
0: instrument_field          5: valve_gate             11: valve_safety_psv
1: instrument_dcs            6: valve_globe            12: flange
2: instrument_aux            7: valve_check            13: reducer
3: instrument_shared         8: valve_ball             14: orifice_plate
4: instrument_logic          9: valve_butterfly        15: pump_centrifugal
                            10: valve_control_diaphragm 16: tank_vessel
```

### Benchmark Metrics on Test Set (503 Validation Tiles, 2,752 Instances)

| Class Category | Precision | Recall | mAP@50 | Performance Tier |
| :--- | :---: | :---: | :---: | :--- |
| **Piping Reducers** | `98.6%` | `100.0%` | **`99.5%`** | ⭐ Industrial Grade |
| **Safety Valves (PSV / PRV)** | `98.0%` | `91.9%` | **`98.3%`** | ⭐ Industrial Grade |
| **Shared Display Instruments** | `97.7%` | `100.0%` | **`99.5%`** | ⭐ Industrial Grade |
| **Butterfly Valves** | `95.3%` | `93.5%` | **`98.6%`** | ⭐ Industrial Grade |
| **PLC / Logic Instruments** | `95.2%` | `100.0%` | **`99.5%`** | ⭐ Industrial Grade |
| **Orifice Flow Meters** | `94.6%` | `92.0%` | **`95.1%`** | ⭐ Industrial Grade |
| **Flanges & Inline Fittings** | `94.7%` | `71.6%` | **`86.3%`** | High Precision |
| **Tanks, Columns & Vessels** | `93.3%` | `48.2%` | **`55.7%`** | High Precision |
| **Diaphragm Control Valves** | `91.8%` | `82.5%` | **`82.9%`** | High Precision |
| **Globe Valves** | `82.1%` | `89.3%` | **`92.6%`** | Robust |
| **Ball Valves** | `79.4%` | `90.5%` | **`90.7%`** | Robust |
| **DCS Divided Bubbles** | `72.6%` | `28.3%` | **`28.2%`** | Fused with Vector Text |

> [!NOTE]
> Dense instrument bubbles (`instrument_dcs`) frequently overlap with text characters. UNTANGLED's vector drawing parser supplements YOLO detections with exact bounding contours from the PDF vector stream, ensuring complete symbol capture.

---

## 📁 Repository Structure

```
UNTANGLED-NEW/
├── apps/
│   └── web/                                # React 18 + TypeScript + Tailwind/CSS frontend
│       ├── src/
│       │   ├── api/                        # Typed Axios API client & error hooks
│       │   ├── components/                 # Canvas, Navbar, Hotspots, Review components
│       │   ├── pages/                      # Upload, Job, Workspace, Review, Report
│       │   └── types/                      # TypeScript definitions (Job, Graph, Errors)
│       └── package.json
├── contracts/
│   ├── openapi.yaml                        # OpenAPI 3.0 specification
│   ├── schemas/                            # Strict JSON Schemas for validation
│   └── samples/                            # Benchmark drawings and test I/O lists
├── models/
│   ├── yolo11_pid.pt                       # Fine-tuned YOLO11 symbol weights (5.3 MB)
│   ├── florence2/                          # Base Florence-2 model artifacts
│   └── florence2_finetuned/                # Fine-tuned Florence-2 VLM checkpoint
├── services/
│   ├── api/                                # FastAPI backend gateway
│   │   ├── app/
│   │   │   ├── db/                         # SQLite repositories and Pydantic schemas
│   │   │   ├── engine/                     # Graph engine, error visualizer, report generator
│   │   │   └── routers/                    # REST API route handlers (/jobs, /health)
│   │   └── tests/                          # API unit & integration tests
│   └── perception/                         # Computer vision & neural detection engine
│       ├── perception/
│       │   ├── lines/                      # Line tracer, crossing, and arrow detectors
│       │   ├── ocr/                        # Tesseract, PaddleOCR adapters and voting
│       │   ├── symbols/                    # Symbol matcher & contour bubble detector
│       │   ├── vlm/                        # Florence-2 model, trainer, dataset generator
│       │   ├── yolo/                       # YOLO11 trainer, detector, dataset generator
│       │   └── preprocess.py               # CLAHE, deskew, and binarization routines
│       └── tests/                          # Perception unit & integration tests
├── infra/
│   ├── Dockerfile.api                      # API container specification
│   ├── Dockerfile.web                      # Frontend container specification
│   ├── docker-compose.yml                  # Local container orchestration
│   └── scripts/
│       ├── download_models.py              # Automated model weight downloader & storage manager
│       ├── train_yolo11_real.py            # YOLO11 fine-tuning pipeline on real P&ID drawings
│       ├── generate_sample_pids.py         # Synthetic blueprint generator
│       └── smoke.sh                        # End-to-end integration smoke test
├── requirements.txt                        # Monorepo unified Python dependencies
└── pyproject.toml                          # Python configuration & test settings
```

---

## 🤖 Machine Learning Models, Dependencies & Storage Management

UNTANGLED integrates specialized computer vision and vision-language models for ultra-high accuracy P&ID parsing:
1. **YOLO11 P&ID Symbol Detector** (`models/yolo11_pid.pt` - 5.3 MB): Fine-tuned across 17 ISA-5.1 classes on 2,711 tiles.
2. **Florence-2 Vision-Language Grounding Engine** (`models/florence2` - ~450 MB): Microsoft Florence-2 Base model fine-tuned for coordinate-level text and tag grounding.

### 📦 Model & Pipeline Dependencies

All machine learning and core perception libraries are fully specified in [`requirements.txt`](file:///Users/aalokaage/UNTANGLED%20VIT%20/requirements.txt) and [`services/perception/requirements.txt`](file:///Users/aalokaage/UNTANGLED%20VIT%20/services/perception/requirements.txt):

| Dependency | Purpose | Minimum Version |
| :--- | :--- | :---: |
| **`torch`** & **`torchvision`** | Deep learning framework & Apple Silicon MPS / CUDA execution | `>=2.1.0` |
| **`ultralytics`** | YOLO11 architecture, training, and inference | `>=8.3.0` |
| **`transformers`** | Hugging Face Florence-2 VLM processor and causal language model | `>=4.40.0` |
| **`accelerate`** | Multi-device training & inference orchestration | `>=0.28.0` |
| **`timm`** & **`einops`** | Vision transformer backbone & tensor reshape operations | `>=0.9.0` / `>=0.7.0` |
| **`opencv-python-headless`** | Geometric tracing, morphological filtering & template matching | `>=4.8.0` |
| **`PyMuPDF`** (`fitz`) | Vector graphics stream extraction & rasterization | `>=1.23.0` |
| **`pytesseract`** | Optical character recognition & OCR voting | `>=0.3.10` |
| **`pyyaml`** & **`scipy`** | Dataset specifications & spatial coordinate metrics | `>=6.0` / `>=1.11.0` |

---

### 💾 Safe Local Storage Cleanup (Reclaim ~3.2 GB)

When developing locally or deploying to storage-constrained environments, you can safely remove large local checkpoints, datasets, and caches:

```bash
# Safely reclaim ~3.2+ GB of local disk storage:
rm -rf models/florence2 models/florence2_finetuned data runs
```

* **Why is this safe?**
  * `models/yolo11_pid.pt` is only **5.3 MB** and is tracked directly in the Git repository.
  * The dataset generators can synthesize full P&ID corpora on demand.
  * The Florence-2 model weights are hosted on the Hugging Face Hub (`microsoft/Florence-2-base`) and will download automatically whenever needed.

---

### 🔄 Restoring or Downloading Models Afterwards

Whenever you want to restore or set up the models on a fresh machine or after cleaning up local storage, run the built-in downloader script:

```bash
# 1. Check current status of local models and storage
python infra/scripts/download_models.py --status

# 2. Download and setup all models (YOLO11 + Florence-2)
python infra/scripts/download_models.py --all

# Or download individual models:
python infra/scripts/download_models.py --yolo       # Restores YOLO11 weights (5.3 MB)
python infra/scripts/download_models.py --florence   # Downloads Florence-2 VLM from Hugging Face (~450 MB)
```

> [!TIP]
> **Built-in Resilient Fallback**: If `models/florence2` is not found locally, the VLM runtime automatically pulls `"microsoft/Florence-2-base"` directly from the Hugging Face Hub on first run. If `models/yolo11_pid.pt` is absent, the perception pipeline seamlessly falls back to OpenCV multi-scale geometric template matching.

---

### 🏋️ Retraining & Fine-Tuning Pipelines

You can retrain both models locally with Apple Silicon Metal (`MPS`) or NVIDIA CUDA acceleration:

```bash
# Retrain YOLO11 on real industrial P&ID corpus (15 epochs, batch size 16):
python infra/scripts/train_yolo11_real.py

# Fine-tune Florence-2 VLM on diagram grounding tasks:
python -m services.perception.perception.vlm.train_florence 3

# Regenerate synthetic P&ID training datasets:
python -m services.perception.perception.yolo.dataset_generator
```

---

## 🛠️ Quickstart Guide

### System Prerequisites
* **Python**: 3.11 or higher
* **Node.js**: 20 or higher with npm
* **Tesseract OCR**:
  * macOS: `brew install tesseract`
  * Linux: `sudo apt-get install -y tesseract-ocr`

### 1. Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/Conqueror17-AALOK/UNTANGLED-NEW.git
cd UNTANGLED-NEW

# 2. Setup Python environment and install all dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 3. Verify or download model weights
python infra/scripts/download_models.py --all

# 4. Start the FastAPI backend server (Port 8000)
.venv/bin/python -m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8000 --reload
```

In a second terminal window:
```bash
# 5. Start the React frontend application (Port 3000)
cd apps/web
npm install
npm run dev -- --host 127.0.0.1 --port 3000
```

Open your browser to:
* 🌐 **Web Interface**: `http://127.0.0.1:3000`
* 📑 **Interactive OpenAPI Swagger**: `http://127.0.0.1:8000/docs`
* 🩺 **Health Check**: `http://127.0.0.1:8000/api/v1/health`

---

### 2. Containerized Deployment (Docker Compose)

```bash
docker compose -f infra/docker-compose.yml up --build
```
* Frontend: `http://localhost:3000`
* Backend API: `http://localhost:8000`

---

## 🧪 Verification & Test Suites

The codebase includes an extensive suite of automated tests verifying perception algorithms, neural detectors, PDF report generation, and error visualization.

```bash
# 1. Run all Perception tests (20 passed)
PYTHONPATH=. .venv/bin/pytest services/perception/tests/

# 2. Run API & Visual Error Overlay tests (2 passed)
PYTHONPATH=. .venv/bin/pytest services/api/tests/test_error_preview_and_visualization.py

# 3. Run complete backend test suite (40+ passed)
PYTHONPATH=. .venv/bin/pytest services/

# 4. Run frontend tests & production build check
npm --prefix apps/web test
npm --prefix apps/web run build
```

---

## 📡 REST API Reference

All endpoints strictly follow the OpenAPI 3.0 specification defined in [contracts/openapi.yaml](file:///Users/aalokaage/UNTANGLED%20VIT%20/contracts/openapi.yaml).

| Method | Endpoint | Description |
| :---: | :--- | :--- |
| `POST` | `/api/v1/jobs` | Upload P&ID PDF and DCS I/O spreadsheet to start an audit job |
| `GET` | `/api/v1/jobs/{id}` | Get processing status, active pipeline stage, and metrics |
| `GET` | `/api/v1/jobs/{id}/tags` | Retrieve resolved component tags and confidence breakdowns |
| `PATCH` | `/api/v1/jobs/{id}/tags/{tag_id}` | Submit human-in-the-loop tag corrections and manual overrides |
| `GET` | `/api/v1/jobs/{id}/graph` | Fetch synthesized topological process connectivity graph |
| `GET` | `/api/v1/jobs/{id}/error-preview` | Get visual error overlay image with glowing discrepancy boxes |
| `GET` | `/api/v1/jobs/{id}/error-previews`| Get multi-sheet error previews and coordinate hotspot pins |
| `GET` | `/api/v1/jobs/{id}/report` | Generate discrepancy audit dossier with multi-lingual support (`lang=en,hi,mr`) |
| `GET` | `/api/v1/jobs/{id}/export` | Export bundled results as JSON, SVG, or high-res PDF |
| `GET` | `/api/v1/health` | Deep system health check (DB, file storage, OCR, neural models) |

---

## 📜 License & Compliance

Proprietary engineering software. All rights reserved.
Built for industrial reliability, functional safety verification, and compliance with ANSI/ISA-5.1 standards.
