import hashlib
import json
from pathlib import Path

def canonical_json_python(data: any) -> str:
    return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

def test_cross_language_canonical_json_parity():
    fixture_path = Path(__file__).parent / "test_fixtures" / "canonical-json-fixture.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        fixtures = json.load(f)

    for case in fixtures["testCases"]:
        canonical_str = canonical_json_python(case["input"])
        digest = "sha256:" + hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()
        assert canonical_str == case["expectedCanonicalJson"]
        assert digest == case["expectedSha256"]
