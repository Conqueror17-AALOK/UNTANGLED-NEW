"""
P&ID Symbol & Tiny-Part Classes for YOLO11 Object Detection.
Standardized according to ANSI/ISA-5.1-2009.
"""

from typing import Dict, List

# Core P&ID Symbol Taxonomy for High-Precision Detection
PID_CLASSES: List[str] = [
    # 0-4: Instrument bubbles (Circles & Panel Mounting Styles)
    "instrument_field",          # Local field-mounted circle (e.g. PI-101, TI-102)
    "instrument_dcs",            # Circle with solid horizontal line (DCS primary: PT-101, FT-102)
    "instrument_aux",            # Circle with dashed line (Auxiliary/behind-panel)
    "instrument_shared",         # Square containing circle (Shared display / DCS controller)
    "instrument_logic",          # Diamond inside square (Safety Interlock / SIS logic)

    # 5-11: Valves & Actuators
    "valve_gate",                # Gate valve (opposed triangles / hourglass)
    "valve_globe",               # Globe valve (hourglass with central solid dot)
    "valve_check",               # Check valve (hourglass with directional flap/arrow)
    "valve_ball",                # Ball valve (hourglass with circular center)
    "valve_butterfly",           # Butterfly valve (hourglass with diagonal bar)
    "valve_control_diaphragm",   # Pneumatically actuated control valve (diaphragm mushroom head)
    "valve_safety_psv",          # Pressure Safety Relief Valve (PSV angle outlet)

    # 12-14: In-line Micro-Fittings & Process Details
    "flange",                    # Flanged pipe connection (double hash ticks)
    "reducer",                   # Pipe diameter reduction (trapezoidal cone transition)
    "orifice_plate",             # Differential pressure orifice plate on line

    # 15-16: Major Process Equipment
    "pump_centrifugal",          # Centrifugal pump (casing with tangential discharge nozzle)
    "tank_vessel",               # Storage tank / vertical separator drum
]

CLASS_TO_ID: Dict[str, int] = {name: idx for idx, name in enumerate(PID_CLASSES)}
ID_TO_CLASS: Dict[int, str] = {idx: name for idx, name in enumerate(PID_CLASSES)}
NUM_CLASSES = len(PID_CLASSES)
