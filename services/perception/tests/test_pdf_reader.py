import os

from services.perception.perception.config import PerceptionConfig
from services.perception.perception.pdf_reader import PDFReader


def test_pdf_reader_vector_detection():
    reader = PDFReader()
    sample_pdf = "contracts/samples/sample_pid_01.pdf"
    assert os.path.exists(sample_pdf), "Sample PDF should exist"

    doc = reader.open_pdf(sample_pdf)
    assert len(doc) == 1
    page = doc[0]

    is_vector = reader.is_vector_pdf(page)
    assert is_vector is True

    text_items = reader.extract_vector_text(page, page_num=1)
    assert len(text_items) > 0
    extracted_texts = [t.text for t in text_items]
    assert any("TK-101" in t for t in extracted_texts)
    assert any("P-101A" in t for t in extracted_texts)

    doc.close()

def test_pdf_reader_rendering():
    reader = PDFReader(PerceptionConfig(render_dpi=150))
    sample_pdf = "contracts/samples/sample_pid_01.pdf"
    doc = reader.open_pdf(sample_pdf)
    page = doc[0]

    img, orig_w, orig_h = reader.render_page(page)
    assert img.ndim == 3
    assert img.shape[2] == 3
    assert img.shape[0] > 0 and img.shape[1] > 0
    assert orig_w > 0 and orig_h > 0

    doc.close()
