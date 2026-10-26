import json

import numpy as np
import pytest

from pipeline.boxing_research import digest
from pipeline.pose_normalizer import VERSION
from pipeline.temporal_dataset import SPLITS, TECHNIQUES, audit_manifest


def manifest(tmp_path):
    samples = []
    for group, split in enumerate(SPLITS):
        asset = tmp_path / f"{split}.npz"
        np.savez_compressed(asset, timestamps_ms=np.arange(100) * 1000 / 30,
                            features=np.full((100, 85), group, dtype=np.float32))
        for j, label in enumerate(TECHNIQUES):
            samples.append({"sampleId": f"{split}-{label}", "split": split, "technique": label,
                "fighterId": f"f-{split}", "sessionId": f"s-{split}", "sourceVideoId": f"v-{split}",
                "sourceVideoSha256": str(group + 1) * 64, "sourceInferenceSha256": str(group + 5) * 64,
                "posePath": asset.name, "poseSha256": digest(asset), "startTimeMs": j * 300,
                "endTimeMs": j * 300 + 200, "stance": "orthodox", "cameraView": "front",
                "annotatorIds": ["coach-a"], "reviewStatus": "COACH_APPROVED", "testObserved": False})
    value = {"schemaVersion": "1.0.0", "featureVersion": VERSION, "dataUseApproved": True,
             "annotationCoverage": "exhaustive", "samples": samples}
    path = tmp_path / "manifest.json"
    return path, value


def audit(path, value):
    path.write_text(json.dumps(value), encoding="utf-8")
    return audit_manifest(path, minimum_class_support=1)


def test_complete_manifest_is_structurally_valid_but_never_production_evidence(tmp_path):
    result = audit(*manifest(tmp_path))
    assert result["passesStructuralAudit"] and result["readyForTrainingByDeclaredMetadata"]
    assert result["hasUnobservedTestByDeclaration"] and result["productionEligible"] is False


@pytest.mark.parametrize("field", ["fighterId", "sessionId", "sourceVideoId", "sourceVideoSha256", "sourceInferenceSha256", "poseSha256"])
def test_all_four_splits_including_calibration_are_audited(tmp_path, field):
    path, value = manifest(tmp_path)
    value["samples"][14][field] = value["samples"][0][field]
    result = audit(path, value)
    assert any(e["code"] == "CROSS_SPLIT_LEAKAGE" and e["field"] == field for e in result["errors"])


@pytest.mark.parametrize("mutation,code", [
    ({"fighterId": ""}, "MISSING_GROUP_ID"),
    ({"reviewStatus": "AI_GENERATED"}, "UNAPPROVED_LABEL"),
    ({"reviewStatus": "DUAL_AGREEMENT", "annotatorIds": ["a", "a"]}, "INVALID_ANNOTATOR_IDS"),
    ({"technique": "kick"}, "UNSUPPORTED_TECHNIQUE"),
    ({"poseSha256": "a" * 64}, "POSE_CHECKSUM_MISMATCH"),
    ({"startTimeMs": -10}, "INVALID_ACTION_INTERVAL"),
    ({"endTimeMs": 100000}, "INTERVAL_NOT_COVERED_BY_CONTINUOUS_POSE"),
])
def test_unusable_training_samples_fail_closed(tmp_path, mutation, code):
    path, value = manifest(tmp_path)
    value["samples"][0].update(mutation)
    result = audit(path, value)
    assert not result["readyForTrainingByDeclaredMetadata"]
    assert any(e["code"] == code for e in result["errors"])


def test_background_support_and_holdout_observation_are_explicit(tmp_path):
    path, value = manifest(tmp_path)
    value["samples"] = [s for s in value["samples"] if s["technique"] != "background"]
    for s in value["samples"]:
        if s["split"] == "test": s["testObserved"] = True
    result = audit(path, value)
    assert result["passesStructuralAudit"] and not result["readyForTrainingByDeclaredMetadata"]
    assert not result["hasUnobservedTestByDeclaration"]


def test_overlap_rejected_in_single_label_contract(tmp_path):
    path, value = manifest(tmp_path)
    value["samples"][1]["startTimeMs"] = 100
    assert any(e["code"] == "OVERLAPPING_SINGLE_LABEL_INTERVALS" for e in audit(path, value)["errors"])


def test_empty_template_is_not_accepted_as_data(tmp_path):
    path, value = manifest(tmp_path)
    value["samples"] = []
    assert not audit(path, value)["passesStructuralAudit"]
