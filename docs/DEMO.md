# UNTANGLE Live Hackathon Demo Script (3 Minutes)

## 0:00 - 0:30: The Hook & The Problem
> *"Judges, in chemical and manufacturing plants, engineers are handed massive, cluttered, 40-year-old P&ID blueprints with thousands of overlapping lines and illegible OCR text. 25 teams will show you a basic OCR-to-graph demo that breaks on real-world noise. UNTANGLE is different: we win on trust, not feature count."*

## 0:30 - 1:15: Upload & Live Pipeline Execution
1. Open UNTANGLE at `http://localhost:3000`.
2. Click **"Load Sample P&ID and IO List"**.
3. Hit **"Analyze & Untangle"**.
4. Point out the live **WebSocket 9-Stage Progress Tracker**:
   - `perception` -> `io_parse` -> `cleanup` -> `llm_resolve` -> `validate` -> `graph` -> `simplify` -> `layout` -> `report`.
   - Runs in ~4 seconds!

## 1:15 - 2:00: Visual Traceability & Multi-Signal Confidence
1. Show the interactive process sketch canvas.
2. Click on transmitter `PT-101`:
   - Point to the **Tag Inspector**: shows original OCR read `PT10l`.
   - Point to the **Original Drawing Crop**: judges can see the original scanned nozzle with bounding box overlay!
   - Point to the **Confidence Breakdown**: OCR 71%, Symbol 90%, IO Match 100%, ISA Grammar 100%. Total: 93%.

## 2:00 - 2:30: Cross-Validation Discrepancies
1. Switch to the **Validation Report**:
   - `Missing in Drawing`: `FT-310` is on the DCS IO List but physically missing from the drawing!
   - `Missing in IO List`: `HV-77` is on the drawing, but as a manual hand valve, it has no electrical IO.
   - *"This turns our tool from a toy into a real engineering audit platform."*

## 2:30 - 3:00: Human-in-the-Loop Correction & Rebuild
1. Open the **Review Queue** tab.
2. Edit tag `PT10l` -> confirm `PT-101`.
3. Hit **"Rebuild Process Sketch"**:
   - In 400ms, stages 6-9 rerun.
   - Confidence flips to 100% (Human Verified).
   - Export clean SVG and PDF report.
4. Conclude: *"Measurably accurate, transparent, and trusted by operators."*

---

## Contingency / Fallback Plan (If Live Network / LLM Fails)
- All sample data and pre-computed JSON graphs are cached in `contracts/samples/`.
- If LLM API drops, the pipeline automatically emits `LLM_UNAVAILABLE` and runs rule-based IO candidate matching without crashing.
- A pre-recorded screen recording of the full flow is stored in `docs/demo_recording.webp` as backup.
