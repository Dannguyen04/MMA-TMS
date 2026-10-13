# Đo lại detector đấm/đá và phân tích lỗi — 2026-10-06

Chạy lại benchmark đòn mở rộng (`STRIKE_BENCHMARK_REPORT.md`) bằng code hiện tại, chấm
detector shadow `detect_punch_events` trên cùng nhãn, rồi phân loại từng FN/FP. Không đổi
detector, không đổi ngưỡng, không đổi nhãn. Số liệu máy đọc được:
`python-worker/benchmark_results/detector_remeasure_20261006.json`.

## Kết luận ngắn

1. **Không khớp hoàn toàn với số đã ghi.** Đấm giữ nguyên TP/FN (14/28), FP 10 → 8. Đá TP 1 → 4,
   FP 1 → 4, FN 5 → 2. Nguyên nhân là `kick_event_detector_v2` (thêm sau 15/09), không phải pose:
   landmark 6 clip suy luận mới giống hệt bản lưu. Tổng: P 60,0% R 37,5% F1 46,2% (trước 57,7 / 31,3 / 40,5).
2. **Recall đấm của legacy bị chặn bởi ngưỡng hình học, không phải pose.** 17/28 FN đấm
   (61%) là chu trình FSM bị hủy vì không đạt ngưỡng vươn tay/khuỷu/tốc độ, tất cả ở hai clip
   ngang 16:9. Thiếu/che pose chỉ giải thích 2/30 FN (1 đấm, 1 đá).
3. **Shadow có recall cao hơn nhiều nhưng precision thấp và tín hiệu đo yếu.** Trên 3 clip có đòn
   thật (vid_01, 002, 003): legacy 13/0/28, shadow 33/10/8 (TP/FP/FN). Trên 4 clip không có đòn,
   shadow phát 42 FP, legacy 3. Với VIDEO_DATA_003, 14 TP của shadow ngang mức ngẫu nhiên
   (trung bình 12,4, p95 15). Số đẹp ở 003 **không phải bằng chứng**.
4. **Thiếu video:** `VIDEO_DATA_002/003/005.mp4` không có trong máy. Ba clip này chỉ đo bằng replay
   pose đã lưu.
5. Mục tiêu P/R/F1 ≥ 0,90 còn xa: tốt nhất đo được là F1 46,2% (legacy, mở rộng) hoặc 78,6% (shadow,
   chỉ clip huấn luyện, chưa trừ mức tình cờ).

## 1. Thiết lập

| Mục | Giá trị |
| --- | --- |
| Mã | HEAD `27f7e50` + working tree chưa commit, sao chép `*.py`, `pipeline/`, `ground_truth/` sang thư mục riêng; không đụng file repo |
| Môi trường | `.venv` của repo: Python 3.11.15, ultralytics 8.4.146, opencv 5.0.0, CPU |
| Mô hình | `yolov8n-pose.pt` sha256 `c6fa93dd…d641d212`, trùng bản ghi 15/09 |
| Dung sai / ghép | 350 ms, ghép một-một tối đa rồi tối thiểu sai số, kiểm bên trái/phải khi biết (`strike_benchmark.py`, `evaluate_strike_suite.py` không đổi) |
| Suy luận mới | 6 clip `validation_videos/vid_*.mp4` (4.203 khung). `vid_04`, `vid_05` trùng sha256 ghi trong nhãn |
| **Video thiếu** | `D:\test\ai\video-data-test\VIDEO_DATA_002/003/005.mp4` (thư mục không tồn tại; đã tìm trong `D:\test\ai`, Downloads, Desktop, Videos, Documents). sha256 mong đợi của 002/003 nằm trong nhãn |
| Cách thay thế | Replay pose lưu ở `test_results/strike_final/VIDEO_DATA_00{2,3,5}.json` (tọa độ làm tròn 4 chữ số) qua code hiện tại, bằng `replay_strikes.replay` |
| Tin cậy của replay | Với 6 clip có video, landmark suy luận mới và bản lưu giống hệt (sai lệch tối đa 0); replay 002/003 cho đúng 4 cú đấm/clip cùng khung như bản ghi 15/09. Replay không bit-exact: vid_03 replay ra 1 cú đấm, suy luận mới ra 0 |
| Shadow | `run_strike_suite.py` không truyền `training_mode` nên `shadowEventDetection` luôn rỗng (`UNSUPPORTED_OR_UNDECLARED_TRAINING_MODE`). Tính lại từ cùng frame với `diagnostic_stress`; so với replay có `heavy_bag`/`shadow_boxing` ra đúng cùng sự kiện (002: 18/18, vid_01: 8/8, vid_04: 19/19) |

Code đã đổi từ 15/09 (so hash sau khi chuẩn hóa CRLF): `process_video.py`, `kick_analyzer.py`,
`punch_analyzer.py` (chỉ phần guard-drop và serialize), `technique_rubric.py`. Không đổi:
`pose_math.py`, `person_tracker.py`, `posture_gate.py`, hai file evaluator.

## 2. Tái lập benchmark mở rộng (9 clip, 48 nhãn)

| Nguồn | Đấm TP/FP/FN | Đấm P / R / F1 | Đá TP/FP/FN | Tổng P / R / F1 |
| --- | ---: | ---: | ---: | ---: |
| Ghi nhận 15/09 | 14/10/28 | 58,3 / 33,3 / 42,4 | 1/1/5 | 57,7 / 31,3 / 40,5 |
| Chấm lại file dự đoán đã lưu bằng evaluator hiện tại | 14/10/28 | 58,3 / 33,3 / 42,4 | 1/1/5 | 57,7 / 31,3 / 40,5 |
| **Code hiện tại** (suy luận mới 6 clip + replay 002/003/005) | 14/**8**/28 | 63,6 / 33,3 / 43,8 | **4/4/2** | **60,0 / 37,5 / 46,2** |
| Code hiện tại, 100% replay pose (9 phạm vi) | 14/9/28 | 60,9 / 33,3 / 43,1 | 4/4/2 | 58,1 / 37,5 / 45,6 |

6 clip kiểm chứng cũ: bản ghi 6/10/0, hiện tại 6/8/0 (P 42,9% R 100% F1 60,0%).

Vì sao khác:

- **Evaluator và pose không phải nguyên nhân.** Chấm lại file cũ ra đúng 15/11/33.
- **Đấm FP 10 → 8:** `vid_05` mất hai cú đấm (khung 373, 415) vì `suppress_punches_during_kicks`
  loại đấm trong lúc có đá. TP/FN đấm không đổi.
- **Đá TP 1 → 4:** `recover_kick_events` thêm ba cú đá ở VIDEO_DATA_005 (khung 26, 272, 324, cạnh khung 145 đã có;
  khớp nhãn 26, 274, 328, 146; nhãn 222 vẫn bị bỏ). Đồng thời **FP 1 → 4**: cả bốn đều ở `vid_05` (clip vật),
  ba trong số đó (khung 419, 506, 618) do nhánh phục hồi thêm. Nhánh này tăng cả TP lẫn FP. Số đá 005 là replay,
  chưa xác nhận bằng suy luận mới.
- Mốc "đá 1 TP" và "đá 4 TP" đều rất nhỏ (6 nhãn đá): đừng đọc F1 đá như độ chính xác.

## 3. Legacy FSM và shadow

Chỉ phạm vi có nhãn đấm (8 phạm vi). Shadow không có nhánh đá.

| Phạm vi | Nhãn | Legacy TP/FP/FN | Shadow TP/FP/FN |
| --- | ---: | ---: | ---: |
| vid_01 bao cát (dọc, 60 fps) | 5 | 5/0/0 | 5/3/0 |
| vid_02 trọng tài | 0 | 0/1/0 | 0/18/0 |
| vid_03 đi ra sàn | 0 | 0/0/0 | 0/0/0 |
| vid_04 lồng (nhãn đấm 1 trong phạm vi) | 1 | 1/5/0 | 1/18/0 |
| vid_05 vật | 0 | 0/0/0 | 0/6/0 |
| vid_06 sau trận | 0 | 0/2/0 | 0/18/0 |
| VIDEO_DATA_002 (4K, 25 fps, replay) | 16 | 4/0/12 | 14/4/2 |
| VIDEO_DATA_003 (1080p, 25 fps, replay) | 20 | 4/0/16 | 14/3/6 |

| Tổng | Legacy TP/FP/FN (P / R / F1) | Shadow TP/FP/FN (P / R / F1) |
| --- | --- | --- |
| 8 phạm vi đấm | 14/8/28 (63,6 / 33,3 / 43,8) | 34/70/8 (32,7 / 81,0 / 46,6) |
| 3 clip huấn luyện (vid_01, 002, 003) | 13/0/28 (100 / 31,7 / 48,1) | 33/10/8 (76,7 / 80,5 / 78,6) |
| FP ở 4 clip không có đòn (02, 03, 05, 06) | 3 | 42 |

Shadow chỉ chạy khi khai báo `heavy_bag`/`shadow_boxing`, nên dòng "3 clip huấn luyện" gần với cách dùng
thật hơn dòng 8 phạm vi. Dòng 8 phạm vi là bài kiểm tra áp lực.

### Mức tình cờ của bộ đo (kiểm chứng bắt buộc đọc)

Nhãn 002/003 dày: 16 và 20 nhãn trong 15 s và 9,3 s, 12 cặp nhãn cách nhau ≤240 ms. Dung sai ±350 ms
phủ khoảng 59% (002) và 92% (003) trục thời gian. Để đo mức tình cờ, thay dự đoán bằng (a) chính
dự đoán dịch thời gian vòng tròn 0,8–6 s (20 lần) và (b) thời điểm ngẫu nhiên cùng số lượng (500 lần,
seed 0), chấm bằng cùng bộ ghép.

| Phạm vi, detector | Dung sai | TP thật | Ngẫu nhiên trung bình (p95) |
| --- | ---: | ---: | ---: |
| 003, shadow | 350 ms | 14 | 12,4 (15) |
| 003, shadow | 100 ms | 9 | 6,2 (9) |
| 003, legacy | 350 ms | 4 | 3,5 (4) |
| 002, shadow | 350 ms | 14 | 8,1 (11) |
| 002, shadow | 100 ms | 12 | 3,3 (6) |
| 002, legacy | 350 ms | 4 | 2,2 (4) |
| 002, legacy | 150 ms | 0 | 1,2 (3) |
| vid_01, legacy | 150 ms | 5 | 0,7 (2) |
| vid_01, shadow | 150 ms | 5 | 1,0 (3) |

Tổng 3 clip huấn luyện theo dung sai (TP thật so với tổng trung bình ngẫu nhiên):

| Dung sai | Legacy TP (ngẫu nhiên) | Shadow TP/FP (ngẫu nhiên) |
| --- | ---: | ---: |
| 100 ms | 5 (3,0) | 25/18 (10,3) |
| 150 ms | 7 (4,1) | 29/14 (13,8) |
| 200 ms | 9 (5,0) | 30/13 (16,5) |
| 250 ms | 11 (5,8) | 31/12 (18,8) |
| 350 ms | 13 (7,1) | 33/10 (22,7) |

Đọc đúng:

- vid_01 (nhãn thưa, đòn rõ): cả hai detector có tín hiệu thật, legacy lệch trung vị 3 ms.
- VIDEO_DATA_002: shadow có tín hiệu thật (12 TP ở 100 ms so với p95 = 6). **4 TP của legacy ngang mức
  ngẫu nhiên** và lệch 160–280 ms so với nhãn (0 TP ở 100–150 ms).
- VIDEO_DATA_003: không detector nào tách được khỏi tình cờ ở 350 ms.
- Với nhãn dày, "TP" có thể khớp nhầm nhãn kế bên. Không dùng số 003 để chứng minh hay bác bỏ detector.

## 4. Phân loại lỗi

Quy tắc theo thứ tự ưu tiên (chi tiết và bằng chứng số từng lỗi nằm trong JSON, `errors[]`):
mất pose/cached → ghép một-một bị nhãn kế bên chiếm → lệch thời gian 350–1000 ms → lý do riêng của detector
(chu trình FSM bị hủy, hoặc mã loại bỏ của shadow). Với `vid_04` kiểm thêm danh tính người được theo dõi.
Mốc thời gian suy ra từ khung và fps (25 fps cho 002/003/005, 59,94 fps cho vid_04).

### 4.1 Legacy: 30 FN (28 đấm + 2 đá)

| Nhóm nguyên nhân | Số | Theo clip | Khung (giây) |
| --- | ---: | --- | --- |
| Chu trình bị hủy vì không đạt ngưỡng vươn tay/khuỷu (`FSM_EXTENSION_CRITERIA_NOT_MET`) | **15** | 002: 7, 003: 8 | 002: 56, 62, 134, 150, 258, 320, 342; 003: 10, 46, 50, 128, 134, 190, 198, 206 |
| Không phóng chu trình: tốc độ vươn <0,5 u/s (`NO_LAUNCH_EXTENSION_SPEED_BELOW_0.5`) | 2 | 002: 2 | 002: 12 (0,48 s), 130 (5,2 s) |
| Một chu trình phủ nhiều nhãn (`FSM_ONE_CYCLE_COVERS_SEVERAL_STRIKES`) | 3 | 002: 2, 003: 1 | 002: 194, 198; 003: 218 |
| Không về guard trong 1.200 ms (`FSM_NO_RETURN_TO_GUARD_WITHIN_1200ms`) | 3 | 003: 3 | 003: 72, 78, 86 |
| Tay đang kẹt trong chu trình cũ (`FSM_ARM_BUSY_IN_OLDER_CYCLE`) | 3 | 003: 3 | 003: 104, 158, 164 |
| Dự đoán gần nhất bị nhãn kế bên chiếm (một-một) | 1 | 002: 1 | 002: 278 |
| Chu trình bị reset do khuỷu không hợp lệ (pose) | 1 | 003: 1 | 003: 122 |
| Cổ chân thấp confidence (bao cát che, trung bình 0,16) | 1 | 005 đá: 1 | 005: 222 (8,88 s) |
| Theo dõi nhầm người (đối thủ) | 1 | vid_04 đá: 1 | vid_04: 300 (5,0 s) |

Bằng chứng cho nhóm lớn nhất (15 chu trình bị hủy, 002/003):

- Khuỷu tối đa trong chu trình 97,6–132,7°, **cả 15** dưới 135° (ngưỡng đòn thẳng).
- 13/15 có độ dịch vươn tay 0,021–0,049 (ngưỡng 0,07) và tỉ lệ so với chiều dài tay 9–20% (ngưỡng 30%).
  2/15 (003 khung 190, 198) dịch 0,138 nhưng khuỷu 131–133°, tức hụt 2–4°.
- Biên độ vươn tay theo đơn vị FSM trong ±350 ms quanh nhãn chỉ 0,024–0,087, tốc độ vươn tối đa 0,23–0,53 u/s.
- Cùng các nhãn đó, đo theo thân người và tọa độ đẳng hướng (như shadow), biên độ trung vị 0,34–0,35 chiều dài
  thân (vid_01: 0,57), đỉnh vươn 0,74–0,96 thân: đòn có thật nhưng nhỏ hơn ngưỡng tuyệt đối của FSM.
- FSM dùng x,y chuẩn hóa không đẳng hướng (`pose_math.py`, ghi chú `POSE-GEOMETRY-001`): clip 16:9 chỉ thấy 56%
  chuyển động ngang. vid_01 (dọc) cho 5/5, hai clip ngang có nhãn dày chỉ 8/36.
- Theo nhãn: 9 nhãn có tay rút về trước khi đủ độ dịch (`retracted_before_min_displacement`), 7 nhãn có chu trình treo
  ở EXTENDING quá 1.200 ms (một nhãn có cả hai).

Nhóm theo chuỗi đòn (10/28 = một chu trình hoặc tay bận) cộng thêm: 19/28 nhãn đấm bị FN cách một nhãn khác ≤240 ms.

Pose: **0/28** FN đấm do mất pose hoặc cached; 1 do khuỷu không hợp lệ; 2/30 FN do pose/che khuất kể cả đá.

### 4.2 Legacy: 12 FP

| Nhóm | Số | Khung (giây) | Ghi chú đã xem ảnh |
| --- | ---: | --- | --- |
| Theo dõi nhầm người (đối thủ) ở vid_04 | 5 | 185 (3,09), 284 (4,74), 312 (5,21), 385 (6,42), 413 (6,89) | Người theo dõi là Courtoise (quần đỏ, tóc vàng); cú 3,09 s chính là đòn Courtoise bị nhãn `OUT_OF_SCOPE` |
| Chuyển động không phải đòn, đấm | 3 | vid_02: 138 (2,3); vid_06: 275 (4,59), 362 (6,04) | Trọng tài tay chống hông; VĐV đi bộ vung tay (chu trình 39 khung); người phụ chỉnh găng bị theo dõi |
| Giả cú đá khi vật/kiểm soát sàn (`vid_05`) | 4 | 371 (6,19), 419 (6,99), 506 (8,44), 618 (10,31) | Clinch/vật/kiểm soát sàn. 371 đã có từ bản 15/09; ba cú còn lại do `kick_event_detector_v2` thêm |

### 4.3 Shadow: 8 FN và 70 FP

FN: 6 do dự đoán gần nhất đã ghép với nhãn kế bên (003: 72, 86, 122, 134, 218; 002: 56), 2 lệch thời gian
400 ms và 480 ms (002 khung 218; 003 khung 150). **Không FN nào do pose hay ngưỡng.** Shadow bỏ sót ít vì nó
chấp nhận mọi đỉnh vươn có độ nổi ≥0,04 thân.

| Nhóm FP | Số | Theo clip |
| --- | ---: | --- |
| Chuyển động không phải đòn ở clip đối chứng | 41 | vid_02: 18; vid_06: 17; vid_05: 6 |
| Theo dõi nhầm người ở vid_04 | 11 | khung 161–415 (2,7–6,9 s) |
| Không có nhãn gần trong clip có nhãn | 10 | vid_04: 6 (mục tiêu Wilson, đã xem: bị che khuất hoặc guard, không thấy cú đấm rõ); vid_01: 2 (149, 541); 002: 2 (208, 304) |
| Đếm đôi một cú đã ghép | 5 | 003: 63, 107, 166; 002: 270; vid_04: 43 (duỗi tay dò đòn 250 ms trước jab có nhãn) |
| Nhãn bị loại khỏi chấm | 2 | vid_01 khung 423 (7,05 s) là `PROBE`; vid_06 khung 20 là `GESTURE` |
| Lệch thời gian 840 ms | 1 | 002 khung 35 |

### 4.4 Nhãn và hạ tầng đáng ngờ (ảnh hưởng cách đọc số)

- **vid_04 theo dõi sai người nhiều đoạn.** Độ xám thân người theo dõi nhảy từ ~90–112 (da sẫm, Wilson)
  sang ~210 (da sáng, Courtoise) quanh khung 137–148, nơi có cờ gián đoạn 137/140/148; sau đó đổi qua lại
  (khoảng khung 319–326, 360–375, 472–495). Xem ảnh các khung 0, 58, 177, 300. `SPRINT2_TRACKING_POSTURE_REPORT.md` ghi
  "0 hop"; cần đối chiếu lại. Cú jab 0,97 s được bắt khi còn đúng người, nên 1 TP của vid_04 không bị ảnh hưởng.
- **Nhãn dày ở 002/003** (mục 3). Trong 12 cặp ≤240 ms, 5 cặp có đỉnh vươn ở cả hai tay (một-hai hợp lý), 7 cặp
  chỉ một đỉnh. Chưa thể kết luận nhãn sai; cần người rà soát thứ hai.
- **Đá 005 khung 222:** nhãn từ ảnh nguồn, nhưng cổ chân bị bao cát che nên pose không thể thấy; đây là giới
  hạn đầu vào, không phải lỗi ngưỡng.

## 5. Khuyến nghị xếp hạng

Không có khuyến nghị nào ở đây là bằng chứng cải thiện: số lỗi là số nhãn dùng để chẩn đoán, chưa có tập giữ lại.

**0. Điều kiện tiên quyết về đo (không đổi detector).** Mọi so sánh recall hiện chịu ảnh hưởng của nhãn dày và
dung sai rộng (mục 3). Cần rà soát nhãn độc lập cho 12 cặp ≤240 ms, báo cáo thêm dung sai 100–150 ms và bài kiểm
tra dịch thời gian/ngẫu nhiên cạnh mọi bảng P/R/F1, và tách tập phát triển khỏi tập giữ lại trước khi chỉnh ngưỡng.

**1. Chuẩn hóa hình học cho độ vươn, tốc độ và khuỷu** (đơn vị thân người, x nhân tỉ lệ khung). Gỡ tối đa 17/28
FN đấm của legacy: nhóm lớn nhất, đều ở clip ngang. Bằng chứng ở mục 4.1. Thí nghiệm giả định chỉ nhân x
với tỉ lệ khung và giữ nguyên mọi ngưỡng: 002 TP 4 → 8, 003 4 → 4, vid_01 5 → 4, tổng FP 8 → 12
(JSON `counterfactual_isotropic_x`). Hình học là một yếu tố thật nhưng một mình chưa đủ, và ngưỡng phải được hiệu
chỉnh trên tập huấn luyện riêng.

**2. Đếm sự kiện theo đỉnh vươn tay của từng tay, không bắt buộc chu trình guard → guard.** Gỡ tối đa 10/28 FN
(một chu trình phủ nhiều nhãn, không về guard 1.200 ms, tay bận, bị nhãn kế bên chiếm). Shadow làm đúng việc
này và bắt 33/41 nhãn ở 3 clip huấn luyện (29/41 ở dung sai 150 ms, ngẫu nhiên ≈13,8). Chỉ coi là hướng đi
sau khi nhãn dày được rà soát (khuyến nghị 0), vì ở 003 shadow ngang mức tình cờ.

**3. Giữ precision khi tăng recall: khóa danh tính và cổng ngữ cảnh.** Nếu làm 1 và 2 mà không làm mục này,
shadow cho thấy FP tăng: 70 FP, trong đó 52 là chuyển động không phải đòn (41) hoặc sai người (11); legacy có
12/12 FP thuộc hai loại này. Cụ thể: kiểm tra lại danh tính sau mỗi gián đoạn (kích thước và màu thân) và từ chối
sự kiện ngay sau đó; thêm cổng tư thế/clinch cho `kick_event_detector_v2` (3/4 FP đá ở vật do nhánh này thêm); lọc vung tay khi đi bộ.
Tác động tới recall bằng 0, nhưng quyết định xem có đưa shadow ra thay legacy được không.

Không khuyến nghị: hạ ngưỡng theo từng video; mở rộng nhánh đá (chỉ còn 2 FN đá, một do che khuất,
một do sai người). Pose không phải điểm nghẽn recall trong dữ liệu này.

## 6. Giới hạn và phần chưa chạy được

- Không có video VIDEO_DATA_002/003/005, nên: số của 3 clip này là replay pose; chưa xem ảnh nguồn để kiểm
  FN 002/003; chưa tái lập được bảng 31.921 khung của 6 video gốc (001–006 đều thiếu).
- Nhãn mở rộng là bản tạm, một người rà soát, không phải tập kiểm độc lập.
- Phân loại lỗi là luật quy tắc, đã đối chiếu mắt cho các FP legacy ở vid_02/04/05/06 và 6 FP shadow ở vid_04;
  danh tính ở vid_04 suy từ độ xám thân (kiểm bằng mắt ở 9 khung). Không xem ảnh cho 41 FP shadow ở clip đối chứng.
- Bài kiểm tra tình cờ: 500 lượt, seed 0, 20 phép dịch; thể hiện mức tình cờ, không phải khoảng tin cậy.
- Chưa chạy `python -m unittest discover` (không đổi code repo).
- Ảnh bằng chứng (contact sheet vid_04/02/05/06) nằm trong thư mục tạm của phiên, không đưa vào repo; tạo lại bằng `sheet.py`.

## 7. Chạy lại

Công cụ nằm ở `python-worker/benchmark_results/detector_remeasure_20261006_tools/` (script phụ trợ, không đụng code
detector). PowerShell:

```powershell
$W  = "D:\test\ai\python-worker"
$T  = "$W\benchmark_results\detector_remeasure_20261006_tools"
$X  = "$env:TEMP\detector_remeasure"
$PY = "$W\.venv\Scripts\python.exe"
New-Item -ItemType Directory -Force "$X\src","$X\out\fresh","$X\out\bench","$X\out\trace","$X\out\replay_all" | Out-Null

# 0. Bản sao mã để không bị agent khác sửa giữa chừng (không .venv, không test_results, không video)
Copy-Item "$W\*.py","$W\public_datasets.json","$W\requirements.txt" "$X\src"
Copy-Item "$W\pipeline","$W\ground_truth" "$X\src" -Recurse
$env:DETECTOR_SRC = "$X\src"; $env:DETECTOR_OUT = "$X\out"; $env:WORKER_DIR = $W; $env:PYTHONDONTWRITEBYTECODE = "1"

# 1. Suy luận mới 6 clip (khoảng 10-15 phút CPU; có sẵn video trong validation_videos)
& $PY "$T\run_fresh.py"

# 2. Replay pose lưu cho 3 video thiếu và vết FSM của 6 clip
$v = "vid_01_cross_heavybag","vid_02_referee_gestures","vid_03_fighter_walkout","vid_04_cage_striking","vid_05_ground_grappling","vid_06_post_fight"
$d = "VIDEO_DATA_002","VIDEO_DATA_003","VIDEO_DATA_005"
& $PY "$T\replay_trace.py" "$X\out\fresh" "$X\out\trace" @v
& $PY "$T\replay_trace.py" "$W\test_results\strike_final" "$X\out\trace" @d
Copy-Item "$X\out\fresh\*.json" "$X\out\bench"
foreach ($n in $d) { Copy-Item "$X\out\trace\$n.json" "$X\out\bench" }

# 3. Số liệu tái lập
& $PY "$T\eval_suite.py" "$X\out\bench" "$X\out\headline_benchmark.json"
& $PY "$T\eval_suite.py" "$W\test_results\strike_final" "$X\out\cached_benchmark_reeval.json"
& $PY "$T\replay_trace.py" "$W\test_results\strike_final" "$X\out\replay_all" @v @d
& $PY "$T\eval_suite.py" "$X\out\replay_all" "$X\out\replay_benchmark.json"

# 4. Phân tích lỗi, kiểm chứng tình cờ, thống kê nhãn, thí nghiệm hình học
& $PY "$T\vid04_identity.py"
& $PY "$T\analyze.py" "$X\out\bench" "$X\out\trace" "$X\out\analysis.json"
& $PY "$T\control.py" "$X\out\bench" "$X\out\control.json"
& $PY "$T\gtstats.py" "$X\out\bench" "$X\out\gtstats.json"
& $PY "$T\gt_pairs.py" "$X\out\bench" "$X\out\gt_pairs.json"
& $PY "$T\counterfactual_isotropic.py" "$X\out\bench" "$X\out\counterfactual_isotropic.json"

# 5. Gộp JSON
& $PY "$T\build_deliverables.py" "$X\detector_remeasure_20261006.json"

# Ảnh kiểm tra (tùy chọn), ví dụ FP vid_04
& $PY "$T\sheet.py" vid_04_cage_striking vid04_fp.png "FP_f185=185" "FP_f284=284"
```

Chạy mục 1 mất nhiều thời gian nhất; nếu đã có `$X\out\fresh` thì `run_fresh.py` bỏ qua clip đã có. Replay (mục 2)
dùng đúng file pose lưu của repo, nên cần giữ `test_results/strike_final` như hiện tại.

Lệnh benchmark gốc của repo, dùng khi có đủ `video-data-test`:

```powershell
cd $W
.\.venv\Scripts\python.exe run_strike_suite.py --resume --output test_results\strike_final
.\.venv\Scripts\python.exe evaluate_strike_suite.py test_results\strike_final --output test_results\strike_final\benchmark.json
```

## Tệp tạo mới

- `docs/AI-DETECTOR-REMEASURE-20261006.md` (tài liệu này)
- `python-worker/benchmark_results/detector_remeasure_20261006.json`
- `python-worker/benchmark_results/detector_remeasure_20261006_tools/*.py` (12 script phụ trợ)
