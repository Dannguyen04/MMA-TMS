"""Chỉ số đồng thuận giữa hai người gán, tính tay trên ví dụ nhỏ.

Video 10 000 ms. Cặp theo IoU (A: [a], B: [b]):
  a1 jab [1000,1400]  - b1 jab [1100,1500]            IoU 300/500 = 0,6
  a2 cross [2000,2400] - b2 lead_uppercut [2100,2500] IoU 300/500 = 0,6
  a3 lead_hook [3000,3400] - b3 lead_hook southpaw [3200,3600]  IoU 200/600 = 1/3
  a4 rear_hook [5000,5400]: không có đòn B gần đó;  b4 jab [7000,7400]: không có đòn A gần đó
"""
import json

import pytest

import review_agreement as ra
import review_timeline as rt
from test_club_timeline_core import iv


def document(annotator, intervals, **extra):
    base = {"schemaVersion": rt.ANNOTATION_SCHEMA, "packId": "pack-" + annotator, "sourceVideoId": "F001_S1",
            "videoSha256": "ab" * 32, "fps": 30, "durationMs": 10000, "annotatorId": annotator,
            "annotatorIdentityVerified": False, "status": "LOCAL_REVIEW_UNVERIFIED", "reviewerAuthenticated": False,
            "coachConfirmed": False, "goldEligible": False, "guideVersion": "v1", "intervals": intervals}
    base.update(extra)
    return base


def doc_a():
    return document("ANN-A", [
        iv("I1", "jab", 1000, 1400, peakTimeMs=1200),
        iv("I2", "cross", 2000, 2400),
        iv("I3", "lead_hook", 3000, 3400),
        iv("I4", "rear_hook", 5000, 5400),
        iv("I5", "background", 6500, 8000, backgroundType="feint"),
    ])


def doc_b():
    return document("ANN-B", [
        iv("I1", "jab", 1100, 1500, peakTimeMs=1250, certainty="uncertain"),
        iv("I2", "lead_uppercut", 2100, 2500),
        iv("I3", "lead_hook", 3200, 3600, stance="southpaw"),
        iv("I4", "jab", 7000, 7400),
    ])


def test_temporal_iou_and_greedy_one_to_one_matching():
    a = [{"startTimeMs": 0, "endTimeMs": 100}, {"startTimeMs": 100, "endTimeMs": 200}]
    b = [{"startTimeMs": 50, "endTimeMs": 150}]
    assert ra.temporal_iou(a[0], b[0]) == pytest.approx(50 / 150)
    pairs, only_a, only_b = ra.match_events(a, b, 0.3)
    assert len(pairs) == 1 and only_a == [1] and only_b == []  # hòa IoU: ưu tiên A bắt đầu sớm hơn
    assert ra.match_events(a, b, 0.34)[0] == []
    adjacent = [{"startTimeMs": 0, "endTimeMs": 100}], [{"startTimeMs": 100, "endTimeMs": 200}]
    assert ra.match_events(*adjacent, 0.1)[0] == []  # nửa mở: liền nhau không chồng


def test_event_matching_at_three_iou_thresholds():
    report = ra.build_report([(doc_a(), doc_b())])
    levels = report["videos"][0]["byIouThreshold"]
    assert [levels[k]["matchedEvents"] for k in ("0.1", "0.3", "0.5")] == [3, 3, 2]
    half = levels["0.5"]
    assert (half["onlyAnnotatorA"], half["onlyAnnotatorB"]) == (2, 2)
    assert half["precisionBvsA"] == 0.5 and half["recallBvsA"] == 0.5 and half["f1"] == 0.5  # 2*2/(4+4)
    assert levels["0.3"]["f1"] == 0.75  # 2*3/(4+4)


def test_class_kappa_and_confusion_matrix_by_hand():
    levels = ra.build_report([(doc_a(), doc_b())])["videos"][0]["byIouThreshold"]
    # IoU 0,5: cặp (jab,jab),(cross,lead_uppercut): po 0,5; pe 0,25 -> kappa 1/3
    half = levels["0.5"]["classAgreement"]
    assert half["n"] == 2 and half["observedAgreement"] == 0.5 and half["expectedAgreement"] == 0.25
    assert half["kappa"] == 0.3333
    # IoU 0,3: thêm (lead_hook,lead_hook): po 2/3; pe 2/9 -> kappa (4/9)/(7/9) = 4/7
    third = levels["0.3"]["classAgreement"]
    assert third["observedAgreement"] == 0.6667 and third["expectedAgreement"] == 0.2222 and third["kappa"] == 0.5714
    assert third["confusionRowsAColsB"]["cross"]["lead_uppercut"] == 1
    assert third["labels"] == ["jab", "cross", "lead_hook", "lead_uppercut"]
    assert third["confusionRowsAColsB"]["jab"]["jab"] == 1 and third["confusionRowsAColsB"]["lead_hook"]["lead_hook"] == 1
    assert third["perClass"]["jab"] == {"annotatorA": 1, "annotatorB": 1, "both": 1, "specificAgreement": 1.0}
    assert third["perClass"]["cross"]["specificAgreement"] == 0.0  # A gọi cross 1, B gọi 0, cả hai 0


def test_kappa_is_undefined_not_one_when_both_always_use_one_label():
    assert ra.cohen_kappa(["jab", "jab"], ["jab", "jab"])["kappa"] is None
    assert ra.cohen_kappa([], [])["kappa"] is None
    assert ra.cohen_kappa(["a", "b"], ["a", "b"])["kappa"] == 1.0
    assert ra.cohen_kappa(["a", "b"], ["b", "a"])["kappa"] == -1.0


def test_lead_rear_and_stance_agreement_by_hand():
    third = ra.build_report([(doc_a(), doc_b())])["videos"][0]["byIouThreshold"]["0.3"]
    lead_rear = third["leadRearAgreement"]  # (lead,lead),(rear,lead),(lead,lead): po 2/3, pe 2/3 -> kappa 0
    assert lead_rear["n"] == 3 and lead_rear["observedAgreement"] == 0.6667 and lead_rear["kappa"] == 0.0
    stance = third["stanceAgreementOnMatchedEvents"]  # (orth,orth),(orth,orth),(orth,south): po 2/3, pe 2/3
    assert stance["n"] == 3 and stance["observedAgreement"] == 0.6667 and stance["kappa"] == 0.0


def test_time_weighted_stance_counts_only_intervals_both_annotated():
    video = ra.build_report([(doc_a(), doc_b())])["videos"][0]
    # a1/b1 300ms, a2/b2 300ms trùng; a3/b3 200ms khác; background của A không có thế thủ nên không tính
    assert video["stanceTimeWeighted"] == {"bothAnnotatedMs": 800.0, "agreeMs": 600.0, "agreement": 0.75}


def test_boundary_offset_median_and_p95():
    offsets = ra.build_report([(doc_a(), doc_b())])["videos"][0]["byIouThreshold"]["0.3"]["boundaryOffsetsBminusA"]
    # (B-A) start [100,100,200]; end [100,100,200]; p95 tuyến tính: 100 + 0,9*(200-100) = 190
    assert offsets["startTimeMs"] == {"n": 3, "medianAbsMs": 100.0, "p95AbsMs": 190.0, "medianSignedMs": 100.0}
    assert offsets["endTimeMs"] == offsets["startTimeMs"]
    assert offsets["peakTimeMs"] == {"n": 1, "medianAbsMs": 50.0, "p95AbsMs": 50.0, "medianSignedMs": 50.0}
    assert ra.offset_stats([-30, 10]) == {"n": 2, "medianAbsMs": 20.0, "p95AbsMs": 29.0, "medianSignedMs": -10.0}
    assert ra.offset_stats([])["medianAbsMs"] is None


def test_adjudication_queue_lists_every_disagreement_and_sets_no_resolution():
    report = ra.build_report([(doc_a(), doc_b())])
    queue = report["adjudicationQueue"]
    reasons = {tuple(item["reasons"]) for item in queue["items"]}
    assert reasons == {("UNCERTAIN_ANNOTATOR_B",), ("CLASS_MISMATCH", "LEAD_REAR_MISMATCH"), ("STANCE_MISMATCH",),
                       ("ONLY_ANNOTATOR_A",), ("ONLY_ANNOTATOR_B",)}
    assert queue["itemCount"] == 5 and queue["countsByReason"]["CLASS_MISMATCH"] == 1
    only_b = next(i for i in queue["items"] if "ONLY_ANNOTATOR_B" in i["reasons"])
    # A đánh dấu feint (background) đúng chỗ B thấy một cú jab: gợi ý để phân xử
    assert only_b["otherAnnotatorOverlaps"] == [{"intervalId": "I5", "technique": "background", "backgroundType": "feint",
                                                 "unclearReason": None, "overlapMs": 400.0}]
    assert all(i["status"] == "PENDING_ADJUDICATION" and i["resolution"] is None for i in queue["items"])
    assert [i["itemId"] for i in queue["items"]] == [f"D{n:04d}" for n in range(1, 6)]
    assert all("reviewStatus" not in item and "approved" not in json.dumps(item).lower() for item in queue["items"])


def test_boundary_disagreement_only_when_tolerance_is_configured():
    assert "BOUNDARY_OFFSET_EXCEEDS_TOLERANCE" not in ra.build_report([(doc_a(), doc_b())])["adjudicationQueue"]["countsByReason"]
    flagged = ra.build_report([(doc_a(), doc_b())], tolerance_ms=150)["adjudicationQueue"]
    assert flagged["countsByReason"]["BOUNDARY_OFFSET_EXCEEDS_TOLERANCE"] == 1  # chỉ cặp a3/b3 lệch 200 ms
    assert ra.build_report([(doc_a(), doc_b())], tolerance_ms=500)["adjudicationQueue"]["itemCount"] == 5


def test_report_never_sets_confirmation_or_pass_fail():
    report = ra.build_report([(doc_a(), doc_b())])
    assert report["coachConfirmedCount"] == 0 and report["goldEligibleCount"] == 0
    assert report["acceptanceThresholds"] is None and report["boundaryToleranceMs"] is None
    text = ra.summary_text(report)
    assert "coachConfirmed = 0, goldEligible = 0" in text and "kappa" in text and "chưa đặt --boundary-tolerance-ms" in text
    assert "ĐẠT" not in text.upper() and "acceptance" not in text.lower()  # không có phán quyết đạt/không đạt


def test_pooled_metrics_sum_matches_across_videos():
    other_a = document("ANN-A", [iv("I1", "jab", 0, 100)], sourceVideoId="F002_S1", videoSha256="cd" * 32)
    other_b = document("ANN-B", [iv("I1", "cross", 0, 100)], sourceVideoId="F002_S1", videoSha256="cd" * 32)
    report = ra.build_report([(doc_a(), doc_b()), (other_a, other_b)])
    pooled = report["pooled"]["byIouThreshold"]["0.5"]
    # video 1: 2 ghép, A 4, B 4; video 2: 1 ghép, A 1, B 1 -> f1 = 2*3/(5+5)
    assert pooled["matchedEvents"] == 3 and pooled["f1"] == 0.6
    assert pooled["classAgreement"]["n"] == 3 and pooled["classAgreement"]["observedAgreement"] == 0.3333
    assert [i["sourceVideoId"] for i in report["adjudicationQueue"]["items"]][-1] == "F002_S1"
    with pytest.raises(ValueError, match="nhiều cặp"):
        ra.build_report([(doc_a(), doc_b()), (doc_a(), doc_b())])


def test_pair_must_be_same_video_and_two_different_annotators():
    same_person = document("ann-a", doc_b()["intervals"])
    with pytest.raises(ValueError, match="cùng mã người gán"):
        ra.build_report([(doc_a(), same_person)])
    with pytest.raises(ValueError, match="videoSha256"):
        ra.build_report([(doc_a(), document("ANN-B", [], videoSha256="ff" * 32))])
    with pytest.raises(ValueError, match="durationMs"):
        ra.build_report([(doc_a(), document("ANN-B", [], durationMs=9000))])
    with pytest.raises(ValueError, match="Cần ít nhất"):
        ra.build_report([])


def test_cli_writes_report_summary_and_queue_and_refuses_overlap_or_overwrite(tmp_path, capsys):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    a.write_text(json.dumps(doc_a()))
    b.write_text(json.dumps(doc_b()))
    out = tmp_path / "out"
    assert ra.main([str(a), str(b), "--output-dir", str(out), "--boundary-tolerance-ms", "150"]) == 0
    assert "kappa" in capsys.readouterr().out
    report = json.loads((out / "agreement_report.json").read_text(encoding="utf-8"))
    queue = json.loads((out / "adjudication_queue.json").read_text(encoding="utf-8"))
    assert report["status"] == "UNADJUDICATED_AGREEMENT_METRICS" and queue["itemCount"] == 5 and queue["countsByReason"]["BOUNDARY_OFFSET_EXCEEDS_TOLERANCE"] == 1
    assert queue["coachConfirmedCount"] == 0 and (out / "agreement_summary.txt").read_text(encoding="utf-8").startswith("ĐỒNG THUẬN")
    with pytest.raises(FileExistsError):
        ra.main([str(a), str(b), "--output-dir", str(out)])
    broken = document("ANN-B", [iv("I1", "jab", 0, 300), iv("I2", "cross", 200, 400)])
    b.write_text(json.dumps(broken))
    with pytest.raises(ValueError, match="OVERLAPPING_INTERVALS"):
        ra.main([str(a), str(b)])
    with pytest.raises(SystemExit):
        ra.main([str(a)])
