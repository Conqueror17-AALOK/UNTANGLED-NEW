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


# Equipment prefixes commonly found in petrochemical/process P&IDs
EQUIPMENT_PREFIXES.update({
    "D": ("Drum / Vessel", "equipment"),
    "G": ("Pump / Equipment Package", "equipment"),
    "A": ("Process Skid / Assembly", "equipment"),
    "DRM": ("Drain Drum", "equipment"),
    "PMP": ("Process Pump", "equipment"),
})


def parse_isa51_tag(tag: str) -> Tuple[bool, Optional[str], Optional[str], float]:
    """
    Validate and classify an engineering tag against ISA-5.1 and standard P&ID conventions.
    Supports standard tags (PT-101, TK-101) and unit/plant-prefixed industrial tags (631-AY-0421, 631-FIT-0421, 631-G-0119A).
    Returns: (is_valid, descriptive_type, category, grammar_score)
    """
    cleaned = re.sub(r"[\s_-]+", "-", tag.strip().upper())
    
    # 1. Split into segments: e.g. ["631", "FIT", "0421"] or ["PT", "101"]
    parts = [p for p in cleaned.split("-") if p]
    
    prefix = ""
    loop_num = ""
    suffix = ""
    
    if len(parts) >= 3:
        # e.g. "631-FIT-0421" or "631-AY-0421A"
        prefix = parts[1]
        m = re.match(r"^(\d+)([A-Z])?$", parts[2])
        if m:
            loop_num, suffix = m.group(1), m.group(2) or ""
        else:
            loop_num = parts[2]
    elif len(parts) == 2:
        # e.g. "PT-101" or "631-FIT0421"
        if re.match(r"^\d+$", parts[0]) and not re.match(r"^\d+$", parts[1]):
            # Unit + Tag, e.g. "631-FIT0421"
            m = re.match(r"^([A-Z]{1,4})(\d+)([A-Z])?$", parts[1])
            if m:
                prefix, loop_num, suffix = m.group(1), m.group(2), m.group(3) or ""
            else:
                prefix = parts[1]
        else:
            prefix = parts[0]
            m = re.match(r"^(\d+)([A-Z])?$", parts[1])
            if m:
                loop_num, suffix = m.group(1), m.group(2) or ""
            else:
                loop_num = parts[1]
    else:
        # Single string: e.g. "PT101" or "TK101" or "631FIT0421"
        m = re.match(r"^(\d+[-_]?)?([A-Z]{1,4})(\d+)([A-Z])?$", cleaned)
        if m:
            prefix = m.group(2)
            loop_num = m.group(3)
            suffix = m.group(4) or ""
        else:
            prefix = cleaned

    # Check known equipment prefixes
    if prefix in EQUIPMENT_PREFIXES:
        desc, cat = EQUIPMENT_PREFIXES[prefix]
        return True, desc, cat, 1.0

    # Check known valve prefixes
    if prefix in VALVE_PREFIXES:
        desc, cat = VALVE_PREFIXES[prefix]
        return True, desc, cat, 1.0

    # Check ISA-5.1 Instrument format
    if len(prefix) >= 2 and prefix[0] in ISA_FIRST_LETTERS:
        first = ISA_FIRST_LETTERS[prefix[0]]
        rest = " ".join([ISA_SUCCEEDING_LETTERS[ch] for ch in prefix[1:] if ch in ISA_SUCCEEDING_LETTERS])
        desc = f"{first} {rest}".strip() if rest else f"{first} Instrument"
        cat = "valve" if prefix.endswith("V") else "instrument"
        return True, desc, cat, 1.0

    if len(prefix) == 1 and prefix in ISA_FIRST_LETTERS:
        desc = f"{ISA_FIRST_LETTERS[prefix]} Device"
        return True, desc, "instrument", 0.85

    return True, f"Equipment ({prefix})", "equipment", 0.7

