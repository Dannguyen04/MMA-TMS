"""So hai bản gán nhãn toàn timeline độc lập của cùng một video.

Đầu vào: hai file `club_timeline_annotation_v1` do review_tools/club_timeline.html xuất
(hai mã người gán khác nhau, cùng SHA-256 video). Đầu ra: JSON số liệu đồng thuận,
tóm tắt văn bản và danh sách mục chuyển phân xử.

Chỉ đo, không chốt: chưa có ngưỡng chấp nhận (chủ dự án quyết sau pilot) nên báo cáo
không có pass/fail; ngưỡng sai lệch ranh giới chỉ áp dụng khi truyền --boundary-tolerance-ms.
Kết quả luôn có coachConfirmedCount = goldEligibleCount = 0 và không ghi trạng thái phân xử.

Ví dụ:
  .venv\\Scripts\\python.exe review_agreement.py A.json B.json --output-dir out/F007_S1
  .venv\\Scripts\\python.exe review_agreement.py --pair A1.json B1.json --pair A2.json B2.json --output-dir out/val
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import sys

import numpy as np

import review_timeline as rt

REPORT_SCHEMA = "club_timeline_agreement_v1"
IOU_THRESHOLDS = (0.1, 0.3, 0.5)  # giống các ngưỡng evaluator (AI-SIX-PUNCH-VIDEO)
DISAGREEMENT_IOU = 0.1            # mức ghép rộng nhất: lệch lớp hiện là "khác lớp" thay vì hai đòn lẻ
IOU_EPS = 1e-9


def r4(value):
    return None if value is None else round(float(value), 4)


# --- ghép sự kiện ---------------------------------------------------------

def temporal_iou(a, b):
    inter = min(a["endTimeMs"], b["endTimeMs"]) - max(a["startTimeMs"], b["startTimeMs"])
    if inter <= 0:
        return 0.0
    union = (a["endTimeMs"] - a["startTimeMs"]) + (b["endTimeMs"] - b["startTimeMs"]) - inter
    return inter / union


def strike_events(document):
    return sorted((dict(iv) for iv in document["intervals"] if iv["technique"] in rt.STRIKES),
                  key=lambda iv: (iv["startTimeMs"], iv["endTimeMs"], iv["intervalId"]))


def match_events(events_a, events_b, threshold):
    """Ghép một-một, tham lam theo IoU giảm dần, không xét lớp. Trả (cặp, chỉ-số-lẻ-A, chỉ-số-lẻ-B).

    Ổn định: hòa IoU thì ưu tiên mốc bắt đầu sớm hơn của A rồi B.
    """
    candidates = []
    for i, a in enumerate(events_a):
        for j, b in enumerate(events_b):
            value = temporal_iou(a, b)
            if value > 0 and value >= threshold - IOU_EPS:
                candidates.append((-value, a["startTimeMs"], b["startTimeMs"], i, j))
    candidates.sort()
    used_a, used_b, pairs = set(), set(), []
    for negative, _, _, i, j in candidates:
        if i in used_a or j in used_b:
            continue
        used_a.add(i)
        used_b.add(j)
        pairs.append((events_a[i], events_b[j], -negative))
    pairs.sort(key=lambda p: (p[0]["startTimeMs"], p[1]["startTimeMs"]))
    return (pairs, [i for i in range(len(events_a)) if i not in used_a],
            [j for j in range(len(events_b)) if j not in used_b])


# --- chỉ số ---------------------------------------------------------------

def cohen_kappa(labels_a, labels_b):
    """Kappa của hai người trên cùng một danh sách mục. None nếu không xác định
    (không có mục, hoặc kỳ vọng ngẫu nhiên = 1 do cả hai chỉ dùng đúng một nhãn)."""
    n = len(labels_a)
    if n == 0:
        return {"n": 0, "observedAgreement": None, "expectedAgreement": None, "kappa": None}
    observed = sum(x == y for x, y in zip(labels_a, labels_b)) / n
    count_a, count_b = Counter(labels_a), Counter(labels_b)
    expected = sum(count_a[c] * count_b[c] for c in set(count_a) | set(count_b)) / (n * n)
    kappa = None if expected >= 1 - 1e-12 else (observed - expected) / (1 - expected)
    return {"n": n, "observedAgreement": r4(observed), "expectedAgreement": r4(expected), "kappa": r4(kappa)}


def class_agreement(pairs):
    a_labels = [a["technique"] for a, _, _ in pairs]
    b_labels = [b["technique"] for _, b, _ in pairs]
    result = cohen_kappa(a_labels, b_labels)
    labels = [c for c in rt.STRIKES if c in set(a_labels) | set(b_labels)]
    confusion = {ca: {cb: sum(1 for x, y in zip(a_labels, b_labels) if x == ca and y == cb) for cb in labels}
                 for ca in labels}
    per_class = {}
    for c in labels:
        both = confusion[c][c]
        n_a, n_b = a_labels.count(c), b_labels.count(c)
        # Đồng thuận riêng của lớp: 2*cả-hai / (số A gọi c + số B gọi c), trên các cặp đã ghép.
        per_class[c] = {"annotatorA": n_a, "annotatorB": n_b, "both": both,
                        "specificAgreement": r4(2 * both / (n_a + n_b)) if n_a + n_b else None}
    return {**result, "labels": labels, "confusionRowsAColsB": confusion, "perClass": per_class}


def field_agreement(pairs, field, valid):
    chosen = [(a[field], b[field]) for a, b, _ in pairs if a.get(field) in valid and b.get(field) in valid]
    result = cohen_kappa([x for x, _ in chosen], [y for _, y in chosen])
    result["pairsWithoutBothValues"] = len(pairs) - len(chosen)
    return result


def offset_stats(values):
    if not values:
        return {"n": 0, "medianAbsMs": None, "p95AbsMs": None, "medianSignedMs": None}
    absolute = np.abs(values)
    # np.percentile nội suy tuyến tính; median/p95 theo trị tuyệt đối, kèm median có dấu (B - A).
    return {"n": len(values), "medianAbsMs": r4(np.median(absolute)),
            "p95AbsMs": r4(np.percentile(absolute, 95)), "medianSignedMs": r4(np.median(values))}


def boundary_offsets(pairs):
    out = {}
    for key in ("startTimeMs", "endTimeMs"):
        out[key] = offset_stats([b[key] - a[key] for a, b, _ in pairs])
    out["peakTimeMs"] = offset_stats([b["peakTimeMs"] - a["peakTimeMs"] for a, b, _ in pairs
                                      if rt._num(a.get("peakTimeMs")) and rt._num(b.get("peakTimeMs"))])
    return out


def metrics_at(matches, threshold):
    """Số liệu ở một ngưỡng IoU cho danh sách VideoMatch (một video = theo video; nhiều = gộp)."""
    pairs, n_a, n_b = [], 0, 0
    for match in matches:
        pairs += match["pairs"][threshold]
        n_a += match["eventsA"]
        n_b += match["eventsB"]
    matched = len(pairs)
    return {"matchedEvents": matched, "onlyAnnotatorA": n_a - matched, "onlyAnnotatorB": n_b - matched,
            "precisionBvsA": r4(matched / n_b) if n_b else None,
            "recallBvsA": r4(matched / n_a) if n_a else None,
            "f1": r4(2 * matched / (n_a + n_b)) if n_a + n_b else None,
            "classAgreement": class_agreement(pairs),
            "leadRearAgreement": field_agreement(pairs, "leadRear", ("lead", "rear")),
            "stanceAgreementOnMatchedEvents": field_agreement(pairs, "stance", rt.STANCES),
            "boundaryOffsetsBminusA": boundary_offsets(pairs)}


# --- so theo thời gian (stance, không rõ) ---------------------------------

def overlap_ms(a, b):
    return max(0.0, min(a["endTimeMs"], b["endTimeMs"]) - max(a["startTimeMs"], b["startTimeMs"]))


def time_weighted_stance(doc_a, doc_b):
    """Số ms cả hai cùng ghi thế thủ và số ms trùng nhau; không giả định thế thủ của khoảng chưa ghi."""
    both = agree = 0.0
    for a in doc_a["intervals"]:
        if a.get("stance") not in rt.STANCES:
            continue
        for b in doc_b["intervals"]:
            if b.get("stance") not in rt.STANCES:
                continue
            ms = overlap_ms(a, b)
            both += ms
            if a["stance"] == b["stance"]:
                agree += ms
    return {"bothAnnotatedMs": r4(both), "agreeMs": r4(agree),
            "agreement": r4(agree / both) if both > 0 else None}


def unclear_overlap(doc_a, doc_b):
    ua = [i for i in doc_a["intervals"] if i["technique"] == "unclear"]
    ub = [i for i in doc_b["intervals"] if i["technique"] == "unclear"]
    return {"annotatorAMs": r4(sum(i["endTimeMs"] - i["startTimeMs"] for i in ua)),
            "annotatorBMs": r4(sum(i["endTimeMs"] - i["startTimeMs"] for i in ub)),
            "bothMs": r4(sum(overlap_ms(a, b) for a in ua for b in ub))}


# --- danh sách phân xử ----------------------------------------------------

def _brief(iv):
    if iv is None:
        return None
    keys = ("intervalId", "technique", "startTimeMs", "endTimeMs", "peakTimeMs", "leadRear", "stance",
            "backgroundType", "unclearReason", "qualityFlags", "certainty", "note")
    return {k: iv.get(k) for k in keys}


def _other_overlaps(event, other_doc):
    found = [{"intervalId": o["intervalId"], "technique": o["technique"],
              "backgroundType": o.get("backgroundType"), "unclearReason": o.get("unclearReason"),
              "overlapMs": r4(overlap_ms(event, o))} for o in other_doc["intervals"] if overlap_ms(event, o) > 0]
    return found


def disagreements_for(doc_a, doc_b, events_a, events_b, tolerance_ms=None, threshold=DISAGREEMENT_IOU):
    pairs, only_a, only_b = match_events(events_a, events_b, threshold)
    items = []
    for a, b, value in pairs:
        reasons = []
        if a["technique"] != b["technique"]:
            reasons.append("CLASS_MISMATCH")
        if a.get("leadRear") in ("lead", "rear") and b.get("leadRear") in ("lead", "rear") and a["leadRear"] != b["leadRear"]:
            reasons.append("LEAD_REAR_MISMATCH")
        if a.get("stance") in rt.STANCES and b.get("stance") in rt.STANCES and a["stance"] != b["stance"]:
            reasons.append("STANCE_MISMATCH")
        if a.get("certainty") == "uncertain":
            reasons.append("UNCERTAIN_ANNOTATOR_A")
        if b.get("certainty") == "uncertain":
            reasons.append("UNCERTAIN_ANNOTATOR_B")
        if tolerance_ms is not None:
            offsets = [abs(b[k] - a[k]) for k in ("startTimeMs", "endTimeMs")]
            if rt._num(a.get("peakTimeMs")) and rt._num(b.get("peakTimeMs")):
                offsets.append(abs(b["peakTimeMs"] - a["peakTimeMs"]))
            if max(offsets) > tolerance_ms:
                reasons.append("BOUNDARY_OFFSET_EXCEEDS_TOLERANCE")
        if reasons:
            items.append({"reasons": reasons, "iou": r4(value), "a": _brief(a), "b": _brief(b),
                          "startTimeMs": min(a["startTimeMs"], b["startTimeMs"]),
                          "endTimeMs": max(a["endTimeMs"], b["endTimeMs"])})
    for index, side, other_doc, events in ((only_a, "ONLY_ANNOTATOR_A", doc_b, events_a),
                                           (only_b, "ONLY_ANNOTATOR_B", doc_a, events_b)):
        for i in index:
            event = events[i]
            reasons = [side] + (["UNCERTAIN_ANNOTATOR_" + side[-1]] if event.get("certainty") == "uncertain" else [])
            items.append({"reasons": reasons, "iou": None,
                          "a": _brief(event) if side.endswith("A") else None,
                          "b": _brief(event) if side.endswith("B") else None,
                          "otherAnnotatorOverlaps": _other_overlaps(event, other_doc),
                          "startTimeMs": event["startTimeMs"], "endTimeMs": event["endTimeMs"]})
    items.sort(key=lambda it: (it["startTimeMs"], it["endTimeMs"]))
    return items


# --- so một cặp / nhiều cặp -----------------------------------------------

def check_pair(doc_a, doc_b):
    """Hai file phải cùng video và do hai người gán khác nhau; nếu không thì dừng."""
    problems = []
    for field in ("sourceVideoId", "videoSha256"):
        if doc_a[field] != doc_b[field]:
            problems.append(f"khác {field}")
    for field in ("durationMs", "fps"):
        if abs(doc_a[field] - doc_b[field]) > 1e-6:
            problems.append(f"khác {field}")
    if doc_a["annotatorId"].lower() == doc_b["annotatorId"].lower():
        problems.append("cùng mã người gán: hai lần gán của một người không phải hai người độc lập")
    if problems:
        raise ValueError("Không so được hai file: " + "; ".join(problems))


def compare_documents(doc_a, doc_b, *, tolerance_ms=None, disagreement_iou=DISAGREEMENT_IOU):
    check_pair(doc_a, doc_b)
    events_a, events_b = strike_events(doc_a), strike_events(doc_b)
    pairs = {t: match_events(events_a, events_b, t)[0] for t in IOU_THRESHOLDS}
    match = {"sourceVideoId": doc_a["sourceVideoId"], "eventsA": len(events_a), "eventsB": len(events_b), "pairs": pairs}
    items = disagreements_for(doc_a, doc_b, events_a, events_b, tolerance_ms, disagreement_iou)
    for item in items:
        item["sourceVideoId"] = doc_a["sourceVideoId"]
    video = {"sourceVideoId": doc_a["sourceVideoId"], "videoSha256": doc_a["videoSha256"],
             "packIds": [doc_a.get("packId"), doc_b.get("packId")],
             "annotatorIds": [doc_a["annotatorId"], doc_b["annotatorId"]],
             "guideVersions": [doc_a.get("guideVersion"), doc_b.get("guideVersion")],
             "strikeEventsA": len(events_a), "strikeEventsB": len(events_b),
             "coverage": {"annotatorA": doc_a.get("validation", {}).get("coverage"),
                          "annotatorB": doc_b.get("validation", {}).get("coverage")},
             "byIouThreshold": {str(t): metrics_at([match], t) for t in IOU_THRESHOLDS},
             "stanceTimeWeighted": time_weighted_stance(doc_a, doc_b), "unclear": unclear_overlap(doc_a, doc_b)}
    return video, match, items


def build_report(documents, *, tolerance_ms=None, disagreement_iou=DISAGREEMENT_IOU):
    """documents: danh sách (doc_a, doc_b). Nhiều cặp thì thêm khối `pooled` (gộp cặp đã ghép)."""
    if not documents:
        raise ValueError("Cần ít nhất một cặp file")
    videos, matches, items = [], [], []
    for doc_a, doc_b in documents:
        video, match, found = compare_documents(doc_a, doc_b, tolerance_ms=tolerance_ms, disagreement_iou=disagreement_iou)
        videos.append(video)
        matches.append(match)
        items += found
    ids = [v["sourceVideoId"] for v in videos]
    if len(set(ids)) != len(ids):
        raise ValueError("Một video xuất hiện trong nhiều cặp; mỗi video chỉ so một cặp")
    for number, item in enumerate(items, 1):
        item.update(itemId=f"D{number:04d}", status="PENDING_ADJUDICATION", resolution=None)
    report = {"schemaVersion": REPORT_SCHEMA, "status": "UNADJUDICATED_AGREEMENT_METRICS",
              "coachConfirmedCount": 0, "goldEligibleCount": 0,
              "acceptanceThresholds": None,
              "thresholdNote": "Chưa có ngưỡng chấp nhận độ đồng thuận (chủ dự án chốt sau pilot); báo cáo chỉ đo, không pass/fail.",
              "iouThresholds": list(IOU_THRESHOLDS), "disagreementIou": disagreement_iou,
              "boundaryToleranceMs": tolerance_ms,
              "matching": "Ghép một-một tham lam theo IoU giảm dần, không xét lớp; kappa tính trên cặp đã ghép.",
              "videos": videos}
    if len(videos) > 1:
        report["pooled"] = {"videoCount": len(videos), "annotatorIds": sorted({a for v in videos for a in v["annotatorIds"]}),
                            "byIouThreshold": {str(t): metrics_at(matches, t) for t in IOU_THRESHOLDS}}
    report["adjudicationQueue"] = {
        "status": "PENDING_ADJUDICATION",
        "note": "Chỉ là danh sách mục bất đồng. Chưa có trạng thái 'đã phân xử' hay reviewStatus: chờ chủ dự án chốt cách ghi.",
        "itemCount": len(items), "countsByReason": dict(Counter(r for it in items for r in it["reasons"])),
        "items": items}
    return report


# --- tóm tắt văn bản ------------------------------------------------------

def _pct(value):
    return "n/a" if value is None else f"{100 * value:.1f}%"


def _num(value):
    return "n/a" if value is None else f"{value:.3f}"


def _block(title, by_threshold):
    lines = [title]
    for key, m in by_threshold.items():
        c = m["classAgreement"]
        lines.append(f"  IoU {key}: ghép {m['matchedEvents']} | chỉ A {m['onlyAnnotatorA']} | chỉ B {m['onlyAnnotatorB']} | "
                     f"F1 {_pct(m['f1'])} | đồng ý lớp {_pct(c['observedAgreement'])} | kappa {_num(c['kappa'])} (n={c['n']})")
        lr, st = m["leadRearAgreement"], m["stanceAgreementOnMatchedEvents"]
        lines.append(f"    lead/rear: đồng ý {_pct(lr['observedAgreement'])} (n={lr['n']}) | thế thủ: đồng ý {_pct(st['observedAgreement'])} (n={st['n']})")
        b = m["boundaryOffsetsBminusA"]
        for name, label in (("startTimeMs", "start"), ("endTimeMs", "end"), ("peakTimeMs", "peak")):
            s = b[name]
            lines.append(f"    lệch {label} (B-A): median|.| {_num(s['medianAbsMs'])} ms, p95|.| {_num(s['p95AbsMs'])} ms, "
                         f"median có dấu {_num(s['medianSignedMs'])} ms (n={s['n']})")
        if c["confusionRowsAColsB"]:
            lines.append("    ma trận nhầm (hàng A, cột B): " + json.dumps(c["confusionRowsAColsB"], ensure_ascii=False))
    return lines


def summary_text(report):
    lines = ["ĐỒNG THUẬN GIỮA HAI NGƯỜI GÁN (chưa phân xử; không phải nhãn HLV/gold)",
             f"coachConfirmed = {report['coachConfirmedCount']}, goldEligible = {report['goldEligibleCount']}",
             report["thresholdNote"], ""]
    for video in report["videos"]:
        a, b = video["annotatorIds"]
        lines.append(f"Video {video['sourceVideoId']}: {a} so với {b}; đòn A {video['strikeEventsA']}, đòn B {video['strikeEventsB']}")
        lines += _block("  Theo từng ngưỡng IoU", video["byIouThreshold"])
        w = video["stanceTimeWeighted"]
        lines.append(f"  Thế thủ theo thời gian: cả hai cùng ghi {_num(w['bothAnnotatedMs'])} ms, trùng {_pct(w['agreement'])}")
        u = video["unclear"]
        lines.append(f"  Không rõ: A {_num(u['annotatorAMs'])} ms, B {_num(u['annotatorBMs'])} ms, trùng {_num(u['bothMs'])} ms")
        lines.append("")
    if "pooled" in report:
        lines += _block(f"GỘP {report['pooled']['videoCount']} video", report["pooled"]["byIouThreshold"])
        lines.append("")
    q = report["adjudicationQueue"]
    lines.append(f"Chuyển phân xử (IoU ghép {report['disagreementIou']}): {q['itemCount']} mục")
    for reason, count in sorted(q["countsByReason"].items()):
        lines.append(f"  {reason}: {count}")
    if report["boundaryToleranceMs"] is None:
        lines.append("  (chưa đặt --boundary-tolerance-ms nên chênh ranh giới chưa tạo mục phân xử)")
    lines.append("Kết cục phân xử chưa được ghi: cần chủ dự án chốt trạng thái nhãn đã phân xử.")
    return "\n".join(lines) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("files", nargs="*", type=Path, help="đúng hai file nhãn của cùng một video")
    parser.add_argument("--pair", nargs=2, action="append", type=Path, metavar=("A", "B"), default=[],
                        help="thêm một cặp (lặp lại để gộp nhiều video, ví dụ cùng một split)")
    parser.add_argument("--output-dir", type=Path, help="ghi agreement_report.json, agreement_summary.txt, adjudication_queue.json")
    parser.add_argument("--boundary-tolerance-ms", type=float, default=None,
                        help="không có mặc định; chỉ khi đặt thì chênh start/end/peak vượt ngưỡng mới thành mục phân xử")
    parser.add_argument("--disagreement-iou", type=float, default=DISAGREEMENT_IOU,
                        help="IoU dùng ghép cặp khi lập danh sách phân xử (mặc định 0,1; số liệu vẫn tính ở 0,1/0,3/0,5)")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # console Windows mặc định không in được tiếng Việt
    args = parser.parse_args(argv)
    if args.files and len(args.files) != 2:
        parser.error("Truyền đúng hai file, hoặc dùng --pair A B")
    pairs = ([tuple(args.files)] if args.files else []) + [tuple(p) for p in args.pair]
    if not pairs:
        parser.error("Cần hai file nhãn hoặc ít nhất một --pair")
    if args.boundary_tolerance_ms is not None and args.boundary_tolerance_ms < 0:
        parser.error("--boundary-tolerance-ms phải >= 0")
    if not 0 < args.disagreement_iou <= 1:
        parser.error("--disagreement-iou phải trong (0, 1]")
    documents = [(rt.load_annotation(a), rt.load_annotation(b)) for a, b in pairs]
    report = build_report(documents, tolerance_ms=args.boundary_tolerance_ms, disagreement_iou=args.disagreement_iou)
    text = summary_text(report)
    if args.output_dir:
        args.output_dir.mkdir(parents=True, exist_ok=False)
        queue = {"schemaVersion": REPORT_SCHEMA + "_queue", **report["adjudicationQueue"],
                 "coachConfirmedCount": 0, "goldEligibleCount": 0}
        for name, content in (("agreement_report.json", json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False)),
                              ("adjudication_queue.json", json.dumps(queue, ensure_ascii=False, indent=2, allow_nan=False)),
                              ("agreement_summary.txt", text)):
            with (args.output_dir / name).open("x", encoding="utf-8") as stream:
                stream.write(content)
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
