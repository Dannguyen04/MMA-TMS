import json, hashlib, os, glob, sys
from pathlib import Path
from collections import defaultdict
S = Path(__file__).resolve().parent; OUT = Path(os.environ.get("DETECTOR_OUT", Path(__file__).resolve().parent / "out")); SRC = Path(os.environ.get("DETECTOR_SRC", Path(__file__).resolve().parent / "src")); REPO = Path(r"D:\test\ai\python-worker")
L = lambda n: json.loads((OUT / n).read_text(encoding="utf-8"))
an, ctl, gts, pairs, cf = L("analysis.json"), L("control.json"), L("gtstats.json"), L("gt_pairs.json"), L("counterfactual_isotropic.json")
head, cached, replay_only = L("headline_benchmark.json"), L("cached_benchmark_reeval.json"), L("replay_benchmark.json")
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()


def metrics(tp, fp, fn):
    return {"tp": tp, "fp": fp, "fn": fn,
            "precision": round(tp / (tp + fp), 4) if tp + fp else None,
            "recall": round(tp / (tp + fn), 4) if tp + fn else None,
            "f1": round(2 * tp / (2 * tp + fp + fn), 4) if tp + fp + fn else None}


# ---- visual review notes (frames inspected by eye; images kept in scratch) ----
VIS = {
 ("legacy_fsm", "vid_04_cage_striking:punch", "pred_2"): "Hình ảnh: người được theo dõi là VĐV quần đỏ/tóc vàng (Courtoise, đối thủ), không phải Wilson; đây là cú đấm 3,0 s của Courtoise (nhãn OUT_OF_SCOPE).",
 ("legacy_fsm", "vid_04_cage_striking:punch", "pred_3"): "Hình ảnh: đang theo dõi Courtoise (quay lưng), không phải mục tiêu.",
 ("legacy_fsm", "vid_04_cage_striking:punch", "pred_4"): "Hình ảnh: đang theo dõi Courtoise trong lúc đối thủ bay/đá quét; không phải mục tiêu.",
 ("legacy_fsm", "vid_04_cage_striking:punch", "pred_5"): "Hình ảnh: đang theo dõi Courtoise trong tình huống clinch/vật; không phải mục tiêu.",
 ("legacy_fsm", "vid_04_cage_striking:punch", "pred_6"): "Hình ảnh: đang theo dõi Courtoise trong tình huống clinch/vật; không phải mục tiêu.",
 ("legacy_fsm", "vid_02_referee_gestures:punch", "pred_1"): "Hình ảnh: trọng tài đứng yên, tay chống hông; khung xương tay dao động, không có đòn.",
 ("legacy_fsm", "vid_06_post_fight:punch", "pred_1"): "Hình ảnh: VĐV đi bộ, vung tay theo nhịp bước (chu trình 39 khung, peakSpeed 0,50).",
 ("legacy_fsm", "vid_06_post_fight:punch", "pred_2"): "Hình ảnh: người được theo dõi là người phụ/trọng tài đang chỉnh găng, không phải VĐV.",
 ("legacy_fsm", "vid_05_ground_grappling:kick", "pred_1"): "Hình ảnh: clinch/vật (vào chân, kéo chân), chuyển động chân khi vật; không phải đá.",
 ("legacy_fsm", "vid_05_ground_grappling:kick", "pred_2"): "Hình ảnh: clinch/vật, chân duỗi ra sau khi vật; không phải đá.",
 ("legacy_fsm", "vid_05_ground_grappling:kick", "pred_3"): "Hình ảnh: kiểm soát trên sàn; không phải đá.",
 ("legacy_fsm", "vid_05_ground_grappling:kick", "pred_4"): "Hình ảnh: kiểm soát trên sàn, người bị che khuất/ngoài khung; không phải đá.",
 ("shadow", "vid_04_cage_striking:punch", "shadow-punch-left-43"): "Hình ảnh (mục tiêu Wilson): tay trước duỗi ra ở khung 39–47, trước cú jab có nhãn ở khung 58; đây là lần duỗi tay chuẩn bị/dò đòn cách nhãn 250 ms.",
 ("shadow", "vid_04_cage_striking:punch", "shadow-punch-left-82"): "Hình ảnh (Wilson): giữ guard, tay dịch chuyển nhẹ; không thấy cú đấm rõ ràng.",
 ("shadow", "vid_04_cage_striking:punch", "shadow-punch-left-120"): "Hình ảnh (Wilson): guard + tay duỗi về phía trọng tài; không thấy cú đấm rõ ràng.",
 ("shadow", "vid_04_cage_striking:punch", "shadow-punch-left-335"): "Hình ảnh (Wilson): bị che khuất bởi đối thủ/trọng tài; không thấy cú đấm rõ ràng.",
 ("shadow", "vid_04_cage_striking:punch", "shadow-punch-right-347"): "Hình ảnh (Wilson): bị che khuất bởi đối thủ; không thấy cú đấm rõ ràng.",
 ("shadow", "vid_04_cage_striking:punch", "shadow-punch-left-359"): "Hình ảnh (Wilson): bị che khuất bởi đối thủ; không thấy cú đấm rõ ràng.",
}
errors = []
for e in an["errors"]:
    e = dict(e)
    note = VIS.get((e["detector"], e["scope"], e["id"]))
    if note:
        e["visual_review_note"] = note
    e["timeSec"] = round(e["timeMs"] / 1000, 2)
    errors.append(e)
# ---- taxonomy ----
tax = defaultdict(lambda: defaultdict(int))
tax_video = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
for e in errors:
    k = e["detector"] + "|" + e["type"]
    tax[k][e["category"]] += 1
    tax_video[k][e["category"]][e["video"]] += 1
# ---- aggregates ----
sc = {s["scope"]: s for s in an["scopes"]}
punch_scopes = [s for s in an["scopes"] if "punch" in s["kinds"]]


def agg(det, subset):
    return metrics(*(sum(s[det][k] for s in subset if det in s) for k in ("tp", "fp", "fn")))


TRAIN = ["vid_01_cross_heavybag:punch", "VIDEO_DATA_002:punch", "VIDEO_DATA_003:punch"]
NEG = ["vid_02_referee_gestures:punch", "vid_03_fighter_walkout:punch", "vid_05_ground_grappling:punch", "vid_06_post_fight:punch"]
aggregates = {
    "all_punch_scopes(8)": {d: agg(d, punch_scopes) for d in ("legacy_fsm", "shadow")},
    "training_scopes(vid_01,002,003)": {d: agg(d, [sc[x] for x in TRAIN]) for d in ("legacy_fsm", "shadow")},
    "negative_control_clips_only(02,03,05,06): FP count": {d: sum(sc[x][d]["fp"] for x in NEG) for d in ("legacy_fsm", "shadow")},
    "vid_04_cage": {d: {k: sc["vid_04_cage_striking:punch"][d][k] for k in ("tp", "fp", "fn")} for d in ("legacy_fsm", "shadow")}}
sens = {}
for tol in sorted({r["tolerance_ms"] for r in ctl}):
    rows = [r for r in ctl if r["tolerance_ms"] == tol and r["scope"] in TRAIN]
    sens[str(int(tol))] = {d: {"tp": sum(r["tp_real"] for r in rows if r["detector"] == d),
                               "fp": sum(r["fp_real"] for r in rows if r["detector"] == d),
                               "fn": sum(r["fn_real"] for r in rows if r["detector"] == d),
                               "chance_tp_random_mean_sum": round(sum(r["tp_random_mean"] for r in rows if r["detector"] == d), 1)}
                           for d in ("legacy_fsm", "shadow")}
# ---- hashes ----
gt_hash = {Path(p).name: sha(p) for p in sorted(glob.glob(str(SRC / "ground_truth" / "gt_*.json")))}
code_hash = {p.name: sha(p) for p in sorted(SRC.glob("*.py")) if not p.name.startswith(("test_", "scratch_"))}
code_hash.update({"pipeline/" + p.name: sha(p) for p in sorted((SRC / "pipeline").glob("*.py"))})
vids = {p.name: sha(p) for p in sorted((REPO / "validation_videos").glob("*.mp4"))}
bench_hash = {p.name: sha(p) for p in sorted((OUT / "bench").glob("*.json"))}
missing = {}
for name, f in (("VIDEO_DATA_002.mp4", "gt_punch_002_visual.json"), ("VIDEO_DATA_003.mp4", "gt_punch_003_visual.json"), ("VIDEO_DATA_005.mp4", "gt_kick_005_mixed_heavybag.json")):
    d = json.loads((SRC / "ground_truth" / f).read_text(encoding="utf-8"))
    missing[name] = {"expected_path": "D:\\test\\ai\\video-data-test\\" + name, "gt_source_sha256": d["video"].get("source_sha256"),
                     "status": "THIẾU (thư mục video-data-test không tồn tại; đã tìm trong D:\\test\\ai, Downloads, Desktop, Videos, Documents)"}
result = {
    "schema": "detector_remeasure/v1", "date": "2026-10-06",
    "setup": {
        "repo_head": "27f7e50eacf036fb7604b167d6d6883361046a22 (working tree có thay đổi chưa commit, có chủ đích)",
        "python": "3.11.15, ultralytics 8.4.146, opencv 5.0.0, numpy 2.4.6, torch 2.14.0+cpu (CPU)",
        "scratch_dir": str(S), "tolerance_ms": 350,
        "matching": "tương ứng evaluate_strike_suite: tối đa hóa số cặp 1-1 rồi tối thiểu sai số thời gian; bên trái/phải phải khớp khi đã biết",
        "model_sha256": sha(REPO / "yolov8n-pose.pt"),
        "model_sha256_recorded_2026-09-15": "c6fa93dd1ee4a2c18c900a45c1d864a1c6f7aba75d84f91648a30b7fb641d212",
        "validation_video_sha256": vids, "missing_videos": missing,
        "ground_truth_sha256": gt_hash, "code_sha256_scratch_copy": code_hash, "bench_prediction_sha256": bench_hash,
        "pose_replay_source_for_missing_videos": "python-worker/test_results/strike_final/VIDEO_DATA_00{2,3,5}.json (tọa độ làm tròn 4 chữ số). Đã kiểm tra: tọa độ của 6 clip vid_* từ suy luận mới giống hệt bản lưu (sai lệch tối đa 0).",
        "shadow_detector_note": "run_strike_suite.py gọi process_video không có training_mode nên shadowEventDetection luôn rỗng (UNSUPPORTED_OR_UNDECLARED_TRAINING_MODE). Shadow được tính lại từ cùng frame với training_mode=diagnostic_stress; đã đối chiếu bằng replay có training_mode=heavy_bag/shadow_boxing: giống hệt (002: 18/18, vid_01: 8/8, vid_04: 19/19 sự kiện)."},
    "reproduction": {
        "recorded_2026-09-15": {"punch": metrics(14, 10, 28), "kick": metrics(1, 1, 5), "overall": metrics(15, 11, 33)},
        "recorded_prediction_files_reevaluated_with_current_evaluator": {"punch": cached["expanded_by_kind"]["punch"], "kick": cached["expanded_by_kind"]["kick"], "overall": cached["expanded_overall"], "same_six_clips": cached["current_legacy_same_six_clips"]},
        "current_code_headline(fresh inference 6 clips + pose replay 002/003/005)": {"punch": head["expanded_by_kind"]["punch"], "kick": head["expanded_by_kind"]["kick"], "overall": head["expanded_overall"], "same_six_clips": head["current_legacy_same_six_clips"]},
        "current_code_all_pose_replay(9 scopes, no fresh inference)": {"punch": replay_only["expanded_by_kind"]["punch"], "kick": replay_only["expanded_by_kind"]["kick"], "overall": replay_only["expanded_overall"]},
        "match_with_recorded": "Không khớp hoàn toàn: punch TP/FN giống hệt (14/28), FP 10 → 8; kick TP 1 → 4, FP 1 → 4, FN 5 → 2.",
        "explanation": [
            "Landmark của 6 clip vid_* từ suy luận mới giống hệt bản lưu (sai lệch tối đa 0); trọng số mô hình, person_tracker.py, posture_gate.py, pose_math.py không đổi so với 15/09 (so hash sau khi chuẩn hóa CRLF). Không phải do pose.",
            "Punch: vid_05 mất 2 cú đấm (khung 373, 415) vì suppress_punches_during_kicks (kick_event_detector_v2) loại cú đấm trong lúc có cú đá; FP 10 → 8. TP/FN punch không đổi (14/28). punch_analyzer.py chỉ đổi phần guard-drop và serialize.",
            "Kick: kick_event_detector_v2.recover_kick_events + merge_kick_events (detectorVersion legacy_fsm_v1+kick_recovery_v2) nhận thêm 3 TP ở VIDEO_DATA_005 nhưng thêm 3 FP ở vid_05 (clip vật).",
            "VIDEO_DATA_002/003/005 không có video: số liệu 3 clip này là replay pose đã lưu (chẩn đoán) qua code hiện tại; replay 002/003 trùng khớp bản ghi 15/09 (4 cú đấm mỗi clip, cùng khung). Replay không bit-exact với suy luận mới (vid_03: replay ra 1 cú đấm, suy luận mới ra 0)."]},
    "per_scope": an["scopes"], "clip_context": an["clip_context"], "aggregates": aggregates,
    "tolerance_sensitivity_training_scopes": sens, "chance_control": ctl,
    "label_density": {"gt_punch_002": {"labels": 16, "pairs_le_240ms": 5, "timeline_covered_by_pm350ms": 0.59},
                      "gt_punch_003": {"labels": 20, "pairs_le_240ms": 7, "timeline_covered_by_pm350ms": 0.92}, "close_pairs": pairs},
    "gt_extension_stats": {k: {kk: vv for kk, vv in v.items() if kk != "per_label"} for k, v in gts.items()},
    "gt_extension_per_label": {k: v["per_label"] for k, v in gts.items()},
    "counterfactual_isotropic_x(exploratory, not an improvement claim)": cf,
    "errors": errors, "taxonomy_counts": tax, "taxonomy_by_video": tax_video,
}
result["recommendations_ranked"] = [
    {"rank": 0, "type": "điều kiện tiên quyết về đo lường (không phải đổi detector)",
     "title": "Sửa tín hiệu đo trước khi tin bất kỳ con số recall nào",
     "evidence": ["Nhãn VIDEO_DATA_003: 20 nhãn/9,3 s, dung sai ±350 ms phủ 92% trục thời gian; shadow 14 TP so với ngẫu nhiên trung bình 12,4 (p95 15) và legacy 4 TP so với 3,5.",
                  "VIDEO_DATA_002 phủ 59%: shadow 14 TP so với ngẫu nhiên 8,1 (p95 11) nên có tín hiệu thật; legacy 4 TP nằm ở mức ngẫu nhiên (p95 4), 4 TP lệch 160–280 ms.",
                  "19/28 nhãn đấm bị FN của legacy nằm cách một nhãn khác ≤240 ms; nhãn là bản tạm, một người rà soát."],
     "action": "Rà soát nhãn độc lập (đặc biệt các cặp ≤240 ms), báo cáo thêm dung sai 100–150 ms và bài kiểm tra ngẫu nhiên/dịch thời gian kèm mọi bảng P/R/F1, tách tập phát triển khỏi tập giữ lại."},
    {"rank": 1, "type": "đổi detector", "title": "Chuẩn hóa hình học: độ vươn/tốc độ/khuỷu theo đơn vị thân người và tọa độ đẳng hướng",
     "fn_covered": "17/28 FN đấm của legacy (15 FSM_EXTENSION_CRITERIA_NOT_MET + 2 NO_LAUNCH_EXTENSION_SPEED_BELOW_0.5), cả 17 ở hai clip ngang 16:9 VIDEO_DATA_002/003",
     "evidence": ["15/15 chu trình bị hủy có khuỷu tối đa <135°; 13/15 có độ dịch vươn tay 0,02–0,05 <0,07 và <30% chiều dài tay.",
                  "Trong ±350 ms quanh các nhãn bị bỏ sót, biên độ vươn tay theo đơn vị FSM chỉ 0,024–0,087 và tốc độ vươn tối đa 0,23–0,53 u/s (ngưỡng 0,07 và 0,5).",
                  "FSM dùng x,y chuẩn hóa không đẳng hướng (TECH-DEBT POSE-GEOMETRY-001 trong pose_math.py): clip 16:9 chỉ thấy 56% chuyển động ngang; vid_01 (dọc 1080x1920) cho 5/5, còn hai clip ngang có nhãn dày chỉ 8/36.",
                  "Thí nghiệm giả định (chỉ nhân x với tỉ lệ khung, không đổi ngưỡng, không phải kết luận cải thiện): VIDEO_DATA_002 TP 4→8, VIDEO_DATA_003 4→4, vid_01 5→4, FP tổng 8→12. Một mình hình học chưa đủ."],
     "action": "Đo độ vươn theo chiều dài thân, tọa độ nhân tỉ lệ khung; dùng góc khuỷu 2D chỉ như bằng chứng phụ. Hiệu chỉnh ngưỡng trên tập huấn luyện riêng, kiểm trên tập giữ lại."},
    {"rank": 2, "type": "đổi detector", "title": "Đếm sự kiện theo đỉnh vươn tay của từng tay, không bắt buộc chu trình guard→guard",
     "fn_covered": "10/28 FN đấm của legacy (3 FSM_ONE_CYCLE_COVERS_SEVERAL_STRIKES, 3 FSM_NO_RETURN_TO_GUARD_WITHIN_1200ms, 3 FSM_ARM_BUSY_IN_OLDER_CYCLE, 1 CONSUMED_BY_NEIGHBOUR)",
     "evidence": ["FSM yêu cầu về guard (hoặc rút ≥35%) rồi mới phát sự kiện, hủy sau 1200 ms, nghỉ 200 ms; 3 nhãn VIDEO_DATA_003 (khung 72–86) bị hủy vì tay không về guard trong 1200 ms (khuỷu đạt 154–158°).",
                  "Shadow (đỉnh theo từng tay) bắt 33/41 nhãn ở 3 clip huấn luyện (dung sai 350 ms); ở 150 ms vẫn 29/41 so với ngẫu nhiên ≈13,8.",
                  "Trong 12 cặp nhãn ≤240 ms, 5 cặp có đỉnh ở cả hai tay (một-hai plausible), 7 cặp chỉ có một đỉnh: cần xác minh nhãn trước khi kết luận."],
     "action": "Tách bước phát hiện sự kiện (đỉnh vươn tay mỗi tay) khỏi bước dựng chu trình/chấm kỹ thuật; chu trình chỉ làm bằng chứng chất lượng."},
    {"rank": 3, "type": "đổi detector/tracker", "title": "Giữ precision khi mở rộng recall: khóa danh tính và cổng ngữ cảnh",
     "fp_covered": "legacy: 12/12 FP (5 sai người ở vid_04, 7 chuyển động không phải đòn); shadow: 52/70 FP (41 ở clip đối chứng, 11 sai người ở vid_04)",
     "evidence": ["vid_04: người theo dõi đổi từ Wilson (da sẫm) sang Courtoise (da sáng) quanh khung 137–148, cờ gián đoạn 137/140/148, 319/326, 472…; cả 5 FP legacy và 1 FN đá nằm sau khi đổi người (độ xám thân ≥150).",
                  "Chuyển động không phải đòn: vung tay khi đi bộ (vid_06 4,59 s, chu trình 39 khung), người phụ chỉnh găng bị theo dõi (vid_06 6,04 s), trọng tài tay chống hông (vid_02 2,3 s), 4 cú đá giả khi vật/kiểm soát sàn (vid_05; 3/4 do kick_event_detector_v2 thêm).",
                  "Shadow chỉ yêu cầu độ nổi ≥0,04 thân người nên 18 FP ở clip trọng tài và 18 ở clip sau trận."],
     "action": "Kiểm tra lại danh tính sau mỗi gián đoạn (mô tả ngoại hình/kích thước thân), từ chối sự kiện ngay sau gián đoạn danh tính; thêm cổng tư thế/ngữ cảnh cho kick_event_detector_v2 (clinch/sàn) và bộ lọc vung tay khi đi bộ."},
]
result["limitations"] = [
    "VIDEO_DATA_002/003/005 không có video: số liệu của 3 clip này là replay pose đã lưu (toạ độ làm tròn 4 chữ số), không phải suy luận mới; không xem được ảnh nguồn nên các FN ở 002/003 không được kiểm bằng mắt.",
    "Nhãn mở rộng là dữ liệu chẩn đoán, một người rà soát; không phải tập kiểm độc lập. Không tinh chỉnh ngưỡng theo nhãn.",
    "Phân loại lỗi là luật quy tắc theo thứ tự ưu tiên; bằng chứng số đi kèm từng lỗi. Nhận diện danh tính ở vid_04 dựa trên độ xám thân người, đã đối chiếu bằng mắt ở các khung 0/52/58/64/177/284/312/385/413.",
    "Bài kiểm tra ngẫu nhiên dùng 500 lượt (seed 0) và 20 phép dịch thời gian vòng; thể hiện mức tình cờ, không phải khoảng tin cậy.",
    "Thí nghiệm tọa độ đẳng hướng là giả định chẩn đoán trên cùng nhãn phát triển, không phải bằng chứng cải thiện.",
    "kick_event_detector_v2 không bị cổng training_mode chặn; shadow chỉ chạy khi training_mode là heavy_bag/shadow_boxing/diagnostic_stress, và run_strike_suite.py hiện không truyền training_mode.",
]
result["tools_sha256"] = {p.name: sha(p) for p in sorted(Path(__file__).resolve().parent.glob("*.py"))}
Path(sys.argv[1]).write_text(json.dumps(result, indent=1, ensure_ascii=False), encoding="utf-8")
print(json.dumps({"aggregates": aggregates, "sens": sens, "tax": tax}, indent=1, ensure_ascii=False))
