import os
import pytest
from services.api.app.engine.io_parser import parse_io_list


def test_parse_sample_io_list():
    sample_path = "contracts/samples/sample_io_list.xlsx"
    assert os.path.exists(sample_path)

    result = parse_io_list(sample_path)
    assert len(result.items) >= 10
    assert "TK-101" in result.by_tag
    assert "PT-101" in result.by_tag
    assert "FT-310" in result.by_tag

    # Test attributes
    pt_entry = result.by_tag["PT-101"]
    assert pt_entry.description is not None and "Pressure" in pt_entry.description
    assert pt_entry.signal_type is not None and "AI" in pt_entry.signal_type
