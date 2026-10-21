# UNTANGLE Benchmark Ground Truth Specification

## 1. Overview
This benchmark ground truth dataset serves as the evaluation reference for measuring perception, tag resolution, and connectivity graph accuracy across the UNTANGLE pipeline.

- **Primary Reference Drawing**: `contracts/samples/sample_pid_01.pdf`
- **Associated IO List**: `contracts/samples/sample_io_list.xlsx`
- **Resolution**: 1920 x 1080 (rendered at 300 DPI for raster verification)
- **Evaluation Criteria**: Tag recognition precision/recall, Symbol classification accuracy, Connection edge F1 score.

---

## 2. Ground Truth Entities

### 2.1 Major Equipment
| ID | Tag | Type | Bounding Box [x1, y1, x2, y2] | Category | Connection Ports [x, y] |
|---|---|---|---|---|---|
| eq_01 | `TK-101` | Storage Tank | [160, 220, 340, 540] | equipment | [[250, 220], [340, 490]] |
| eq_02 | `P-101A` | Centrifugal Pump | [570, 460, 650, 540] | equipment | [[570, 500], [650, 500]] |
| eq_03 | `P-101B` | Centrifugal Pump | [570, 620, 650, 700] | equipment | [[570, 660], [650, 660]] |
| eq_04 | `E-101` | Shell & Tube Heat Exchanger | [780, 450, 880, 550] | equipment | [[780, 500], [880, 500], [830, 450], [830, 550]] |
| eq_05 | `FL-101` | Suction Strainer/Filter | [460, 480, 510, 520] | equipment | [[460, 500], [510, 500]] |

### 2.2 In-line Valves & Safety
| ID | Tag | Type | Bounding Box [x1, y1, x2, y2] | Category | Ports [x, y] |
|---|---|---|---|---|---|
| vl_01 | `CV-101` | Pneumatic Control Valve | [960, 470, 1020, 530] | valve | [[960, 500], [1020, 500], [990, 470]] |
| vl_02 | `XV-101` | Solenoid Isolation Valve | [380, 480, 430, 520] | valve | [[380, 500], [430, 500], [405, 480]] |
| vl_03 | `PSV-101`| Pressure Safety Valve | [290, 180, 340, 230] | valve | [[290, 205], [340, 205]] |
| vl_04 | `CK-101` | Check / Non-Return Valve | [680, 485, 720, 515] | valve | [[680, 500], [720, 500]] |
| vl_05 | `HV-77`  | Manual Hand Valve | [1100, 485, 1140, 515] | valve | [[1100, 500], [1140, 500]] |

### 2.3 Instruments & Bubbles (ISA-5.1)
| ID | Tag | Raw Read (Common Noise) | Type | Bubble Shape | Internal Line | Ports [x, y] |
|---|---|---|---|---|---|---|
| in_01 | `PT-101` | `PT10l` | Pressure Transmitter | Circle | Solid (Field Mounted) | [[355, 180]] |
| in_02 | `FT-101` | `FT-101` | Flow Transmitter | Circle | Solid (Field Mounted) | [[815, 470]] |
| in_03 | `FIC-101`| `FIC 101` | Flow Indicating Controller | Circle | Dashed (DCS Panel) | [[815, 340]] |
| in_04 | `LT-101` | `LT-101` | Level Transmitter | Circle | Solid (Field Mounted) | [[130, 360]] |
| in_05 | `LIC-101`| `LIC-101`| Level Indicating Controller | Circle | Dashed (DCS Panel) | [[130, 260]] |
| in_06 | `TT-101` | `TT-101` | Temperature Transmitter | Circle | Solid (Field Mounted) | [[910, 470]] |
| in_07 | `TI-101` | `TI-101` | Temperature Indicator | Circle | Solid (Field Mounted) | [[750, 470]] |

---

## 3. Ground Truth Connectivity Graph

### 3.1 Process Lines (Solid Lines)
- `TK-101` -> `XV-101` (process stream)
- `XV-101` -> `FL-101` (suction line)
- `FL-101` -> `P-101A` (pump A suction)
- `FL-101` -> `P-101B` (pump B standby suction)
- `P-101A` -> `CK-101` (pump A discharge)
- `P-101B` -> `CK-101` (pump B discharge)
- `CK-101` -> `E-101` (pre-heater feed)
- `E-101` -> `CV-101` (flow controlled header)
- `CV-101` -> `HV-77` (manual isolation)
- `HV-77` -> `OPC-001` (`TO UNIT 200` battery limit)

### 3.2 Instrument & Signal Lines (Dashed / Thin Lines)
- `FT-101` -> `FIC-101` (4-20mA process signal)
- `FIC-101` -> `CV-101` (4-20mA / pneumatic control output)
- `TK-101` -> `LT-101` (tank level nozzle tapping)
- `LT-101` -> `LIC-101` (4-20mA level signal)
- `TK-101` -> `PT-101` (vapor headspace tapping)
- `E-101` -> `TT-101` (effluent temp tapping)

### 3.3 Off-Page Connectors
- `OPC-001`: Label `TO UNIT 200`, target sheet `P-200`, connected from `HV-77`.

---

## 4. Cross-Validation Discrepancies (Deliberate Test Cases)
1. **Typo Resolution**: `PT10l` in drawing -> resolved to `PT-101` using IO list match and ISA-5.1 grammar.
2. **Missing in Drawing**: `FT-310` is defined in the IO List (`4-20mA AI`, Secondary flow transmitter) but is missing from the drawing. The report must flag this under `missing_in_drawing`.
3. **Missing in IO List**: `HV-77` is present in the drawing but missing from the electrical/instrument IO list (it is a manual mechanical valve). The report must flag this under `missing_in_io_list`.
4. **Type Mismatch**: `PT-101` has signal type `DI` (Digital Input) in a faulty entry test or `4-20mA AI` in valid entries.

---

## 5. Benchmark Metrics & Ablation Target
The automated evaluation runner (`infra/scripts/benchmark.py`) computes:
- **Tag Precision / Recall**:
  - Raw OCR baseline
  - After Rule-based Cleanup (ISA-5.1 + Confusion table)
  - After LLM + IO List fuzzy matching
- **Symbol Accuracy**:
  - Multi-scale template matching vs Ground Truth bounding boxes (IoU >= 0.5)
- **Connection F1 Score**:
  - Edge detection accuracy across process and instrument lines.
