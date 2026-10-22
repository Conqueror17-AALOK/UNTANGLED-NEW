import re
from typing import Optional, Tuple

# ISA-5.1 First Letters (Measured / Initiating Variables)
ISA_FIRST_LETTERS = {
    "A": "Analysis",
    "B": "Burner / Combustion",
    "C": "User's Choice (Conductivity)",
    "D": "Density / Differential",
    "E": "Voltage",
    "F": "Flow",
    "G": "Gauging",
    "H": "Hand",
    "I": "Current",
    "J": "Power",
    "K": "Time",
    "L": "Level",
    "M": "Moisture",
    "N": "User Choice",
    "O": "User Choice",
    "P": "Pressure",
    "Q": "Quantity",
    "R": "Radiation",
    "S": "Speed / Frequency",
    "T": "Temperature",
    "U": "Multivariable",
    "V": "Vibration / Mechanical",
    "W": "Weight / Force",
    "X": "Unclassified",
    "Y": "Event / State",
    "Z": "Position / Dimension",
}

# ISA-5.1 Succeeding Letters (Modifier / Readout / Output Function)
ISA_SUCCEEDING_LETTERS = {
    "A": "Alarm",
    "C": "Controller",
    "D": "Differential",
    "E": "Element / Primary Sensor",
    "G": "Glass / Gauge",
    "H": "High",
    "I": "Indicator",
    "K": "Control Station",
    "L": "Light / Low",
    "M": "Middle / Intermediate",
    "O": "Orifice / Restriction",
    "P": "Point / Test Point",
    "R": "Recorder",
    "S": "Switch / Safety",
    "T": "Transmitter",
    "V": "Valve / Damper",
    "X": "Unclassified",
    "Y": "Relay / Compute",
    "Z": "Driver / Actuator",
}

# Common Equipment & Valve Prefixes
EQUIPMENT_PREFIXES = {
    "TK": ("Storage Tank", "equipment"),
    "T": ("Tank", "equipment"),
    "V": ("Vessel", "equipment"),
    "P": ("Centrifugal Pump", "equipment"),
    "PU": ("Pump", "equipment"),
    "E": ("Heat Exchanger", "equipment"),
    "HEX": ("Heat Exchanger", "equipment"),
    "FL": ("Suction Strainer/Filter", "equipment"),
    "FIL": ("Filter", "equipment"),
    "C": ("Compressor", "equipment"),
    "K": ("Compressor", "equipment"),
    "B": ("Boiler", "equipment"),
    "R": ("Reactor", "equipment"),
    "COL": ("Column", "equipment"),
}

VALVE_PREFIXES = {
    "CV": ("Pneumatic Control Valve", "valve"),
    "XV": ("Emergency Isolation Solenoid Valve", "valve"),
    "PSV": ("Pressure Safety Valve", "valve"),
    "PRV": ("Pressure Relief Valve", "valve"),
    "CK": ("Check / Non-Return Valve", "valve"),
    "NRV": ("Non-Return Valve", "valve"),
    "HV": ("Manual Hand Valve", "valve"),
    "MOV": ("Motor Operated Valve", "valve"),
    "FV": ("Flow Control Valve", "valve"),
    "PV": ("Pressure Control Valve", "valve"),
    "LV": ("Level Control Valve", "valve"),
    "TV": ("Temperature Control Valve", "valve"),
}


def parse_isa51_tag(tag: str) -> Tuple[bool, Optional[str], Optional[str], float]:
    """
    Validate and classify an engineering tag against ISA-5.1 and standard P&ID conventions.
    Returns: (is_valid, descriptive_type, category, grammar_score)
    """
    cleaned = tag.strip().upper().replace(" ", "-")
    # Standard pattern: [ALPHA]-[NUMERIC][OPTIONAL_ALPHA]
    # e.g., PT-101, FT-101, TK-101, P-101A, HV-77
    match = re.match(r"^([A-Z]{1,4})-?([0-9]{1,5})([A-Z])?$", cleaned)
    if not match:
        return False, "Unknown Item", "equipment", 0.3

    prefix, loop_num, suffix = match.groups()

    # 1. Check known equipment prefixes
    if prefix in EQUIPMENT_PREFIXES:
        desc, cat = EQUIPMENT_PREFIXES[prefix]
        return True, desc, cat, 1.0

    # 2. Check known valve prefixes
    if prefix in VALVE_PREFIXES:
        desc, cat = VALVE_PREFIXES[prefix]
        return True, desc, cat, 1.0

    # 3. Check ISA-5.1 Instrument format
    if len(prefix) >= 2 and prefix[0] in ISA_FIRST_LETTERS:
        first = ISA_FIRST_LETTERS[prefix[0]]
        rest = " ".join([ISA_SUCCEEDING_LETTERS[ch] for ch in prefix[1:] if ch in ISA_SUCCEEDING_LETTERS])
        desc = f"{first} {rest}".strip()
        cat = "valve" if prefix.endswith("V") else "instrument"
        return True, desc, cat, 1.0

    return True, f"Equipment ({prefix})", "equipment", 0.7
