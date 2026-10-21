import json
import os

import jsonschema

from services.perception.perception.run import run_perception


def test_perception_end_to_end_and_schema_validation(tmp_path):
    pdf_path = "contracts/samples/sample_pid_01.pdf"
    out_dir = str(tmp_path / "out_test")

    result = run_perception(pdf_path, out_dir, job_id="test-job-e2e")

    assert result.job_id == "test-job-e2e"
    assert result.total_pages == 1
    page = result.pages[0]
    assert len(page.text_items) > 0
    assert len(page.symbols) > 0
    assert len(page.line_segments) > 0

    json_file = os.path.join(out_dir, "perception.json")
    assert os.path.exists(json_file)
    overlay_file = os.path.join(out_dir, "debug_overlay_page_1.png")
    assert os.path.exists(overlay_file)

    # Validate against JSON schema
    schema_path = "contracts/schemas/perception.schema.json"
    with open(schema_path, "r", encoding="utf-8") as sf:
        schema = json.load(sf)
    with open(json_file, "r", encoding="utf-8") as jf:
        data = json.load(jf)

    # Strict jsonschema validation
    jsonschema.validate(instance=data, schema=schema)
