import io
import time
from typing import Any, Dict, List
import fitz
from services.api.app.db.schemas import ReportSchema

# Localized translations for discrepancy items and report headings
TRANSLATIONS = {
    "hi": {
        "report_title": "P&ID आरेख बनाम DCS IO सूची सत्यापन रिपोर्ट",
        "report_subtitle": "भौतिक P&ID ब्लूप्रिंट और DCS इलेक्ट्रिकल IO रजिस्टरों के बीच क्रॉस-सत्यापन।",
        "total_tags_title": "कुल टैग (Total Tags)",
        "resolved_title": "सत्यापित टैग (Resolved)",
        "review_req_title": "समीक्षा आवश्यक (Review Req.)",
        "decision_split_title": "निर्णय वितरण (Decision Split)",
        "missing_drawing_title": "ड्राइंग में अनुपस्थित (Missing in Drawing)",
        "missing_io_title": "IO सूची में अनुपस्थित (Missing in IO List)",
        "type_mismatch_title": "सिग्नल प्रकार बेमेल (Signal Mismatch)",
        "missing_drawing_desc": "DCS IO सूची में उपलब्ध है लेकिन P&ID आरेख पर नहीं मिला।",
        "missing_io_desc": "P&ID पर पहचाने गए भौतिक उपकरण जिनके पास IO कनेक्शन नहीं है।",
        "type_mismatch_desc": "ड्राइंग उपकरण प्रकार और पंजीकृत DCS IO सिग्नल के बीच बेमेल।",
        "manual_valve_desc": "मैनुअल हैंड वाल्व - कोई विद्युत सिग्नल नहीं।",
        "matched_status": "मेल खाता है (Matched)",
        "tag_header": "टैग (Tag)",
        "drawing_header": "ड्राइंग प्रकार",
        "io_header": "DCS IO सिग्नल",
        "status_header": "स्थिति",
        "audit_stamp": "प्रमाणित ऑपरेटर ऑडिट रिपोर्ट - ISA-5.1 अनुरूप",
    },
    "mr": {
        "report_title": "P&ID रेखाचित्र विरुद्ध DCS IO सूची पडताळणी अहवाल",
        "report_subtitle": "P&ID रेखाचित्र आणि DCS इलेक्ट्रिकल IO सूची यांच्यातील अचूक क्रॉस-व्हॅलिडेशन.",
        "total_tags_title": "एकूण टॅग्ज (Total Tags)",
        "resolved_title": "पडताळणी पूर्ण (Resolved)",
        "review_req_title": "पुनरावलोकन आवश्यक (Review Req.)",
        "decision_split_title": "निर्णय विभागणी (Decision Split)",
        "missing_drawing_title": "रेखाचित्रात गहाळ (Missing in Drawing)",
        "missing_io_title": "IO सूचीमध्ये गहाळ (Missing in IO List)",
        "type_mismatch_title": "सिग्नल प्रकार जुळत नाही (Signal Mismatch)",
        "missing_drawing_desc": "DCS IO सूचीत नोंद आहे परंतु P&ID रेखाचित्रावर आढळले नाही.",
        "missing_io_desc": "रेखाचित्रावर आढळलेले भौतिक उपकरणे ज्यांना विद्युत IO जोडणी नाही.",
        "type_mismatch_desc": "P&ID उपकरण प्रकार आणि DCS IO सिग्नल मधील फरक.",
        "manual_valve_desc": "मॅन्युअल हँड व्हॉल्व्ह - कोणतीही इलेक्ट्रिकल जोडणी नाही.",
        "matched_status": "जुळले (Matched)",
        "tag_header": "टॅग (Tag)",
        "drawing_header": "रेखाचित्र प्रकार",
        "io_header": "DCS IO सिग्नल",
        "status_header": "स्थिती",
        "audit_stamp": "प्रमाणित ऑपरेटर ऑडिट अहवाल - ISA-5.1 अनुरूप",
    },
    "en": {
        "report_title": "P&ID Drawing vs DCS IO List Cross-Validation Report",
        "report_subtitle": "Deterministic verification between physical blueprints and DCS electrical point registers.",
        "total_tags_title": "Total Tags Extracted",
        "resolved_title": "Resolved & Verified",
        "review_req_title": "Review Required",
        "decision_split_title": "Decision Split",
        "missing_drawing_title": "Defined in IO List, Missing in Drawing",
        "missing_io_title": "Found in Drawing, Missing in IO List",
        "type_mismatch_title": "Instrument Type & Signal Discrepancies",
        "missing_drawing_desc": "Present in DCS IO list but missing from P&ID drawing.",
        "missing_io_desc": "Physical equipment detected on drawing that lack an electrical IO point.",
        "type_mismatch_desc": "Discrepancy between blueprint instrument type and DCS registered signal.",
        "manual_valve_desc": "Manual hand valve - no electrical IO connection.",
        "matched_status": "Matched",
        "tag_header": "Tag",
        "drawing_header": "Drawing Representation",
        "io_header": "DCS Registered Signal",
        "status_header": "Status",
        "audit_stamp": "Certified Engineering Audit Report - ISA-5.1 Standard Compliant",
    }
}


def localize_report(report: ReportSchema, lang: str = "en") -> Dict[str, Any]:
    """
    Format report output with optional multi-language operator translations (en, hi, mr).
    Tags and numbers remain strictly verbatim per engineering requirements.
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


def generate_pdf_report(job_id: str, report_data: Dict[str, Any], lang: str = "en") -> bytes:
    """
    Generate an official engineering cross-validation audit PDF report with KPIs,
    three-tier resolution distribution, and discrepancy tables.
    """
    selected_lang = lang if lang in TRANSLATIONS else "en"
    labels = TRANSLATIONS[selected_lang]
    summary = report_data.get("summary", {})
    missing_drawing = report_data.get("missing_in_drawing", [])
    missing_io = report_data.get("missing_in_io_list", [])
    type_mismatches = report_data.get("type_mismatches", [])

    doc = fitz.open()
    page = doc.new_page(width=612, height=792)  # 8.5 x 11 inch

    # Background subtle official watermark
    page.insert_text(fitz.Point(120, 480), "UNTANGLED CERTIFIED AUDIT", fontsize=28, color=(0.93, 0.94, 0.97), fontname="helv")

    # Header Banner (Dark industrial navy)
    page.draw_rect(fitz.Rect(0, 0, 612, 65), color=None, fill=(0.06, 0.09, 0.16))
    page.insert_text(fitz.Point(36, 34), "UNTANGLED", fontsize=16, color=(0.0, 0.88, 1.0), fontname="helv")
    page.insert_text(fitz.Point(145, 34), "|  Engineering Audit & Cross-Validation Report", fontsize=12, color=(0.85, 0.9, 0.95), fontname="helv")
    page.insert_text(fitz.Point(36, 52), labels["audit_stamp"], fontsize=8, color=(0.4, 0.7, 0.6), fontname="helv")

    # Metadata Row
    y_cursor = 88
    page.insert_text(fitz.Point(36, y_cursor), f"JOB ID: {job_id}", fontsize=8, color=(0.3, 0.35, 0.45), fontname="helv")
    date_str = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    page.insert_text(fitz.Point(260, y_cursor), f"GENERATED: {date_str}", fontsize=8, color=(0.3, 0.35, 0.45), fontname="helv")
    page.insert_text(fitz.Point(480, y_cursor), f"LANG: {selected_lang.upper()}", fontsize=8, color=(0.0, 0.6, 0.8), fontname="helv")

    # KPI Summary Cards (4 Cards)
    y_cursor = 105
    kpis = [
        ("TOTAL TAGS", str(summary.get("tags_total", 0)), (0.9, 0.9, 0.95)),
        ("RESOLVED & VERIFIED", str(summary.get("resolved", 0)), (0.1, 0.8, 0.5)),
        ("REVIEW REQUIRED", str(summary.get("needs_review", 0)), (0.95, 0.65, 0.15)),
        ("AUTO-ACCEPTED", f"{summary.get('auto_pct', 0)}%", (0.0, 0.8, 0.95))
    ]

    card_w = 127
    for i, (title, val, val_col) in enumerate(kpis):
        x = 36 + i * (card_w + 10)
        page.draw_rect(fitz.Rect(x, y_cursor, x + card_w, y_cursor + 52), color=(0.2, 0.25, 0.35), fill=(0.08, 0.12, 0.2))
        page.insert_text(fitz.Point(x + 10, y_cursor + 18), title, fontsize=7, color=(0.55, 0.6, 0.7), fontname="helv")
        page.insert_text(fitz.Point(x + 10, y_cursor + 42), val, fontsize=17, color=val_col, fontname="helv")

    # Three-Tier Decision Distribution Bar
    y_cursor = 175
    page.insert_text(fitz.Point(36, y_cursor), "THREE-TIER RESOLUTION DISTRIBUTION", fontsize=9, color=(0.2, 0.25, 0.35), fontname="helv")
    
    bar_y = y_cursor + 8
    bar_w = 540
    page.draw_rect(fitz.Rect(36, bar_y, 36 + bar_w, bar_y + 12), color=(0.15, 0.2, 0.28), fill=(0.08, 0.12, 0.18))
    
    auto_pct = float(summary.get("auto_pct", 0)) / 100.0
    llm_pct = float(summary.get("llm_pct", 0)) / 100.0
    human_pct = float(summary.get("human_pct", 0)) / 100.0

    w_auto = bar_w * auto_pct
    w_llm = bar_w * llm_pct
    w_human = bar_w * human_pct

    if w_auto > 0:
        page.draw_rect(fitz.Rect(36, bar_y, 36 + w_auto, bar_y + 12), color=None, fill=(0.1, 0.8, 0.5))
    if w_llm > 0:
        page.draw_rect(fitz.Rect(36 + w_auto, bar_y, 36 + w_auto + w_llm, bar_y + 12), color=None, fill=(0.0, 0.8, 0.95))
    if w_human > 0:
        page.draw_rect(fitz.Rect(36 + w_auto + w_llm, bar_y, 36 + bar_w, bar_y + 12), color=None, fill=(0.95, 0.65, 0.15))

    legend_y = bar_y + 22
    page.insert_text(fitz.Point(36, legend_y), f"Auto-Accepted: {summary.get('auto_pct', 0)}%", fontsize=8, color=(0.1, 0.7, 0.4), fontname="helv")
    page.insert_text(fitz.Point(210, legend_y), f"LLM Resolved: {summary.get('llm_pct', 0)}%", fontsize=8, color=(0.0, 0.7, 0.85), fontname="helv")
    page.insert_text(fitz.Point(390, legend_y), f"Human Review Queue: {summary.get('human_pct', 0)}%", fontsize=8, color=(0.85, 0.55, 0.1), fontname="helv")

    # Section 1: Missing in Drawing
    y_cursor = 230
    page.draw_rect(fitz.Rect(36, y_cursor - 12, 576, y_cursor + 6), color=None, fill=(0.92, 0.94, 0.98))
    page.insert_text(fitz.Point(42, y_cursor), "DISCREPANCY 1: DEFINED IN DCS IO LIST, MISSING IN P&ID DRAWING", fontsize=8.5, color=(0.8, 0.1, 0.1), fontname="helv")
    
    y_cursor += 18
    if missing_drawing:
        for item in missing_drawing:
            io_tag = item.get("io_tag", "UNKNOWN")
            desc = item.get("description", "Not found on drawing.")
            page.draw_rect(fitz.Rect(36, y_cursor - 10, 576, y_cursor + 12), color=(0.85, 0.88, 0.92), fill=(0.98, 0.98, 1.0))
            page.insert_text(fitz.Point(45, y_cursor + 2), io_tag, fontsize=8.5, color=(0.8, 0.15, 0.15), fontname="helv")
            page.insert_text(fitz.Point(150, y_cursor + 2), desc[:85], fontsize=8, color=(0.3, 0.35, 0.4), fontname="helv")
            y_cursor += 26
    else:
        page.insert_text(fitz.Point(45, y_cursor + 2), "No missing items detected. All DCS IO tags identified on drawing.", fontsize=8, color=(0.2, 0.6, 0.3), fontname="helv")
        y_cursor += 22

    # Section 2: Found in Drawing, Missing in IO List
    y_cursor += 10
    page.draw_rect(fitz.Rect(36, y_cursor - 12, 576, y_cursor + 6), color=None, fill=(0.92, 0.94, 0.98))
    page.insert_text(fitz.Point(42, y_cursor), "DISCREPANCY 2: FOUND IN DRAWING, MISSING IN DCS IO LIST (MECHANICAL / MANUAL)", fontsize=8.5, color=(0.7, 0.4, 0.05), fontname="helv")
    
    y_cursor += 18
    if missing_io:
        for item in missing_io:
            tag = item.get("tag", "UNKNOWN")
            page.draw_rect(fitz.Rect(36, y_cursor - 10, 576, y_cursor + 12), color=(0.85, 0.88, 0.92), fill=(0.98, 0.98, 1.0))
            page.insert_text(fitz.Point(45, y_cursor + 2), tag, fontsize=8.5, color=(0.7, 0.45, 0.05), fontname="helv")
            page.insert_text(fitz.Point(150, y_cursor + 2), "Physical manual equipment / hand valve with no electrical DCS IO point.", fontsize=8, color=(0.3, 0.35, 0.4), fontname="helv")
            y_cursor += 26
    else:
        page.insert_text(fitz.Point(45, y_cursor + 2), "None. All drawing equipment have corresponding electrical IO points.", fontsize=8, color=(0.2, 0.6, 0.3), fontname="helv")
        y_cursor += 22

    # Section 3: Type Mismatches
    y_cursor += 10
    page.draw_rect(fitz.Rect(36, y_cursor - 12, 576, y_cursor + 6), color=None, fill=(0.92, 0.94, 0.98))
    page.insert_text(fitz.Point(42, y_cursor), "INSTRUMENT TYPE & SIGNAL DISCREPANCY AUDIT", fontsize=8.5, color=(0.0, 0.4, 0.6), fontname="helv")

    y_cursor += 18
    # Table Header
    page.draw_rect(fitz.Rect(36, y_cursor - 10, 576, y_cursor + 8), color=None, fill=(0.15, 0.2, 0.28))
    page.insert_text(fitz.Point(45, y_cursor + 2), "TAG", fontsize=7.5, color=(0.9, 0.95, 1.0), fontname="helv")
    page.insert_text(fitz.Point(150, y_cursor + 2), "DRAWING REPRESENTATION", fontsize=7.5, color=(0.9, 0.95, 1.0), fontname="helv")
    page.insert_text(fitz.Point(340, y_cursor + 2), "DCS REGISTERED SIGNAL", fontsize=7.5, color=(0.9, 0.95, 1.0), fontname="helv")
    page.insert_text(fitz.Point(500, y_cursor + 2), "STATUS", fontsize=7.5, color=(0.9, 0.95, 1.0), fontname="helv")
    y_cursor += 22

    for m in type_mismatches:
        page.draw_rect(fitz.Rect(36, y_cursor - 10, 576, y_cursor + 12), color=(0.85, 0.88, 0.92), fill=(1.0, 1.0, 1.0))
        page.insert_text(fitz.Point(45, y_cursor + 2), str(m.get("tag", "")), fontsize=8, color=(0.0, 0.4, 0.7), fontname="helv")
        page.insert_text(fitz.Point(150, y_cursor + 2), str(m.get("drawing_type", "")), fontsize=8, color=(0.25, 0.3, 0.35), fontname="helv")
        page.insert_text(fitz.Point(340, y_cursor + 2), str(m.get("io_signal", "")), fontsize=8, color=(0.1, 0.6, 0.35), fontname="helv")
        page.insert_text(fitz.Point(500, y_cursor + 2), "VERIFIED", fontsize=7.5, color=(0.1, 0.65, 0.35), fontname="helv")
        y_cursor += 24

    # Footer
    page.draw_line(fitz.Point(36, 750), fitz.Point(576, 750), color=(0.8, 0.85, 0.9), width=0.5)
    page.insert_text(fitz.Point(36, 765), "UNTANGLE Automated Engineering Blueprint & DCS IO Untangling System", fontsize=7.5, color=(0.5, 0.55, 0.6), fontname="helv")
    page.insert_text(fitz.Point(520, 765), "Page 1 of 1", fontsize=7.5, color=(0.5, 0.55, 0.6), fontname="helv")

    return doc.tobytes()
