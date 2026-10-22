import copy
import json

import numpy as np
import pytest

from pipeline.boxing_research import FEATURE_VERSION, digest
from prepare_provisional_dataset import candidates, extract_features
from train_provisional_smoke import load_dataset


def test_adam_original_csv_overrides_ai_and_includes_non_candidate_rows(tmp_path, monkeypatch):
    import prepare_provisional_dataset as builder
    path = tmp_path / "adam_gt.csv"
    path.write_text("start_frame,end_frame,class\n0,5,Jab\n5,9,Cross\n")
    monkeypatch.setattr(builder, "ADAM_CSV_SHA256", digest(path))
    index, review = review_fixture()
    for i, task in enumerate(index["tasks"]):
        task.update(sourceRowId=str(i), startFrame=[0, 5][i], endFrameExclusive=[6, 10][i], suggestedTechnique=["jab", "cross"][i])
    review["reviews"][0]["candidateTechnique"] = "rear_uppercut"
    before = copy.deepcopy(review)
    selected, excluded = builder.select_training_labels(index, review, path)
    assert [r["trainingLabel"] for _, r in selected] == ["jab", "cross"]
    assert selected[0][0]["endFrameExclusive"] == 6 and selected[1][0]["startFrame"] == 5
    assert all(r["reviewStatus"] == "SOURCE_SELECTED_BY_USER" and not r["coachConfirmed"] for _, r in selected)
    assert not excluded and review == before
    path.write_text("start_frame,end_frame,class\n0,5,Cross\n5,9,Cross\n")
    with pytest.raises(ValueError, match="checksum"):
        builder.select_training_labels(index, review, path)


def review_fixture():
    tasks = [{"sampleId": str(i), "videoId": "adam", "startTimeMs": i * 100, "endTimeMs": (i + 1) * 100} for i in range(2)]
    rows = [{**t, "status": "AI_REVIEW_PROVISIONAL", "actorType": "AI", "coachConfirmed": False,
             "goldEligible": False, "decision": "candidate" if i == 0 else "uncertain",
             "candidateTechnique": "jab" if i == 0 else None} for i, t in enumerate(tasks)]
    return {"packId": "pack", "tasks": tasks}, {"packId": "pack", "status": "AI_REVIEW_PROVISIONAL", "reviews": rows}


def test_only_explicit_candidates_selected_without_promoting_source():
    index, review = review_fixture()
    before = copy.deepcopy(review)
    selected, excluded = candidates(index, review)
    assert len(selected) == 1 and excluded == [{"sampleId": "1", "reason": "uncertain"}]
    assert before == review


def test_duplicate_reviews_and_fabricated_approval_rejected():
    index, review = review_fixture()
    review["reviews"][1] = copy.deepcopy(review["reviews"][0])
    with pytest.raises(ValueError, match="coverage"):
        candidates(index, review)
    index, review = review_fixture()
    review["reviews"][0]["coachConfirmed"] = True
    with pytest.raises(ValueError, match="provenance"):
        candidates(index, review)


def test_discontinuous_pose_is_not_silently_trimmed():
    frames = {i: {"observationKind": "fresh_detection", "isDiscontinuous": i == 1} for i in range(4)}
    with pytest.raises(ValueError, match="DISCONTINUOUS"):
        extract_features(frames, 0, 4)


def dataset_fixture(tmp_path):
    asset = tmp_path / "features.npz"
    np.savez(asset, features=np.ones((2, 25, 85), dtype=np.float32), targets=np.array([0, 1]),
             loss_weights=np.array([.25, 1], dtype=np.float32))
    rows = [{"sampleId": "ai", "arrayIndex": 0, "trainingLabel": "jab", "lossWeight": .25,
             "sourceVideoId": "adam", "split": "train", "labelProvenance": "AI_VISUAL_TRIAGE",
             "reviewStatus": "AI_REVIEW_PROVISIONAL", "coachConfirmed": False, "goldEligible": False},
            {"sampleId": "upstream", "arrayIndex": 1, "trainingLabel": "cross", "lossWeight": 1,
             "sourceVideoId": "V8", "split": "validation", "labelProvenance": "UPSTREAM_IMPORTED_UNVERIFIED",
             "coachConfirmed": False, "goldEligible": False}]
    data = {"schemaVersion": "provisional_research_dataset_v1", "featureVersion": FEATURE_VERSION,
            "productionEligible": False, "goldEligible": False, "featurePath": "features.npz",
            "featureSha256": digest(asset), "samples": rows}
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(data))
    return path, data


def test_ai_training_weight_preserved_and_ai_evaluation_forbidden(tmp_path):
    path, data = dataset_fixture(tmp_path)
    _, _, _, weights = load_dataset(path)
    assert list(weights) == [.25, 1]
    data["samples"][0]["split"] = "validation"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="downweighted training"):
        load_dataset(path)


def test_cross_split_source_and_changed_features_rejected(tmp_path):
    path, data = dataset_fixture(tmp_path)
    data["samples"][1]["sourceVideoId"] = "adam"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="leakage"):
        load_dataset(path)
    (tmp_path / "features.npz").write_bytes(b"changed")
    with pytest.raises(ValueError, match="checksum"):
        load_dataset(path)
