# T-022 Handover

- Nhánh: `feat/T-022-punch-detector-recall`.
- Commit: `9daf8a7` (bộ đo/test), `bfd4d93` (baseline). Báo cáo cuối và handover ở commit chứa file này.
- Trạng thái: **IN REVIEW — KHÔNG ĐẠT** (kết quả âm tính theo tiêu chí 8).

## Thay đổi

- `python-worker/evaluate_punch_recall.py`: bổ sung tie-break Macro F1 trước ưu tiên họ; bỏ giới hạn FP riêng trên hai clip có đòn vì giao thức chỉ đặt trần riêng trên bốn clip âm. Macro F1 là trung bình F1 sự kiện theo IoU trên tám video DEV, không phải F1 phân loại. Không tie-break nào ảnh hưởng kết quả vì cả 12 ứng viên bị loại ở ràng buộc cứng. Lưu đầy đủ DEV, hash cấu hình/cache/giao thức, marker độc quyền trước TEST cuối.
- Chỉ số phụ vẫn gọi `evaluate_intervals(min_iou=0.1)`, kể cả dự đoán rỗng. Dùng cùng một token lớp hợp lệ nội bộ để tính chỉ số sự kiện với nhãn PUNCH; không báo cáo kết quả phân loại của helper.
- Bộ đọc CSV lọc cửa sổ trước khi kiểm tra khoảng: V10 dòng CSV 123 là `9760,9723,Lead Hook`, đảo đầu/cuối nhưng nằm hoàn toàn ngoài `[4000,5500)`. Không sửa/đảo nhãn; nhãn lỗi trong cửa sổ vẫn gây lỗi. V4/V6/V10 có đúng 71/85/39 nhãn theo giao thức.
- `python-worker/test_evaluate_punch_recall.py`: thêm test đường tăng matching, nhãn lỗi ngoài/trong cửa sổ, IoU với dự đoán rỗng, tie-break F1 và ràng buộc chọn.
- `benchmark_results/punch_recall_t022_baseline.json`: C00 DEV/TEST, commit riêng trước thử ứng viên.
- `benchmark_results/punch_recall_t022_dev.json`: C00 và đúng C01–C12 chỉ trên DEV.
- `benchmark_results/punch_recall_t022_final.json`: đủ DEV của 12 ứng viên, lý do loại, TEST cuối, timestamp/hash cấu hình và đối chiếu tiêu chí. `selected_eligible_candidate_id=null`.
- Không thêm `PUNCH_DETECTOR`; không sửa detector, worker, tracker. Sau khi lưu TEST, chỉ bỏ hai dấu checkmark trong dòng in CLI để tránh lỗi console cp1252; giữ hash mã đo gốc, ghi hash mới ở `post_evaluation_cli_fix`.

## Kết quả

| Tập | Baseline C00 | Final C00 dự phòng |
| --- | --- | --- |
| Adam | 8/18 (44,44%) | 8/18 (DEV đã đo) |
| DEV-2 | 6 TP / 6 FP / 0 FN | 6 TP / 6 FP / 0 FN |
| V4 `[19000,20500)` | 0/71 | 0/71 (DEV đã đo) |
| DEV gộp | 14/95 (14,74%) | 14/95 |
| V6 `[36500,38000)` | 0/85 | 0/85 |
| V10 `[4000,5500)` | 0/39 | 0/39 |
| TEST gộp | 0/124 (0%) | 0/124 (0%), tăng 0 điểm phần trăm |
| Dư chưa kiểm chứng TEST / 1.000 khung | 0 | 0 |

Mục tiêu chọn ở §4 dùng Adam + V4: baseline 8/89 (8,99%). Không ứng viên nào qua ràng buộc cứng để xếp hạng.

| Ứng viên | Adam TP/18 | V4 TP/71 | DEV-2 FP | DEV-2 FN | Kết luận |
| --- | --- | --- | --- | --- | --- |
| C01_fsm_mild_relax | 10 | 0 | 9 | 0 | Loại |
| C02_fsm_moderate_relax | 8 | 0 | 11 | 0 | Loại |
| C03_fsm_fast_combo | 10 | 0 | 10 | 0 | Loại |
| C04_fsm_angle_only | 10 | 0 | 7 | 0 | Loại |
| C05_fsm_deep_combo | 12 | 1 | 18 | 0 | Loại |
| C06_v2_default | 12 | 0 | 4 | 5 | Loại |
| C07_v2_sensitive | 14 | 0 | 10 | 4 | Loại |
| C08_v2_conservative | 9 | 0 | 1 | 6 | Loại |
| C09_v2_moderate | 13 | 0 | 9 | 5 | Loại |
| C10_shadow_default | 8 | 43 | 41 | 0 | Loại |
| C11_shadow_conservative | 5 | 15 | 11 | 1 | Loại |
| C12_shadow_moderate | 5 | 27 | 29 | 0 | Loại |

FSM nới ngưỡng tăng FP (7–18 so với 6); V2 có FN (4–6); shadow tăng FP (11–41, C11 còn FN=1). C10 đạt 43/71 trên V4 nhưng gây 41 FP trên DEV-2. V4 có 1.500/1.500 khung chứa 17 landmarks, observation fresh và posture standing; FSM ghi guard=1.431, extending=69, không tới impact. Quan sát này không chứng minh pose đủ confidence hay đúng người. Giả thuyết ngưỡng hình học/chu trình FSM chặn impact phù hợp phần chẩn đoán 17/28 trong ticket, chưa phải kết luận nhân quả. Không sửa tracker; không đọc thêm archive ngoài phạm vi được giao.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. Baseline commit riêng, đủ hash/số tham chiếu | `bfd4d93`, `benchmark_results/punch_recall_t022_baseline.json:1`; bộ đo `evaluate_punch_recall.py:791`, hash cấu hình dòng 935. Adam 8/18, DEV-2 6/6/0 đúng. |
| 2. Đủ cấu hình, tối đa 12 | `punch_recall_t022_final.json:1`, `dev_reports` và `dev_eligibility`: đúng 12 C01–C12. |
| 3. TEST tăng >=10 điểm %, từng video không giảm | **KHÔNG ĐẠT**: C00 cuối 0/124, tăng 0 điểm %. V6/V10 không giảm nhưng không cải thiện. Không ứng viên hợp lệ. |
| 4. DEV-2 FN=0, FP<=6, không tăng detection trên clip âm | **Không ứng viên nào đạt**; xem `dev_eligibility`. C00 giữ 6/6/0, clip âm giữ 3/0/1/1. |
| 5. Dư chưa kiểm chứng TEST không tăng >25% | C00 dự phòng: 0 -> 0 trên 3.000 khung, không tăng. Tỷ lệ tương đối không xác định khi baseline=0. |
| 6. TEST cuối đúng một lần, thời gian/hash | `evaluate_punch_recall.py:1097`, marker độc quyền; `test_execution`, `configuration_sha256` trong final. TEST C00 cuối đúng một lần sau DEV, tách biệt lượt C00 baseline mà ticket yêu cầu. Không chạy TEST với ứng viên bị loại. |
| 7. Giới hạn độc lập/phân loại | Phần lịch sử/giới hạn bên dưới. |
| 8. Báo cáo âm tính | **KHÔNG ĐẠT**, số liệu và phân tích trên, không nới tiêu chí. |
| 9. Mặc định legacy, đầu ra giữ nguyên | Không tích hợp do 3/4 thất bại. Hash worker/ba detector/tracker trùng baseline; sáu clip có cùng start/impact/end so với cache. detectorVersion là legacy_fsm_v1, hậu tố kick_recovery_v2 ở vid_04/05 theo worker hiện có. Cache là đầu ra detector trước chuẩn hóa nên không dùng để chứng minh full punches JSON giống hệt worker trước/sau; chưa có đối chiếu full JSON trước ticket, không suy luận lại Adam. |
| 10. Test quy tắc mới/cũ | `test_evaluate_punch_recall.py:152`, `:161`, `:169`, `:189`, `:200`; bộ đo 10/10 và bộ bắt buộc 66/66 qua. |

## Lịch sử và giới hạn

Đã kiểm tra lịch sử đúng ba file detector bằng:

```powershell
git log --format="%h %ad %s" --date=short -- python-worker/punch_analyzer.py python-worker/punch_event_detector_v2.py python-worker/pipeline/strike_events.py
git log -p --format="%h %s" -- python-worker/punch_analyzer.py python-worker/punch_event_detector_v2.py python-worker/pipeline/strike_events.py | Select-String -Pattern 'V4|V6|V10|BoxingVI|boxingvi|threshold|ngưỡng' | Select-Object -Last 40
```

Lịch sử hiện có: `ddfabe7` (05/10), `7e33882` (29/09), `c838940` (23/09), `b5c61e5` (17/09), `49d1ad5`, `d102b1d` (15/09), `701bcee` (12/09). Không thấy tham chiếu V4/V6/V10/BoxingVI gắn với chỉnh ngưỡng trong lịch sử ba file. Không suy ra chưa từng dùng dữ liệu ở thử nghiệm ngoài git. Theo ticket, V4/V6/V10 từng dùng chỉnh tracker và chẩn đoán classifier nên TEST là **gần độc lập, không độc lập hoàn toàn**.

BoxingVI chỉ đo recall; unmatched là **dư chưa kiểm chứng**, không gọi FP. Adam thuộc dữ liệu huấn luyện classifier, chỉ dùng đo sự kiện. Không chứng minh độ chính xác loại đòn, tay hay chấm kỹ thuật. FPS lấy riêng từ từng cache/video. Adam cache có 597 khung giải mã (ticket mô tả 600); giữ cache, đủ 18 nhãn và đúng 8 TP. Adam có 13 detection, 8 ghép nên 5 unmatched gồm cả detection trùng không được ghép, không đồng nghĩa 5 detection ngoài mọi nhãn.

## Lệnh đã chạy

Lệnh Python chạy trong `python-worker` bằng `.\.venv\Scripts\python.exe`. Ba lệnh kiểm tra bắt buộc chạy đúng một lần ở cuối. Không cài thư viện, không push/merge/đổi nhánh. Dùng lệnh PowerShell trực tiếp, không tạo background job/helper. Dưới đây là nguyên văn phần cuối output đã lưu (tối đa 40 dòng/lệnh).

Pytest bộ đo ban đầu: 5 passed. Sau thêm regression test có một lần 1 failed / 9 passed do token lớp PUNCH trong helper; đã sửa trước commit `9daf8a7`, kết quả cuối bên dưới.

`.\.venv\Scripts\python.exe -m pytest -q test_evaluate_punch_recall.py`

```text
..........                                                               [100%]
10 passed in 0.56s
```

`extract_video_window_data(V4, 19000, 1500, cache) — python stdin`

```text
Extracting 1500 frames from IVvOmoB88FM.mp4 (start=19000)...
  [IVvOmoB88FM.mp4] Frame 100/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 200/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 300/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 400/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 500/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 600/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 700/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 800/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 900/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 1000/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 1100/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 1200/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 1300/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 1400/1500 extracted...
  [IVvOmoB88FM.mp4] Frame 1500/1500 extracted...
DEV-3 cache: IVvOmoB88FM_19000_1500.json frames= 1500 fps= 23.976023976023978
```

`.\.venv\Scripts\python.exe evaluate_punch_recall.py --run-baseline`

```text
=== Running Baseline (C00_legacy_baseline) on DEV ===
=== Running Baseline (C00_legacy_baseline) on TEST ===
Extracting 1500 frames from cQW-h8yGbRc.mp4 (start=36500)...
  [cQW-h8yGbRc.mp4] Frame 100/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 200/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 300/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 400/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 500/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 600/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 700/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 800/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 900/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 1000/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 1100/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 1200/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 1300/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 1400/1500 extracted...
  [cQW-h8yGbRc.mp4] Frame 1500/1500 extracted...
Extracting 1500 frames from OfZFdwW322E.mp4 (start=4000)...
  [OfZFdwW322E.mp4] Frame 100/1500 extracted...
  [OfZFdwW322E.mp4] Frame 200/1500 extracted...
  [OfZFdwW322E.mp4] Frame 300/1500 extracted...
  [OfZFdwW322E.mp4] Frame 400/1500 extracted...
  [OfZFdwW322E.mp4] Frame 500/1500 extracted...
  [OfZFdwW322E.mp4] Frame 600/1500 extracted...
  [OfZFdwW322E.mp4] Frame 700/1500 extracted...
  [OfZFdwW322E.mp4] Frame 800/1500 extracted...
  [OfZFdwW322E.mp4] Frame 900/1500 extracted...
  [OfZFdwW322E.mp4] Frame 1000/1500 extracted...
  [OfZFdwW322E.mp4] Frame 1100/1500 extracted...
  [OfZFdwW322E.mp4] Frame 1200/1500 extracted...
  [OfZFdwW322E.mp4] Frame 1300/1500 extracted...
  [OfZFdwW322E.mp4] Frame 1400/1500 extracted...
  [OfZFdwW322E.mp4] Frame 1500/1500 extracted...
✅ Baseline saved to D:\test\ai-worktrees\T-022\python-worker\benchmark_results\punch_recall_t022_baseline.json
```

`Tóm tắt baseline từ JSON, không suy luận`

```text
dev_baseline {'total_gt': 95, 'tp': 14, 'fn': 81, 'combined_recall': 0.1474, 'total_unverified_excess': 5, 'unverified_excess_per_1000_frames': 2.384}
DEV-1 TP/GT 8 18 FP None FN 10 excess 5
DEV-2 TP/GT 6 6 FP 6 FN 0 excess None
DEV-3 TP/GT 0 71 FP None FN 71 excess 0
test_baseline {'total_gt': 124, 'tp': 0, 'fn': 124, 'combined_recall': 0.0, 'total_unverified_excess': 0, 'unverified_excess_per_1000_frames': 0.0}
TEST-1 TP/GT 0 85 FP None FN 85 excess 0
TEST-2 TP/GT 0 39 FP None FN 39 excess 0
```

`.\.venv\Scripts\python.exe evaluate_punch_recall.py --run-dev-candidates`

```text
=== Evaluating All Candidate Configurations on DEV ===
--> Evaluating C00_legacy_baseline...
    Adam TP=8/18, V4 TP=0/71, Combined Recall=9.0%, DEV-2 FP=6, FN=0
--> Evaluating C01_fsm_mild_relax...
    Adam TP=10/18, V4 TP=0/71, Combined Recall=11.2%, DEV-2 FP=9, FN=0
--> Evaluating C02_fsm_moderate_relax...
    Adam TP=8/18, V4 TP=0/71, Combined Recall=9.0%, DEV-2 FP=11, FN=0
--> Evaluating C03_fsm_fast_combo...
    Adam TP=10/18, V4 TP=0/71, Combined Recall=11.2%, DEV-2 FP=10, FN=0
--> Evaluating C04_fsm_angle_only...
    Adam TP=10/18, V4 TP=0/71, Combined Recall=11.2%, DEV-2 FP=7, FN=0
--> Evaluating C05_fsm_deep_combo...
    Adam TP=12/18, V4 TP=1/71, Combined Recall=14.6%, DEV-2 FP=18, FN=0
--> Evaluating C06_v2_default...
    Adam TP=12/18, V4 TP=0/71, Combined Recall=13.5%, DEV-2 FP=4, FN=5
--> Evaluating C07_v2_sensitive...
    Adam TP=14/18, V4 TP=0/71, Combined Recall=15.7%, DEV-2 FP=10, FN=4
--> Evaluating C08_v2_conservative...
    Adam TP=9/18, V4 TP=0/71, Combined Recall=10.1%, DEV-2 FP=1, FN=6
--> Evaluating C09_v2_moderate...
    Adam TP=13/18, V4 TP=0/71, Combined Recall=14.6%, DEV-2 FP=9, FN=5
--> Evaluating C10_shadow_default...
    Adam TP=8/18, V4 TP=43/71, Combined Recall=57.3%, DEV-2 FP=41, FN=0
--> Evaluating C11_shadow_conservative...
    Adam TP=5/18, V4 TP=15/71, Combined Recall=22.5%, DEV-2 FP=11, FN=1
--> Evaluating C12_shadow_moderate...
    Adam TP=5/18, V4 TP=27/71, Combined Recall=36.0%, DEV-2 FP=29, FN=0

Best Candidate Selected by Protocol: C00_legacy_baseline; DEV reports: D:\test\ai-worktrees\T-022\python-worker\benchmark_results\punch_recall_t022_dev.json
```

`.\.venv\Scripts\python.exe evaluate_punch_recall.py --run-final --candidate C00_legacy_baseline`

```text
=== Running Final Evaluation on TEST with chosen candidate: C00_legacy_baseline ===
Traceback (most recent call last):
  File "D:\test\ai-worktrees\T-022\python-worker\evaluate_punch_recall.py", line 1133, in <module>
    main()
  File "D:\test\ai-worktrees\T-022\python-worker\evaluate_punch_recall.py", line 1118, in main
    print(f"\u2705 Final test evaluation saved to {out_path}", flush=True)
  File "C:\Users\DAN\AppData\Roaming\uv\python\cpython-3.11-windows-x86_64-none\Lib\encodings\cp1252.py", line 19, in encode
    return codecs.charmap_encode(input,self.errors,encoding_table)[0]
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
UnicodeEncodeError: 'charmap' codec can't encode character '\u2705' in position 0: character maps to <undefined>
```

`.\.venv\Scripts\python.exe -m pytest -q test_evaluate_punch_recall.py test_punch_analyzer.py test_punch_event_detector_v2.py test_shadow_punch_expansion.py test_pipeline.py test_person_tracker.py test_worker_delivery.py test_release_safety.py`

```text
..................................................................       [100%]
66 passed in 4.33s
```

`.\.venv\Scripts\python.exe run_strike_suite.py --validation-only --output test_results/strike_t022_after`

```text
Processing vid_01_cross_heavybag.mp4
{'video': 'vid_01_cross_heavybag.mp4', 'frames': 608, 'punches': 5, 'kicks': 0, 'source_sha256': '6f425915fdf4d36eef342adc8d9017e421b22345ad0a7aa64cc1654e7d665175'}
Processing vid_02_referee_gestures.mp4
{'video': 'vid_02_referee_gestures.mp4', 'frames': 719, 'punches': 3, 'kicks': 0, 'source_sha256': '47787bd98afaf61c1ef15b4a1dc363a46127c85e15a87d368e29ddadba6c3ac7'}
Processing vid_03_fighter_walkout.mp4
{'video': 'vid_03_fighter_walkout.mp4', 'frames': 719, 'punches': 0, 'kicks': 0, 'source_sha256': 'ae8700f51fd2650c3c8000736482fcf0341093d979ab8c60edb502266d49f92c'}
Processing vid_04_cage_striking.mp4
{'video': 'vid_04_cage_striking.mp4', 'frames': 719, 'punches': 2, 'kicks': 1, 'source_sha256': '3df39b333eead2f1b2e244a5622d2d169229a9f75cae0c6ca426f1423053d70c'}
Processing vid_05_ground_grappling.mp4
{'video': 'vid_05_ground_grappling.mp4', 'frames': 719, 'punches': 1, 'kicks': 2, 'source_sha256': '643ab5c729cdf4648ea0b24030a1fa165266aa889a907b5f8901c40591a46bd7'}
Processing vid_06_post_fight.mp4
{'video': 'vid_06_post_fight.mp4', 'frames': 719, 'punches': 1, 'kicks': 0, 'source_sha256': 'e3c62fce8e0e8a2143051b7bc488b878021cdce00cac16531d4b304121b86168'}
```

`.\.venv\Scripts\python.exe evaluate_punch_recall.py --help`

```text
usage: evaluate_punch_recall.py [-h]
                                [--split {dev,test,dev-1,dev-2,dev-3,all}]
                                [--candidate CANDIDATE]
                                [--cache-dir CACHE_DIR] [--output OUTPUT]
                                [--run-baseline] [--run-dev-candidates]
                                [--run-final]

evaluate_punch_recall.py � Deterministic recall evaluation for punch detectors
(T-022). Implements the frozen evaluation protocol: 1. Ground truth interval
[start_frame, end_frame] recognized if impactFrame in [start_frame - 3,
end_frame + 3]. 2. One-to-one bipartite matching (maximum cardinality, then
minimum distance to interval midpoint). 3. Primary metric: recall = recognized
intervals / total ground truth intervals. 4. Secondary metric: interval IoU
(min_iou=0.1) via pipeline/boxing_research.py. 5. Reporting: - DEV-2
(vid_01..06): unmatched predictions reported as False Positives (FP). -
BoxingVI (V4, V6, V10): unmatched predictions reported as unverified excess
(not FP). - Duplicate detections (>= 2 predictions in interval). - Video,
label, code and configuration hashes.

options:
  -h, --help            show this help message and exit
  --split {dev,test,dev-1,dev-2,dev-3,all}
  --candidate CANDIDATE
                        Candidate configuration ID
  --cache-dir CACHE_DIR
  --output OUTPUT       Output JSON path
  --run-baseline        Run baseline on DEV and TEST and save
                        punch_recall_t022_baseline.json
  --run-dev-candidates  Evaluate all 12 candidate configurations on DEV and
                        print ranking
  --run-final           Run TEST exactly once with selected candidate and save
                        punch_recall_t022_final.json
```

`evaluate_punch_detector.run_evaluation_suite(pairs) — 350 ms, product; chỉ chấm JSON có sẵn`

```text
run_evaluation_suite: {"total_videos": 6, "total_gt": 6, "total_pred": 12, "tp": 6, "fp": 6, "fn": 0, "precision": 0.5, "recall": 1.0, "f1": 0.6667}
vid_01_cross_heavybag.mp4 5 0 0
vid_02_referee_gestures.mp4 0 3 0
vid_03_fighter_walkout.mp4 0 0 0
vid_04_cage_striking.mp4 1 1 0
vid_05_ground_grappling.mp4 0 1 0
vid_06_post_fight.mp4 0 1 0
COMPATIBILITY PASS: 6 TP / 6 FP / 0 FN; existing outputs only, no inference.
```

`Đối chiếu sự kiện/hash mã từ cache và JSON, không suy luận`

```text
EVENT COMPARISON PASS: all six clips have identical start/impact/end frames vs cache.
SOURCE HASH PASS: process_video, detectors and tracker unchanged from frozen baseline.
FULL WORKER JSON COMPARISON: unavailable; cache is before worker sanitization. Adam not re-inferred.
```

Strike suite exit 0; `report.json` có `punch_validation.overall` = 6 TP / 6 FP / 0 FN. `run_evaluation_suite` chấm lại JSON có sẵn xác nhận cùng số liệu, không suy luận. Lần gọi chẩn đoán đầu truyền cặp GT/pred sai thứ tự trả 0 GT/0 pred, không dùng; đã sửa thành (prediction_path, ground_truth_path), thêm assert 6/6/0, log đúng ở trên. Đây là chấm DEV-2, không chạy lại TEST.

`--run-final` exit 1 sau khi ghi xong JSON do in checkmark ra cp1252. Đã kiểm tra JSON đầy đủ, marker/timestamp, chỉ sửa hai dòng in sang ASCII, không chạy lại TEST lấy exit 0. Bộ kiểm tra bắt buộc và help chạy sau sửa console. `code_hashes` giữ hash lúc đo, `post_evaluation_cli_fix` ghi hash mới. Lệnh soạn handover ban đầu dùng `python` hệ thống không có sẵn; đã dùng lại đúng Python `.venv`, không cài gì.

Hai kết quả chính:

- `python-worker/benchmark_results/punch_recall_t022_baseline.json`
- `python-worker/benchmark_results/punch_recall_t022_final.json`

Cache ở `python-worker/test_results/t022_inference/`: giữ Adam/vid_01…06 có sẵn, thêm đúng V4/V6/V10. Chỉ strike suite bắt buộc chạy worker lại sáu clip theo yêu cầu ticket; baseline/candidates/final đều dùng cache. Không commit video/cache.

Đối chiếu tính nhất quán JSON và hash (chỉ đọc dữ liệu đã có):

```text
ARTIFACT AUDIT PASS: baseline/final, 12 rejected candidates, configuration/protocol/label/cache hashes consistent; TEST once.
```

`git diff --check`: exit 0, không có output.

## Lệch so với ticket

Không có cấu hình đủ điều kiện từ C01–C12. Dùng nhánh dự phòng sẵn có của script chạy C00 TEST cuối đúng một lần để hoàn tất báo cáo: đây là **tham chiếu giữ nguyên**, không phải ứng viên cải thiện được chọn. `selected_eligible_candidate_id=null`; ứng viên bị loại chỉ có DEV. Đây là xử lý trường hợp tập ứng viên hợp lệ rỗng, không đổi cửa sổ/cấu hình/quy tắc chọn đã chấp nhận. Kết luận âm tính và không tích hợp theo tiêu chí 8.

Chưa kiểm chứng full worker punches JSON trước/sau trên Adam/sáu clip vì cache là đầu ra trước chuẩn hóa. Đã đối chiếu source hash không đổi, sự kiện sáu clip bằng nhau và baseline khớp số tham chiếu. Không suy luận lại Adam để tuân thủ yêu cầu dùng cache.

## Câu hỏi / việc còn mở

- Claude review kết quả âm tính. Nếu tái lập TEST để review, dùng bản sao cache riêng không có `final_test_started.json`; giữ nguyên marker/kết quả gốc, không dùng lượt review chọn cấu hình khác.
- Muốn thử thêm cấu hình/tăng recall cần ticket và giao thức mới; không nới FP/FN trong T-022.
