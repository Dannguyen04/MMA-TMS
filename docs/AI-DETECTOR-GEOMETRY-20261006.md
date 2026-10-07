# Chuẩn hóa hình học cho FSM đấm (legacy) — thiết kế và đánh giá, 2026-10-06

Tiếp nối `docs/AI-DETECTOR-REMEASURE-20261006.md`. Nhóm FN lớn nhất của FSM đấm là chu trình bị hủy vì ngưỡng
vươn tay/khuỷu/tốc độ tính trên toạ độ chuẩn hóa không đẳng hướng (`POSE-GEOMETRY-001`). Tài liệu này thiết kế
chuẩn hóa theo cỡ thân người kèm hiệu chỉnh tỉ lệ khung, thêm một thay đổi FSM nhỏ cho đòn liên tiếp, và đánh
giá riêng từng phần (ablation) cùng kiểm chứng mức tình cờ.

Mã chỉ nằm trong bản vá `detector_geometry.patch` (chưa áp vào repo): không file nào trong `D:\test\ai` bị sửa
ngoài tài liệu này. Mọi số đo chạy trên bản sao `python-worker` ở thư mục tạm, venv của repo, pose đã lưu.

## Kết luận ngắn

1. **Chuẩn hóa hình học đúng về nguyên lý và bất biến thật.** Cùng một chuyển động render lên khung 16:9, 1:1,
   9:16 cho đúng cùng quyết định ở 12/12 bản ghi pose (FSM + posture gate), v1 chỉ 1/12 (và chính một clip đó
   là clip không có đòn nào). Trên khung 16:9 vid_01 (bao cát) mất toàn bộ 5 đòn ở v1.
2. **Nhưng nó không cải thiện F1 ở dung sai chính thức 350 ms.** Mọi đòn, 8 phạm vi: F1 43,1% (v1) → 35,3%
   (geometry). Tốt hơn ở dung sai chặt (100 ms: 18,5 → 23,5; 150 ms: 24,6 → 29,4) và bắt được thêm đòn ở
   VIDEO_DATA_002 (4 → 6 TP), nhưng VIDEO_DATA_003 từ 4 TP về 0 và FP ở clip không có đòn tăng 4 → 10.
3. **Hình học một mình không sửa được recall.** Nhãn 002/003 có biên độ trung vị 0,34–0,35 thân người, đúng
   bằng ngưỡng đòn tối thiểu (0,07 đơn vị = 0,32 thân). Nên FSM vẫn cắt giữa đường nhãn; chuyển đơn vị chỉ di chuyển điểm
   làm việc (bảng độ nhạy mục 5).
4. **Vươn lại sau lần vươn hụt (`restart_on_reextension`) gần như không có tác dụng:** +1 TP, +1 FP ở 350 ms,
   nằm trong dao động tình cờ. Nhánh chồng lấn ở RETRACTING đã thử và loại (không thể kích hoạt, mục 4).
5. **Khuyến nghị: giữ opt-in, không đổi mặc định.** Chế độ hình học để mặc định `legacy`; bật bằng
   `PUNCH_GEOMETRY_MODE=body_units`. `restart_on_reextension` đề xuất loại (cờ giữ tắt; xoá được nếu muốn). Chỉ cân
   nhắc mặc định `body_units` sau khi hiệu chỉnh ngưỡng đơn vị thân trên tập giữ lại có nhãn thưa (mục 7).
6. Mặc định không đổi hành vi: 12/12 kết quả process_video giống hệt từng trường (trừ dấu thời gian) so với mã gốc;
   994 test pass (976 + 18 mới).

## 1. Thiết kế

### 1.1 Vấn đề

`SingleArmTracker` đọc `x/width`, `y/height`. Trên 16:9, một pixel ngang chỉ đóng góp 56% so với một pixel dọc nên
độ vươn, tốc độ và góc khuỷu đều méo, và ngưỡng tuyệt đối (0,07 đơn vị, 0,5 u/s) có ý nghĩa vật lý khác nhau theo khung
và theo khoảng cách quay. `shadow` (`strike_events.py`) đã dùng x·aspect và đơn vị thân; legacy chưa.

### 1.2 Phép chuẩn hóa (`geometry_mode = "body_units"`)

Với mỗi khung, `PunchAnalyzer` dựng toạ độ cho FSM từ keypoint chuẩn hóa `(x, y)`:

```
iso      = (x * aspect, y)                       # aspect = width/height của video; đơn vị = chiều cao ảnh
torso    = |trung điểm hông − trung điểm vai| trên iso, làm mượt EMA thời gian (τ = 600 ms)
k        = CANONICAL_TORSO_LENGTH / torso
canonical = iso * k                              # toạ độ đưa vào SingleArmTracker (đơn vị chuẩn)
```

- **Cỡ thân chứ không phải bề ngang vai hay chiều dài tay:** thân không co khi xoay người (vai co), không co khi vung
  tay. Giải phẫu: Drillis & Contini (1966) cho tay (vai→cổ tay) ≈ 0,332 H và thân (khớp vai→khớp hông) ≈ 0,288 H,
  tỉ lệ `ARM_TO_TORSO_RATIO` = 1,153.
- **Không đổi giá trị số của ngưỡng.** Ngưỡng v1 được đọc theo "đơn vị chuẩn": một người có thân dài
  `CANONICAL_TORSO_LENGTH` = 0,25 / 1,153 = **0,2168** đơn vị. Số 0,25 là chiều dài tay dự phòng có sẵn trong
  `SingleArmTracker` (khi `arm_length < 0.10`), nên giá trị không lấy từ nhãn benchmark; nó cũng nhất quán với
  `min_extension_disp` 0,07 ≈ 0,30 × 0,25. Vì vậy tay đo được (1,153 thân ≈ 0,25 đơn vị) và hệ số dự phòng khớp nhau.
- **Góc khuỷu** tính trên toạ độ đẳng hướng (góc không phụ thuộc cỡ thân).
- **`PostureGate`** nhận toạ độ `(x*aspect, y)` (không nhân cỡ thân) để góc thân không méo theo khung; các ngưỡng
  tuyệt đối của gate (ví dụ `dy >= 0.08`, `leg_clearance`) giữ nguyên. Đây là giới hạn đã biết (mục 8).
- **Thiếu cỡ thân:** hông/vai conf < 0,25 hoặc thân < 0,02 (cùng ngưỡng suy biến của `EventDetectorConfig` shadow)
  thì giữ cỡ cũ tối đa `body_scale_hold_ms` = 1200 ms (= thời gian tối đa của một chu trình đòn); quá hạn thì từ chối
  (conf = 0, FSM hủy chu trình), không đoán cỡ. `τ` = 600 ms = nửa chu trình tối đa nên cỡ không "chạy theo" cánh tay.
  Gián đoạn danh tính (`is_discontinuous`) xóa cỡ.

### 1.3 Ý nghĩa ngưỡng sau chuẩn hóa

| Ngưỡng (giá trị không đổi) | Đơn vị chuẩn | Theo thân (÷0,2168) | Ghi chú |
| --- | ---: | ---: | --- |
| `min_extension_disp` | 0,07 | 0,32 thân | độ dịch tối thiểu của một đòn |
| `min_extension_disp_ratio` | 0,30 chiều dài tay | không thứ nguyên | đo trên tay thật của người |
| `min_extension_speed` | 0,50 u/s | 2,3 thân/s | phóng đòn |
| `valid_height` (cổ tay dưới vai) | 0,20 | 0,92 thân | |
| rớt thủ tay đối diện | 0,10 | 0,46 thân | |
| dừng ở IMPACT (`reach < impact − 0.03`) | 0,03 | 0,14 thân | |
| rút về (`reach_speed < −0.35`, `−0.20`) | 0,35 / 0,20 u/s | 1,6 / 0,9 thân/s | |
| về sát thủ (`reach <= start + 0.05`) | 0,05 | 0,23 thân | |
| `peak_speed` trong rubric (0,5 / 1,2) | u/s chuẩn | 2,3 / 5,5 thân/s | điểm tốc độ nay so sánh được giữa các clip |
| góc khuỷu 135°/150°, hook 80–125° | độ | — | tính trên toạ độ đẳng hướng |
| thời gian (100/200/300/1.200 ms) | ms | — | không đổi |

### 1.4 Chu trình chồng lấn (`restart_on_reextension`)

Quan sát: 10/28 FN đấm là một chu trình phủ nhiều nhãn hoặc tay "bận". Thay đổi tối thiểu có nguyên tắc: khi đang
EXTENDING (chưa thành đòn) mà tay thu về sâu rồi vươn lại, bỏ chu trình hụt và bắt đầu chu trình mới từ đáy, thay vì giữ
tay bận tới 1.200 ms. Điều kiện: `đỉnh − đáy >= max(min_extension_disp, 0.30 × arm_length)` (đáy sâu bằng đúng độ dịch tối
thiểu để một chuyển động tính là đòn) và thỏa điều kiện phóng đòn thông thường. Không có hằng số mới.

Đã thử thêm nhánh tương tự ở RETRACTING (chốt đòn cũ ở đáy, mở chu trình mới) và **loại**: quy tắc hoàn tất có sẵn
(thu ≥ 35% tổng vươn) luôn đến trước. Nhánh đáy chỉ kích hoạt nếu thu < 35% nhưng đáy sâu ≥ 0,075, nghĩa là
tổng vươn > 0,21 khi tầm tay chỉ ~0,25. Ablation: chỉ khác legacy ở 1/12 bản ghi (VIDEO_DATA_001, không nhãn, cùng 44 đòn);
kết hợp với geometry khác ở 2/12 (001 và vid_02, cùng số đòn); số TP/FP/FN trên mọi phạm vi có nhãn giống hệt. Nên không đưa vào bản vá.

### 1.5 Cách bật (opt-in)

| Biến môi trường | Giá trị | Mặc định |
| --- | --- | --- |
| `PUNCH_GEOMETRY_MODE` | `legacy` / `body_units` | `legacy` |
| `PUNCH_RESTART_ON_REEXTENSION` | `on` / `off` | `off` |

`process_video` đọc qua `PunchDetectorConfig.from_env()` và truyền `frame_aspect = img_w / img_h` vào
`ActionPipeline`. Giá trị sai ném `ValueError`. `detectorVersion` giữ `legacy_fsm_v1` khi mặc định; khi bật thêm hậu
tố `+body_units_v1` / `+reextend_v1`. **Không tăng `legacy_fsm_v1 → v2`** vì mặc định không đổi hành vi.

## 2. Phương pháp đo

- Pose: replay pose đã lưu (`test_results/strike_final/*.json`, tọa độ làm tròn 4 chữ số; EMA tắt như `replay_strikes`)
  cho cả 9 phạm vi có nhãn và 3 clip không có nhãn đòn. Không có video nguồn 002/003/005; 6 clip `vid_*` dùng pose
  lưu thay vì suy luận mới (landmark giống hệt nhau theo báo cáo trước). Baseline replay legacy tái lập đúng
  14/9/28 (350 ms) đã ghi ở báo cáo trước.
- Chấm: bộ ghép `strike_benchmark` qua `eval_suite`/`common.py` của bộ công cụ cũ, dung sai **100/150/350 ms**.
- **Mức tình cờ:** `control.py` của bộ công cụ cũ, giữ nguyên: 500 lượt thời điểm ngẫu nhiên cùng số dự đoán (seed 0) và 20
  phép dịch vòng 0,8–6 s, chạy riêng cho từng biến thể. Cột "TP tình cờ" là tổng trung bình trên các phạm vi có nhãn;
  `Σp95` là tổng p95 từng phạm vi (cận trên thận trọng, không phải p95 của tổng). Với clip không có đòn, mọi dự đoán là FP
  nên không cần đối chứng.
- **Không chỉnh ngưỡng theo nhãn.** Hằng số mới đều suy ra từ giải phẫu hoặc từ giá trị có sẵn trong mã (mục 1.2). Bảng
  độ nhạy ở mục 5 là mô tả, không được dùng để chọn tham số. Toàn bộ nhãn vẫn là tập phát triển; không có tập giữ lại.
- "Clip có đòn thật" = vid_01, vid_04 (1 nhãn trong phạm vi), VIDEO_DATA_002, VIDEO_DATA_003.
  "Clip không có đòn" = vid_02, vid_03, vid_05, vid_06.

## 3. Kết quả ablation (đấm)

Biến thể: **legacy v1** | **geometry** (`body_units`) | **restart** (`restart_on_reextension`) | **both**.

### 3.1 Clip có đòn thật (4 phạm vi, 42 nhãn)

| Biến thể | Dung sai | TP | FP | FN | P / R / F1 (%) | TP tình cờ (TB) | Σp95 | TP − tình cờ |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| legacy v1 | 100 ms | 6 | 13 | 36 | 31,6 / 14,3 / 19,7 | 3,1 | 8 | 2,9 |
| legacy v1 | 150 ms | 8 | 11 | 34 | 42,1 / 19,0 / 26,2 | 4,3 | 10 | 3,7 |
| legacy v1 | 350 ms | 14 | 5 | 28 | 73,7 / 33,3 / 45,9 | 7,4 | 12 | 6,6 |
| geometry | 100 ms | 8 | 8 | 34 | 50,0 / 19,0 / 27,6 | 1,8 | 6 | 6,2 |
| geometry | 150 ms | 10 | 6 | 32 | 62,5 / 23,8 / 34,5 | 2,5 | 6 | 7,5 |
| geometry | 350 ms | 12 | 4 | 30 | 75,0 / 28,6 / 41,4 | 4,8 | 9 | 7,2 |
| restart | 100 ms | 7 | 14 | 35 | 33,3 / 16,7 / 22,2 | 3,6 | 9 | 3,4 |
| restart | 150 ms | 9 | 12 | 33 | 42,9 / 21,4 / 28,6 | 4,9 | 10 | 4,1 |
| restart | 350 ms | 15 | 6 | 27 | 71,4 / 35,7 / 47,6 | 8,4 | 13 | 6,6 |
| both | 100 ms | 8 | 9 | 34 | 47,1 / 19,0 / 27,1 | 1,7 | 5 | 6,3 |
| both | 150 ms | 10 | 7 | 32 | 58,8 / 23,8 / 33,9 | 2,4 | 6 | 7,6 |
| both | 350 ms | 11 | 6 | 31 | 64,7 / 26,2 / 37,3 | 4,7 | 8 | 6,3 |

### 3.2 Clip không có đòn (vid_02, vid_03, vid_05, vid_06; 48 s): hành vi FP

| Biến thể | FP (mọi dung sai) | vid_02 | vid_03 | vid_05 | vid_06 |
| --- | ---: | ---: | ---: | ---: | ---: |
| legacy v1 | 4 | 1 | 1 | 0 | 2 |
| geometry | **10** | 2 | 2 | 0 | 6 |
| restart | 4 | 1 | 1 | 0 | 2 |
| both | 9 | 2 | 2 | 0 | 5 |

### 3.3 Cả 8 phạm vi đấm (tổng, so được với báo cáo trước)

| Biến thể | Dung sai | TP | FP | FN | P / R / F1 (%) | TP tình cờ (TB) | Σp95 |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| legacy v1 | 100 ms | 6 | 17 | 36 | 26,1 / 14,3 / 18,5 | 3,1 | 8 |
| legacy v1 | 150 ms | 8 | 15 | 34 | 34,8 / 19,0 / 24,6 | 4,3 | 10 |
| legacy v1 | 350 ms | 14 | 9 | 28 | 60,9 / 33,3 / 43,1 | 7,4 | 12 |
| geometry | 100 ms | 8 | 18 | 34 | 30,8 / 19,0 / 23,5 | 1,8 | 6 |
| geometry | 150 ms | 10 | 16 | 32 | 38,5 / 23,8 / 29,4 | 2,5 | 6 |
| geometry | 350 ms | 12 | 14 | 30 | 46,2 / 28,6 / 35,3 | 4,8 | 9 |
| restart | 100 ms | 7 | 18 | 35 | 28,0 / 16,7 / 20,9 | 3,6 | 9 |
| restart | 150 ms | 9 | 16 | 33 | 36,0 / 21,4 / 26,9 | 4,9 | 10 |
| restart | 350 ms | 15 | 10 | 27 | 60,0 / 35,7 / 44,8 | 8,4 | 13 |
| both | 100 ms | 8 | 18 | 34 | 30,8 / 19,0 / 23,5 | 1,7 | 5 |
| both | 150 ms | 10 | 16 | 32 | 38,5 / 23,8 / 29,4 | 2,4 | 6 |
| both | 350 ms | 11 | 15 | 31 | 42,3 / 26,2 / 32,4 | 4,7 | 8 |

Tổng đấm + đá ở 350 ms (đá không đổi 4/4/2): legacy 18/13/30 (P 58,1 R 37,5 F1 45,6); geometry 16/18/32
(47,1 / 33,3 / 39,0); restart 19/14/29 (57,6 / 39,6 / 46,9); both 15/19/33 (44,1 / 31,2 / 36,6).

### 3.4 Theo từng video: TP/FP/FN (tình cờ TB/p95), dung sai 100 | 150 | 350 ms

| Video (nhãn) | Biến thể | 100 ms | 150 ms | 350 ms |
| --- | --- | --- | --- | --- |
| vid_01 (5) | legacy | 4/1/1 (0,5/2) | 5/0/0 (0,7/2) | 5/0/0 (1,5/3) |
| vid_01 (5) | geometry | 4/1/1 (0,5/2) | 5/0/0 (0,7/2) | 5/0/0 (1,5/3) |
| vid_01 (5) | restart | 4/2/1 (0,6/2) | 5/1/0 (0,8/2) | 5/1/0 (1,7/3) |
| vid_04 (1) | legacy | 1/5/0 (0,1/1) | 1/5/0 (0,1/1) | 1/5/0 (0,3/1) |
| vid_04 (1) | geometry | 1/4/0 (0,1/1) | 1/4/0 (0,1/1) | 1/4/0 (0,2/1) |
| vid_04 (1) | restart | 1/5/0 (0,1/1) | 1/5/0 (0,1/1) | 1/5/0 (0,3/1) |
| VIDEO_DATA_002 (16) | legacy | 0/4/16 (0,8/2) | 0/4/16 (1,2/3) | 4/0/12 (2,2/4) |
| VIDEO_DATA_002 (16) | geometry | 3/3/13 (1,2/3) | 4/2/12 (1,7/3) | 6/0/10 (3,1/5) |
| VIDEO_DATA_002 (16) | restart | 0/4/16 (0,8/2) | 0/4/16 (1,2/3) | 4/0/12 (2,2/4) |
| VIDEO_DATA_002 (16) | both | 3/2/13 (1,0/2) | 4/1/12 (1,5/3) | 5/0/11 (2,7/4) |
| VIDEO_DATA_003 (20) | legacy | 1/3/19 (1,7/3) | 2/2/18 (2,3/4) | 4/0/16 (3,5/4) |
| VIDEO_DATA_003 (20) | geometry | 0/0/20 | 0/0/20 | 0/0/20 |
| VIDEO_DATA_003 (20) | restart | 2/3/18 (2,1/4) | 3/2/17 (2,8/4) | 5/0/15 (4,3/5) |
| VIDEO_DATA_003 (20) | both | 0/0/20 | 0/0/20 | 0/0/20 |

(vid_01 và vid_04: `both` bằng `restart`; vid_02/03/05/06 chỉ có FP, xem 3.2.)

Đọc kết quả:

- **VIDEO_DATA_002:** geometry bắt đòn đúng thời điểm hơn: 3–4 TP ở 100–150 ms trong khi legacy 0 (4 TP của legacy ở 350 ms
  lệch 160–280 ms, ngang mức tình cờ 2,2). Nhưng 3–4 TP chỉ nhỉnh hơn p95 của tình cờ (3), bằng chứng yếu.
- **VIDEO_DATA_003:** 4 TP legacy ở 350 ms bằng đúng mức tình cờ (3,5), nên "mất" 4 TP này không phải mất tín hiệu thật.
  Nhưng geometry không bắt được cú nào, vì sao: 13 chu trình đều treo ở EXTENDING quá 1.200 ms với độ dịch đơn vị chuẩn
  0,015–0,075 (< 0,07/0,3 tay) dù khuỷu 117–155°. Người trong 003 gấp 1,7 lần thân chuẩn (thân 0,375 chiều cao ảnh), nên
  ngưỡng tuyệt đối của v1 trên clip này "dễ" hơn ngưỡng theo thân.
- **vid_01 (dọc, 60 fps):** không đổi: 5/5 ở cả hai chế độ. v1 đã ổn ở khung dọc.
- **Clip không có đòn:** geometry tăng FP 2,5 lần (vid_06: 2 → 6). Chuyển động ngang trên clip 16:9 nay được đo đầy đủ
  (nhân x với 1,78) nên cả đòn thật lẫn vung tay bình thường đều lớn hơn; v1 ít FP một phần vì "mù" theo trục x.

### 3.5 Clip không có nhãn (chỉ đếm, không đo P/R)

| Clip | Thời lượng | legacy | geometry | restart | both |
| --- | ---: | ---: | ---: | ---: | ---: |
| VIDEO_DATA_001 (trận đấu) | 227 s | 44 (11,6/phút) | 44 (11,6/phút) | 47 | 46 |
| VIDEO_DATA_004 | 75 s | 0 | 0 | 0 | 0 |
| VIDEO_DATA_006 (trận đấu) | 252 s | 50 (11,9/phút) | 98 (23,4/phút) | 51 | 104 |
| VIDEO_DATA_005 (nhãn đá) | 14 s | 2 | 4 | 2 | 4 |

VIDEO_DATA_006 (1280×720) gần như gấp đôi số phát hiện dưới geometry (50 → 98). Không có nhãn nên không phân xử được
đây là recall thêm hay FP thêm; cùng hướng với tăng FP ở clip không có đòn (3.2). VIDEO_DATA_004: cỡ thân không bao giờ
hợp lệ và legacy cũng 0 đòn (không có người đáng tin trong pose lưu).

## 4. Kiểm tra bất biến khung hình (không cần nhãn)

Cùng toạ độ pixel của 12 bản ghi pose được chuẩn hóa lại trên canvas 16:9, 1:1, 9:16 (chỉ padding, pixel không đổi),
rồi chạy cả pipeline. Công cụ: `geom_invariance.py`.

| Chế độ | Bản ghi cho kết quả giống hệt trên 3 canvas (FSM + posture gate) | Có cả `suppress_punches_during_kicks` |
| --- | ---: | ---: |
| legacy v1 | 1/12 (clip duy nhất là VIDEO_DATA_004, 0 đòn) | 2/12 |
| geometry | **12/12** | 7/12 |
| both | **12/12** | 7/12 |

5 bản ghi không giống hệt ở cột sau do `kick_event_detector_v2`/`suppress_punches_during_kicks` (đọc toạ độ chuẩn hóa
thô, ngoài phạm vi), không phải do FSM đấm. Ví dụ nặng nhất của v1: vid_01 cho 0 đòn trên canvas 16:9, 4 trên 1:1, 5 trên
9:16 (nguyên bản); VIDEO_DATA_002: 4 / 4 / 13 đòn trên 16:9 / 1:1 / 9:16.

Thống kê cỡ thân theo clip (mô tả, `torso_stats.py`, đơn vị chiều cao ảnh đẳng hướng): 002 ≈ 0,38; 003 ≈ 0,38; 005 ≈ 0,32;
vid_01 ≈ 0,14; VIDEO_DATA_006 ≈ 0,21; 001 ≈ 0,28. Thân chuẩn là 0,217, tức hệ số `k` khoảng 0,6 (002/003), 1,6 (vid_01).

## 5. Độ nhạy theo hằng số chuẩn (mô tả, KHÔNG dùng để chọn tham số)

Chạy lại `geometry` với `CANONICAL_TORSO_LENGTH` × 0,8 và × 1,25 (người "nhỏ" hơn = ngưỡng dễ hơn).
Chỉ để thấy hệ số này là một núm vặn đơn điệu: đặt ×1,25 sẽ có số đẹp hơn trên nhãn này, và đó chính là việc cần cấm
khi chưa có tập giữ lại.

| Biến thể | Dung sai | TP | FP | FN | P / R / F1 (%) | TP tình cờ (TB) | Σp95 | FP clip không đòn |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| T × 0,8 | 100 ms | 6 | 12 | 36 | 33,3 / 14,3 / 20,0 | 1,0 | 4 | 8 |
| T × 0,8 | 150 ms | 7 | 11 | 35 | 38,9 / 16,7 / 23,3 | 1,4 | 4 | 8 |
| T × 0,8 | 350 ms | 7 | 11 | 35 | 38,9 / 16,7 / 23,3 | 2,6 | 5 | 8 |
| T × 1,0 (đề xuất, mục 3.3) | 100 / 150 / 350 ms | 8 / 10 / 12 | 18 / 16 / 14 | 34 / 32 / 30 | 23,5 / 29,4 / 35,3 (F1) | 1,8 / 2,5 / 4,8 | 6 / 6 / 9 | 10 |
| T × 1,25 | 100 ms | 13 | 20 | 29 | 39,4 / 31,0 / 34,7 | 3,3 | 9 | 10 |
| T × 1,25 | 150 ms | 15 | 18 | 27 | 45,5 / 35,7 / 40,0 | 4,6 | 10 | 10 |
| T × 1,25 | 350 ms | 16 | 17 | 26 | 48,5 / 38,1 / 42,7 | 8,4 | 13 | 10 |

Không có điểm làm việc nào vừa tăng recall vừa giữ FP ở clip không đòn bằng v1 (4): recall tăng kéo FP theo.

## 6. Kiểm thử

- Toàn bộ `python-worker` (bản sao ở thư mục tạm, venv repo): **994 passed, 105 subtests passed, 0 failed**
  (baseline 976 passed, 105 subtests; +18 test mới trong `test_punch_geometry.py`).
- Test mới (18):
  - Cùng chuyển động đấm ngang (độ vươn 0,5 → 1,10 thân) render ở 16:9, 9:16, 1:1: đúng 1 đòn, cùng khung bắt đầu/impact/kết thúc;
    và cùng quyết định khi người nhỏ bằng nửa; `peak_speed` giống nhau tới 6 chữ số ở ba khung.
  - Đối chứng: v1 trên cùng chuyển động cho 0 đòn ở 16:9 và 1 đòn ở 9:16/1:1 (bằng chứng của lỗi).
  - Đột biến thử tay: bỏ `aspect` làm test bất biến thất bại (khung kết thúc lệch).
  - `BodyScaleTracker`: hệ số, EMA đúng công thức, hold/hết hạn, reset, thân suy biến, x đẳng hướng; hông mất thì giữ rồi từ chối.
  - Cấu hình: mặc định là v1 (không hậu tố), `from_env`, giá trị sai ném lỗi, `aspect` sai chỉ bị từ chối ở `body_units`.
  - `restart_on_reextension`: chu trình hụt treo chặn đòn thật (0 đòn) nhưng khi bật cho 1 đòn bắt đầu ở cú bung tay thật;
    đáy nông không tách đòn; cờ không có tác dụng trên đòn thường.
  - `ActionPipeline` truyền `frame_aspect`/cấu hình; `process_video` (qua replay) ghi hậu tố đúng vào `detectorVersion`.
- Mặc định không đổi hành vi: so toàn bộ JSON kết quả của 12 bản ghi giữa mã gốc và mã đã vá (cấu hình mặc định): giống
  nhau mọi trường trừ `analysisQuality.evaluatedAt`, `baseline.generatedAt`, `meta.timingsSeconds` (dấu thời gian).
  Việc tách `_start_cycle`/`_launch_condition` khỏi khối phóng đòn là refactor giữ nguyên hành vi.

## 7. Khuyến nghị

| Hạng mục | Quyết định | Lý do |
| --- | --- | --- |
| `geometry_mode = "body_units"` | **Giữ opt-in, không đổi mặc định** | Bất biến khung 12/12 và timing tốt hơn ở 100–150 ms, nhưng ở 350 ms F1 −7,8 điểm (43,1 → 35,3), 003 → 0 TP, FP clip không đòn 4 → 10; kết quả phụ thuộc đơn điệu vào hằng số chuẩn (mục 5) nên cần hiệu chỉnh trên dữ liệu giữ lại |
| `restart_on_reextension` | **Loại (cờ giữ tắt, có thể xoá)** | +1 TP và +1 FP ở 350 ms, nằm trong dao động tình cờ; thay đổi FSM không chứng minh được lợi ích |
| Nhánh chồng lấn ở RETRACTING | **Loại (đã bỏ khỏi bản vá)** | Gần như không thể kích hoạt (mục 1.4) |
| Nâng `legacy_fsm_v1 → v2` | **Không** | Mặc định không đổi hành vi; hậu tố `+body_units_v1`/`+reextend_v1` đủ phân biệt |

Điều kiện để xem lại việc đặt `body_units` làm mặc định (ngoài phạm vi, không làm ở đây):

1. Tập giữ lại có nhãn thưa (không dày như 002/003), nhiều khung hình/khoảng cách quay, rà soát nhãn độc lập; rồi mới
   hiệu chỉnh ngưỡng theo đơn vị thân (đặc biệt `min_extension_disp`, `min_extension_disp_ratio`, ngưỡng hủy khi rút tay) và
   báo cáo cạnh mức tình cờ.
2. Cùng lúc xử lý nguồn FP đã biết ở mục 3.2 (sai người/vung tay đi bộ) và đưa `kick_event_detector_v2`, `PostureGate` sang
   đơn vị đẳng hướng/thân để bất biến khung đúng đầu-cuối.

## 8. Giới hạn

- Toàn bộ nhãn là tập phát triển, một người rà soát. Nhãn 002/003 dày: số 003 không phân biệt được với tình cờ ở 350 ms
  (cả bản v1 lẫn các biến thể); đọc 003 chỉ ở mức "geometry không bắt được gì, v1 cũng không có tín hiệu".
- 002/003/005 chỉ có pose lưu (làm tròn 4 chữ số); 6 clip `vid_*` cũng chạy từ pose lưu thay vì suy luận mới. Replay
  vid_03 ra 1 đòn (suy luận mới 0, xem báo cáo trước).
- `PostureGate` vẫn dùng ngưỡng tuyệt đối theo chiều cao ảnh (chỉ x được nhân aspect); người đứng xa/gần vẫn bị gate xử lý
  khác nhau. `kick_event_detector_v2`, `KickAnalyzer`, shadow, tracker không đổi.
- Tính cỡ thân dựa vào hông và vai: khi bị che quá 1.200 ms, FSM đấm im lặng thay vì đoán. Tỉ lệ khung có cỡ thân hợp lệ
  (conf >= 0,25, chưa tính giữ cỡ) từ 34% (vid_03) đến 100% (002, 003, vid_01); VIDEO_DATA_004 là 0%. Chưa đo riêng tác động của việc từ chối.
- `τ` = 600 ms và `hold` = 1.200 ms suy từ thời lượng chu trình tối đa; không chạy độ nhạy cho hai giá trị này.
- Số liệu đấm ở 350 ms của "legacy" là 14/9/28 (replay) so với 14/8/28 của báo cáo trước (suy luận mới): chênh một FP
  do replay vid_03.

## 9. Tệp và cách chạy lại

Bản vá (không áp vào repo; kiểm bằng `git apply --check`):
`C:\Users\DAN\AppData\Local\Temp\claude\d--test-ai\ba68379a-7acf-4a15-ac3b-5e02510f9375\scratchpad\detector_geometry\detector_geometry.patch`.
Sửa: `python-worker/punch_analyzer.py`, `python-worker/process_video.py`, `python-worker/pipeline/action_pipeline.py`.
Thêm: `python-worker/test_punch_geometry.py`, `python-worker/benchmark_results/detector_geometry_20261006_tools/*.py`
(`geom_replay`, `geom_eval`, `geom_invariance`, `geom_trace`, `geom_tables`, `torso_stats`). Bản vá dựa trên nội dung hiện tại
của `process_video.py` (có sửa chưa commit của người dùng).

```powershell
# sau khi áp bản vá: sao chép mã sang thư mục riêng, rồi (bộ công cụ cũ + mới)
$W="D:\test\ai\python-worker"; $X="$env:TEMP\detector_geometry"; $PY="$W\.venv\Scripts\python.exe"
$T="$W\benchmark_results\detector_geometry_20261006_tools"; $R="$W\benchmark_results\detector_remeasure_20261006_tools"
New-Item -ItemType Directory -Force "$X\src","$X\out" | Out-Null
Copy-Item "$W\*.py","$W\*.json","$W\requirements.txt" "$X\src"; Copy-Item "$W\pipeline","$W\ground_truth" "$X\src" -Recurse
New-Item -ItemType Directory -Force "$X\src\benchmark_results" | Out-Null; Copy-Item "$W\benchmark_results\detector_*_tools" "$X\src\benchmark_results" -Recurse
$env:DETECTOR_SRC="$X\src"; $env:WORKER_DIR=$W; $env:PYTHONDONTWRITEBYTECODE="1"; cd "$X\src"
foreach ($v in "legacy","geom","overlap","both") {
  & $PY "$T\geom_replay.py" $v "$X\out\$v"                      # biến thể qua biến môi trường opt-in
  & $PY "$R\control.py" "$X\out\$v" "$X\out\control_$v.json"    # mức tình cờ (control.py cũ, không đổi)
}
& $PY "$T\geom_eval.py" "$X\out\eval_all.json" legacy="$X\out\legacy" geom="$X\out\geom" overlap="$X\out\overlap" both="$X\out\both"
& $PY "$T\geom_tables.py" "$X\out" legacy geom overlap both        # bảng Markdown
& $PY "$T\geom_invariance.py" geom                                # bất biến khung (INV_NO_SUPPRESS=1 để tách FSM)
& $PY -m pytest -q -p no:cacheprovider                            # 994 passed, 105 subtests passed
```

`geom_replay.py` ánh xạ biến thể `geom` → `PUNCH_GEOMETRY_MODE=body_units`, `overlap` →
`PUNCH_RESTART_ON_REEXTENSION=on`, `both` = cả hai; `geom:troref=1.25` chạy độ nhạy ở mục 5.
