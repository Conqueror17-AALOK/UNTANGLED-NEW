from typing import Any, Dict, List
from services.api.app.db.schemas import ReportSchema

# Localized translations for discrepancy items
TRANSLATIONS = {
    "hi": {
        "missing_drawing_title": "ड्राइंग में अनुपस्थित (Missing in Drawing)",
        "missing_io_title": "IO सूची में अनुपस्थित (Missing in IO List)",
        "type_mismatch_title": "सिग्नल प्रकार बेमेल (Signal Mismatch)",
        "missing_drawing_desc": "DCS IO सूची में उपलब्ध है लेकिन P&ID आरेख पर नहीं मिला।",
        "manual_valve_desc": "मैनुअल हैंड वाल्व - कोई विद्युत सिग्नल नहीं।",
    },
    "mr": {
        "missing_drawing_title": "रेखाचित्रात गहाळ (Missing in Drawing)",
        "missing_io_title": "IO सूचीमध्ये गहाळ (Missing in IO List)",
        "type_mismatch_title": "सिग्नल प्रकार जुळत नाही (Signal Mismatch)",
        "missing_drawing_desc": "DCS IO सूचीत नोंद आहे परंतु P&ID रेखाचित्रावर आढळले नाही.",
        "manual_valve_desc": "मॅन्युअल हँड व्हॉल्व्ह - कोणतीही इलेक्ट्रिकल जोडणी नाही.",
    },
    "en": {
        "missing_drawing_title": "Missing in Drawing",
        "missing_io_title": "Missing in IO List",
        "type_mismatch_title": "Signal Type Mismatch",
        "missing_drawing_desc": "Present in DCS IO list but missing from P&ID drawing.",
        "manual_valve_desc": "Manual hand valve - no electrical IO connection.",
    }
}


def localize_report(report: ReportSchema, lang: str = "en") -> Dict[str, Any]:
    """
    Format report output with optional multi-language operator translations (en, hi, mr).
    """
    selected_lang = lang if lang in TRANSLATIONS else "en"
    dict_report = report.model_dump()
    dict_report["lang"] = selected_lang
    dict_report["i18n_labels"] = TRANSLATIONS[selected_lang]

    # Annotate missing_in_drawing with localized description if missing
    for item in dict_report.get("missing_in_drawing", []):
        if not item.get("description"):
            item["description"] = TRANSLATIONS[selected_lang]["missing_drawing_desc"]

    return dict_report
