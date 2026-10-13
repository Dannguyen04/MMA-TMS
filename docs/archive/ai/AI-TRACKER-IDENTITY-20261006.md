# Sửa theo dõi danh tính mục tiêu (PersonTracker) — 2026-10-06

Phạm vi: `python-worker/person_tracker.py` (+ test, + một dòng nối `fps` trong `process_video.py`). Không đổi detector, ngưỡng đòn hay nhãn.
Mọi việc làm trong bản sao riêng (scratchpad `tracker_fix/`), không sửa file nào trong repo ngoài tài liệu này. Bản vá: `tracker_fix.patch`
(cùng thư mục scratchpad, đường dẫn tương đối `python-worker/...`), kiểm `git -C D:\test\ai apply --check --whitespace=error`: **OK** trên working tree hiện tại
(kể cả `process_video.py` đang có sửa đổi chưa commit của người dùng). Bản vá chỉ chứa 3 file.

## 1. Chẩn đoán lỗi vid_04 (bằng chứng số)

Phát lại **bit-exact**: detection YOLO thô của `vid_04` (conf 0.5, yolov8n-pose) được cache, chạy lại `process_video` thật qua `pose_model` giả; landmark trùng hoàn toàn
với `test_results/strike_final/vid_04_cage_striking.json` (0/719 khung khác). Bảng baseline 6 clip tái lập đúng số của `AI-DETECTOR-REMEASURE-20261006.md`
(legacy 6 clip 6/8/0; mở rộng 18/12/30, P 60,0 R 37,5 F1 46,2).

Mục tiêu = VĐV da sẫm (Wilson). Khung 126–139: trọng tài đi ngang che VĐV, hộp mục tiêu co từ 0,34×0,59 xuống đầu+vai (conf neo hông 0,08–0,29), vẫn bám đúng người
(khung 137, 140 có cờ discontinuity nhưng vẫn là VĐV). **Bước nhảy thật xảy ra ở khung 148** (số trong `evidence_vid04_f125_151.json`):

| Khung | Mục tiêu trước | Ứng viên được chọn | IoU | tâm | scale | torso | điểm | hợp lệ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 147 | VĐV `[0.307,0.263,0.541,0.818]` | VĐV `[0.286,0.276,0.555,0.807]` | 0,839 | 0,004 | 0,911 | 0,861 | 0,895 | có |
| 147 | (đối thủ, hộp `[0.469,0.102,0.658,0.993]`) | không chọn | 0,154 | 0,140 | 0,772 | 0,306 | 0,332 | có (điểm ≥ 0,25) |
| **148** | VĐV `[0.286,0.276,0.555,0.807]` | **đối thủ `[0.451,0.105,0.654,0.990]`**, conf 0,759, conf neo vai/hông 0,95–0,99 | 0,207 | 0,132 | 0,794 | 0,466 | 0,397 | có (IoU ≥ 0,20) |

Detection của VĐV biến mất ở khung 148 (đang ngã thấp); detection duy nhất gần là đối thủ. Luật cũ nhận bất kỳ ứng viên nào thỏa **một trong ba** điều kiện:
điểm gộp ≥ 0,25 **hoặc** IoU ≥ 0,20 **hoặc** tâm ≤ 0,12, chỉ so với chính mục tiêu, không cạnh tranh với người khác. Độ dịch thân 0,15 > 0,14 nên cờ discontinuity bật
(FSM bị reset) nhưng danh tính vẫn dính vào đối thủ. Pose của đối thủ tin cậy cao nên không có gì hạ nguồn nghi ngờ. Sau đó tracker bám đối thủ khung 148–318,
rồi đổi qua lại ở 319, 371, 482, 614 (xem mục 4). Chính các cú 185/284/312/385/413 trong báo cáo remeasure (5 FP) là đòn của đối thủ, cú đá khung 300 bị bỏ vì đang theo sai người.

### Vì sao `SPRINT2_TRACKING_POSTURE_REPORT.md` ghi "0 hop"
Không phải khác phiên bản hay khác clip: `person_tracker.py` chỉ có một commit (`49d1ad5`, 15/09) và không đổi; sha clip khớp nhãn; cùng lệnh `model(frame, conf=0.5)`; số khung 0 trong báo cáo
(x≈0,476, area ≈ 320.089, conf 0,90) tái lập đúng. Khác ở **thước đo**:
- "Eliminated all 90 identity switches" so với `_select_main_person` cũ bằng số **teleport landmark** (> 0,14/khung): tracker mới gắn cờ mọi bước nhảy như vậy bằng cấu trúc
  (bước nhảy 148 chính là một "discontinuity" được gắn cờ), nên số teleport không cờ luôn là 0, bất kể có đổi người hay không. Đây là chỉ báo động học, không phải nhãn danh tính.
- Câu "duy trì khóa liên tục trên Cardy Wilson, x ∈ [0,44; 0,51] suốt 719 khung" **không tái lập**: tâm hộp mục tiêu trải 0,027–0,688, chỉ 208/719 khung nằm trong [0,44; 0,51];
  track_id dùng là {1, 2}; 20 khung có cờ discontinuity. Có vẻ chỉ kiểm khung đầu (0–147: x ∈ [0,34; 0,49]) hoặc không kiểm danh tính theo khung.
- Báo cáo ghi cú đấm 3,00 s của đối thủ "không bị phát hiện vì khóa vào Wilson": thực tế tracker đã nhảy sang đối thủ từ khung 148 (cú 3,09 s chính là đòn của đối thủ).

## 2. Cách sửa (không dùng ngoại hình)

`PersonTracker` giờ theo dõi **cả người khác** (SORT tối giản, gán tham lam 1-1) và ưu tiên abstain hơn đoán:

1. **Chi phí liên tục** tính bằng chiều dài thân của track (độc lập độ phân giải): độ lệch trung vị 4 điểm neo vai/hông (conf ≥ 0,30) so với vị trí dự đoán hằng-vận-tốc
   (tối đa `max_missing_frames` khung) + 0,25·(1−IoU) + phạt kích thước. Không đủ 2 điểm neo: dùng tâm hộp, phạt ×1,5.
2. **Cổng**: 0,6 chiều dài thân/khung, nở +0,3/khung bỏ lỡ, trần 2,0; ×(60/fps) khi fps < 60. Loại cứng khi chiều dài thân đổi > 2,5× hoặc chiều cao hộp > 3,5× (khán giả/người ở xa).
3. **Loại trừ + mơ hồ**: detection được người khác giải thích tốt ngang/hơn mục tiêu, hoặc có ứng viên cạnh tranh trong cổng với chi phí ≤ 2·tốt nhất + 0,15, thì mục tiêu thành
   "chưa xác minh" (`missing_frames > 0`, `process_video` đã biến thành MISSING_DETECTION). Hộp thừa của cùng một người (vai trùng ≤ 15% bề rộng vai) không tính là đối thủ.
4. **Tái thu nhận sau khi mất > 15 khung**: chỉ nhận detection chưa được người khác (đang sống) giải thích, nhất quán và duy nhất; hoặc người duy nhất trong cảnh. Mặc định **không đoán**
   bằng luật "lớn nhất, gần tâm" (`reacquire_patience=None`). Cắt cảnh (≥3 track sống cùng mất khớp) thì bắt đầu lại.
5. **Người duy nhất trong cảnh** (không có người khác nào đã biết) được nhận lại kể cả khi nhảy xa/đổi zoom, có cờ discontinuity — giữ hành vi cũ và test F.

Hằng số không chỉnh theo nhãn đòn. Cơ sở: chi phí khớp chấp nhận được (dt=1, 1.585 khung, 6 clip) p50 0,038, p99 0,37, tối đa 0,55 (trong cổng); ứng viên người khác gần nhất p1 = 1,12, p5 = 1,85
→ cổng 0,6 nằm giữa khoảng trống; tỉ lệ 2× là kiểm tra tỉ lệ (ratio test) thông dụng, sàn 0,15 để tránh tỉ lệ vô nghĩa khi chi phí ≈ 0; 2,5×/3,5× là biên kích thước vật lý;
trần 2,0 ≈ 0,6 chiều cao người. Thử `reacquire_patience` ∈ {0, 30, 90} trên các clip có người khác: số khung sai người tăng rõ (vid_04 10 → 120/199, vid_06 20 → 193/169) trong khi
khung đúng gần như không tăng, nên mặc định giữ abstain.

Hai sửa đổi sau khi thấy clip BoxingVI (xem mục 5, ghi rõ vì chúng thành dữ liệu phát triển): (a) cổng nhân (60/fps) — gate đầu tiên hiệu chuẩn ở 60 fps làm mất mục tiêu vĩnh viễn ở clip 24 fps;
(b) nhánh "người duy nhất" bỏ cổng kích thước. Hai sửa này cần `fps`: `process_video.py` truyền `fps=fps` (1 dòng); gọi không có fps (vd. `prepare_provisional_dataset.py`) mặc định giả định 30 fps.

## 3. Chỉ số và cách kiểm

- **Chuyển danh tính (switch)**: số lần người được theo dõi đổi (kể cả sang người sai thứ hai) giữa các đoạn liên tiếp. **Kiểm bằng mắt**: đầu ra tracker chia đoạn (cắt khi mất→có lại, cờ
  discontinuity, IoU hộp < 0,3, hoặc ≤ 45 khung), montage 2 ảnh/đoạn, gán nhãn T (VĐV mục tiêu) / O (người khác) / M (hộp chứa cả hai, không phân định).
- Chỉ báo phụ độc lập tự động: histogram Lab 5×6×6 vùng thân so với cửa sổ đầu clip (khoảng cách −log Bhattacharyya; cùng người ≤ 0,45, khác ≥ 0,80). Chỉ báo này có dương tính giả
  (áo polo đen ≈ da sẫm, đưa tay ra dang rộng, tư thế quay lưng) nên **số chính là nhãn mắt**; chỉ báo phụ dùng để tìm điểm cần xem.
- **Độ phủ** = khung có `target.missing_frames == 0` / tổng (đúng `targetTrackRatio` của quality gate). **Độ phủ đúng** = khung nhãn T / tổng.

### Clip cục bộ (đủ để chạy lại): 6 clip `validation_videos` + `adam.mp4` + 6 đoạn 900 khung từ 3 trận BoxingVI (3 đoạn "phát triển", 3 đoạn "giữ lại")
Không có `VIDEO_DATA_002/003/005` (không tìm thấy video): ba scope này chỉ có pose đã lưu, không chứa detection thô nên **không đo lại được**; số của chúng không đổi (replay pose, không qua tracker).

## 4. Kết quả: danh tính (clip nhiều người)

| Clip | Tracker | Khung xác minh (độ phủ) | T (đúng) | O (sai người) | M (cả hai) | Chưa xác minh | **Switch** |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| vid_02 trọng tài | gốc | 690 (96,0%) | 140 | **550** | 0 | 29 | **2** (trọng tài→khán giả khung 169, khán giả→VĐV 646) |
| vid_02 | mới | 685 (95,3%) | 685 | 0 | 0 | 34 | **0** |
| vid_04 lồng | gốc | 657 (91,4%) | 204 | **274** | 179 | 62 | **5** (148, 319, 371, 482, 614) |
| vid_04 | mới | 452 (62,9%) | 309 | 0 | 143 | 267 | **0** |
| vid_06 sau trận | gốc | 718 (99,9%) | 306 | **367** | 45 | 1 | **4** (306 sang người cứu thương/trọng tài, 421, 465, 635) |
| vid_06 | mới | 310 (43,1%) | 306 | 0 | 4 | 409 | **0** |
| vid_05 vật | gốc / mới | 642 (89,3%) / 476 (66,2%) | — | — | toàn bộ | 77 / 243 | không phân định |

vid_05: hai võ sĩ gần như luôn nằm trong **cùng một hộp detection** (ảnh montage), nên không có đoạn nào "chỉ một người" để chấm; cả hai tracker 0 switch có thể kiểm. vid_04 mới: 143 khung M
là các pha ném/nằm sàn nơi YOLO trả hộp gộp hai người; không có đoạn nào là đối thủ. Độ phủ giảm vì mục tiêu thật sự bị che/ôm sát; **khung đúng không giảm**
(vid_06 306 = 306; vid_04 204 → 309; vid_02 140 → 685).

Hệ quả cho quality gate: baseline báo `targetTrackRatio` 0,914/0,999 (vid_04/06) trong khi 38–51% khung xác minh là người sai, nên gate không bắt được. Sau sửa, vid_06 thành `blocked`
(0,431 < 0,5, > 2 người: "abstain_technical_conclusions"), vid_04 vẫn `degraded` (0,629), vid_05 `degraded` (0,662), vid_02 `degraded`.

### Clip một người / luồng một detection (recall một người không giảm)
| Clip | Khung | Tracker mới so với gốc |
| --- | ---: | --- |
| vid_01 bao cát | 608 | **giống hệt** 608/608 khung (landmark+kind+cờ), 5 đấm như cũ |
| vid_03 đi ra sàn | 719 | **giống hệt** 719/719 khung |
| adam.mp4 | 597 | **giống hệt** 597/597, 13 đấm như cũ |
| BoxingVI phát triển ×3 | 900 | giống hệt 900/900 cả ba |
| BoxingVI giữ lại ×3 (`hold_*`, chốt thiết kế trước khi cắt) | 900 | 2/3 giống hệt; `hold_OfZF` mất 2 khung xác minh (khung 101–102, có 1 khung hai detection), 881/900 khung trùng sau reset EMA; số đòn không đổi |

Lưu ý: các đoạn BoxingVI gần như chỉ có 1 detection/khung (clip cận cảnh một võ sĩ), nên chúng là phép thử "người duy nhất", không phải thử cạnh tranh nhiều người.

## 5. Kết quả: benchmark đòn (350 ms, replay qua pipeline thật, `eval_suite.py`)

| Scope | Gốc TP/FP/FN | Mới TP/FP/FN |
| --- | ---: | ---: |
| vid_01 đấm | 5/0/0 | 5/0/0 |
| vid_02 đấm | 0/1/0 | 0/3/0 |
| vid_03 đấm | 0/0/0 | 0/0/0 |
| vid_04 đấm | 1/5/0 | **1/1/0** |
| vid_05 đấm | 0/0/0 | 0/1/0 |
| vid_06 đấm | 0/2/0 | 0/1/0 |
| vid_04 đá | 0/0/1 | 0/1/1 |
| vid_05 đá | 0/4/0 | 0/2/0 |
| VIDEO_DATA_002 / 003 / 005 | 4/0/12, 4/0/16, 4/0/1 | không đổi (không đo lại được) |
| **6 clip legacy** | 6/8/0 | **6/6/0** |
| **Tổng mở rộng** | 18/12/30 (P 60,0 R 37,5 F1 46,2) | **18/9/30 (P 66,7 R 37,5 F1 48,0)** |

TP không đổi (không đòn thật nào bị mất), recall giữ 37,5%; FP 12 → 9. Hai chỗ FP **tăng**: vid_02 (1 → 3) vì trước đây tracker rời trọng tài ở khung 169 và theo khán giả nên "né" mất các cử chỉ
của trọng tài; giờ theo đúng trọng tài suốt clip và detector legacy phát 3 cú không phải đòn (đã biết ở remeasure mục 4.2); vid_05 +1 đấm, vid_04 +1 đá cũng là FP của detector, không phải danh tính.
Cú đá khung 300 vid_04 vẫn FN (tracker đã đúng người nhưng detector đá không phát).

Kiểm chứng mức tình cờ (`control.py`, 350 ms; TP thật so với dịch vòng / ngẫu nhiên trung bình, p95):
vid_01 legacy 5 (1,47; p95 3); vid_04 legacy 1 (gốc 0,28; mới 0,11; p95 1) — tức 1 TP của vid_04 ở mức p95 tình cờ, như trước; shadow vid_04 1/18 → 1/14 (FP giảm); VIDEO_DATA_002 legacy 4 (2,17; 4), shadow 14 (8,12; 11);
VIDEO_DATA_003 legacy 4 (3,47; 4), shadow 14 (12,43; 15). Không dòng nào ở ngoài vid_04/vid_01 thay đổi. Kết luận cũ vẫn giữ: số 002/003 không tách khỏi tình cờ.

## 6. Test

- `python-worker`, `pytest -q` trong bản sao đầy đủ (không `.venv`/`test_results`/video): gốc **1066 passed, 105 subtests**; sau sửa **1076 passed, 105 subtests, 0 failed** (+10 test mới).
  Số "976" nêu ban đầu không còn khớp với working tree hiện tại; 1066 là số đo trên cùng ảnh chụp với bản sửa.
- `test_person_tracker.py`: 6 test cũ giữ nguyên và pass; thêm lớp `TestIdentityAmbiguity` (10 test, detection tổng hợp, `fps=60`): G đối thủ sát hộp khi mục tiêu rụng 4 khung (tái hiện đúng điều kiện IoU > 0,20 gây nhảy ở khung 148);
  H mất lâu hơn 15 khung không đoán sang đối thủ, quay lại chỗ cũ thì track mới; I vượt nhau cùng chiều; J rụng đúng lúc hai người cắt nhau, hồi phục nhờ vận tốc; K trùng khít một khung thì abstain;
  L hộp thừa cùng một người không gây mơ hồ; M người nhỏ ở xa không thay thế được mục tiêu; N cắt cảnh; O cổng nở theo fps (0,9 chiều dài thân/khung: quá cổng ở 60 fps, bình thường ở 24 fps);
  P người duy nhất sống sót qua đổi zoom ×3 + nhảy. Trên tracker cũ, các test G–K, M, N đều **fail** (kịch bản cắt nhau + rụng hộp: tracker cũ nhảy sang người kia và ở lại).
- Chi phí CPU của tracker ~4 ms/khung (cũ ~0,3 ms), so với YOLO CPU hàng trăm ms/khung.

## 7. Giới hạn
- Nhãn danh tính theo đoạn bằng mắt, một người xem, không phải tập kiểm độc lập; pha M (hai người trong một hộp) bị loại khỏi đếm switch.
- Chỉ 3 clip có nhiều người cạnh tranh (vid_02/04/06) + vid_05 không phân định; vid_04 vừa là chẩn đoán vừa là phép thử. Các đoạn `hold_*` là giữ lại thật sự nhưng chỉ kiểm hành vi một người.
- Không có hình dạng ngoại hình: hai người bắt chéo hoàn toàn đối xứng vẫn có thể đổi chỗ im lặng; tracker chỉ abstain đúng khung trùng khít.
- Đổi mặc định gây `blocked` ở clip đông người mà mục tiêu bị che > 50% thời gian; cần chủ sản phẩm xác nhận đây là hành vi mong muốn.
- Script, cache detection, montage nằm ở scratchpad (`tracker_fix/src`, `cache`, `out`), không đưa vào repo theo yêu cầu. Gồm: `cache_detections.py`, `run_replay.py`, `eval_identity.py`, `seg_sheets.py`, `bench_variant.py`, `diag_f148.py`.

## 8. Khuyến nghị
1. Áp bản vá (`tracker_fix.patch`), giữ `reacquire_patience=None`.
2. Dùng ngoại hình (embedding áo/da) làm tín hiệu thứ hai cho tái thu nhận sau khi mất > 15 khung và cho ca trùng khít; đây là cách duy nhất khôi phục độ phủ ở vid_04/06 mà không đoán.
3. Chuyển hộp gộp hai người (vid_04/05 pha vật) thành cờ riêng thay vì pose, và cân nhắc theo dõi hai võ sĩ (khuyến nghị Sprint 2) cho cảnh thi đấu.
4. Rà lại FP đấm/đá của detector ở vid_02/05 vì danh tính đúng làm chúng lộ ra.
