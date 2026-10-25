# Giao thức đo và quy tắc chọn cấu hình detector đấm (T-022)

**Ticket:** T-022 · Tăng recall của detector đấm  
**Trạng thái giao thức:** ĐÓNG BĂNG TRƯỚC KHI THỬ CẤU HÌNH  
**Thời điểm tạo:** 2026-10-20  
**Tập dữ liệu:** DEV-1 (Adam), DEV-2 (vid_01..06), DEV-3 (BoxingVI V4), TEST (BoxingVI V6, V10)  

---

## 1. Giao thức đo (Evaluation Protocol)

### 1.1 Khái niệm detection và khoảng ghép
- Một detection là một cú đấm có trường `impactFrame` (và `startFrame`, `endFrame`) trong mảng `punches` do detector trả về.
- Đoạn nhãn ground-truth `[start_frame, end_frame]` **được nhận ra** nếu tồn tại ít nhất một detection có `impactFrame` nằm trong đoạn đóng `[start_frame - 3, end_frame + 3]`.
- **Ghép một-một tối ưu:**
  - Mỗi detection chỉ được ghép với tối đa một đoạn nhãn ground-truth.
  - Mỗi đoạn nhãn ground-truth chỉ được ghép với tối đa một detection.
  - Thuật toán ghép: Min-Cost Max-Flow trên đồ thị hai phía (bipartite matching) để:
    1. Tối đa hóa số cặp ghép được (cardinality).
    2. Trong các phương án tối đa số cặp, tối thiểu hóa tổng độ lệch thời gian/khung hình tới điểm giữa của đoạn nhãn: `cost = abs(impactFrame - (start_frame + end_frame) / 2.0)`.

### 1.2 Các chỉ số báo cáo
- **Chỉ số chính:** `recall = số nhãn được nhận ra / tổng số nhãn ground truth`. Báo cáo riêng từng video và gộp theo tập (DEV, TEST).
- **Chỉ số phụ:** `evaluate_intervals` (theo `pipeline/boxing_research.py`) với `min_iou=0.1` (gồm precision, recall, F1 khoảng thời gian).
- **Phát hiện nhận trùng (duplicates):** Số đoạn nhãn ground-truth có từ 2 detection trở lên có `impactFrame` rơi vào `[start_frame - 3, end_frame + 3]`.
- **Dương tính giả (FP) và Dư chưa kiểm chứng (Unverified Excess):**
  - Trên **DEV-2** (clip kiểm chứng `vid_01..06`): Mọi detection không ghép được với nhãn in-scope là **False Positive (FP)**.
  - Trên **BoxingVI** (V4, V6, V10): Vì nhãn công khai BoxingVI chỉ đánh dấu các đòn đánh mà không cam kết gán nhãn toàn bộ các khoảng nghỉ, các detection không ghép được ghi nhận là **"dư chưa kiểm chứng" (unverified excess)**, không gọi là FP.
  - Mật độ dư chưa kiểm chứng: `unverified_excess_per_1000_frames = (unverified_excess / total_evaluated_frames) * 1000`.
- **Tính tương thích benchmark 15/09 trên DEV-2:**
  - Chạy song song `run_strike_suite.py --validation-only` và `evaluate_punch_detector.py::run_evaluation_suite` (dung sai 350 ms) để đối chiếu trực tiếp với kết quả 15/09 (6 TP / 6 FP / 0 FN).

---

## 2. Quy tắc cắt cửa sổ BoxingVI (Window Cutting Rules)

Do các video BoxingVI gốc rất dài (V4: 35.363 khung; V6: 46.704 khung; V10: 26.917 khung), suy luận YOLOv8n-pose trên CPU đạt ~4–7 khung/giây. Để đảm bảo đo đạc khả thi, không bị tràn bộ nhớ hay gián đoạn phiên và có thể tái lập nhanh, giao thức áp dụng quy tắc cửa sổ cố định như sau:

1. **Độ dài cửa sổ cố định:** `W = 1.500 khung hình` liên tục (tương đương ~62,5 giây thi đấu liên tục ở 23.976 / 25 fps, đủ để chứa hàng chục chuỗi đòn đa dạng).
2. **Quy tắc chọn vị trí cửa sổ (xác định trước trên file nhãn ground-truth CSV, hoàn toàn độc lập với detector):**
   - Chọn cửa sổ 1.500 khung hình liên tục (căn theo bội số 500 khung hình) có **số lượng nhãn đòn cao nhất** trong file annotation CSV.
3. **Các cửa sổ cố định được áp dụng:**
   - **DEV-3 (V4, `IVvOmoB88FM.mp4`):** Khung `[19000, 20500)` (độ dài 1.500 khung). Chứa **71** nhãn đòn ground-truth.
   - **TEST-1 (V6, `cQW-h8yGbRc.mp4`):** Khung `[36500, 38000)` (độ dài 1.500 khung). Chứa **85** nhãn đòn ground-truth.
   - **TEST-2 (V10, `OfZFdwW322E.mp4`):** Khung `[4000, 5500)` (độ dài 1.500 khung). Chứa **39** nhãn đòn ground-truth.
4. Tổng số nhãn được kiểm tra:
   - DEV: 18 (Adam) + 6 (DEV-2 in-scope) + 71 (V4) = **95 nhãn**.
   - TEST: 85 (V6) + 39 (V10) = **124 nhãn**.

---

## 3. Danh sách 12 cấu hình ứng viên (Candidate Configurations)

Các cấu hình được chia thành 3 họ (Family A, Family B, Family C) và đánh số từ C01 đến C12:

### Baseline (C00)
- **ID:** `baseline_legacy`
- **Bộ nhận diện:** `PunchAnalyzer` với `PunchDetectorConfig` mặc định hiện tại:
  `min_extension_disp_ratio=0.30, min_extension_disp=0.07, min_elbow_angle_straight=135.0, min_elbow_angle_hook=80.0, max_elbow_angle_hook=125.0, min_retraction_ratio=0.35, min_extension_speed=0.50, refractory_cooldown_ms=200.0, min_punch_duration_ms=100.0, max_punch_duration_ms=1200.0`.

### Họ C: Điều chỉnh ngưỡng FSM (`PunchDetectorConfig`)
- **C01 (`c_fsm_mild_relax`):**
  Nới nhẹ góc duỗi và tỷ lệ vươn/thu: `min_elbow_angle_straight=125.0, min_extension_disp_ratio=0.25, min_retraction_ratio=0.25, refractory_cooldown_ms=150.0`.
- **C02 (`c_fsm_moderate_relax`):**
  Nới vừa phải góc duỗi, độ vươn và vận tốc kích hoạt: `min_elbow_angle_straight=120.0, min_extension_disp_ratio=0.20, min_retraction_ratio=0.20, min_extension_speed=0.40, refractory_cooldown_ms=120.0`.
- **C03 (`c_fsm_fast_combo`):**
  Tập trung bắt chuỗi đòn nhanh (giảm thời lượng tối thiểu và cooldown): `min_elbow_angle_straight=125.0, min_extension_disp_ratio=0.20, min_retraction_ratio=0.20, min_punch_duration_ms=80.0, refractory_cooldown_ms=100.0`.
- **C04 (`c_fsm_angle_only`):**
  Chỉ nới góc cùi chỏ, giữ nguyên các ngưỡng dịch chuyển và tốc độ: `min_elbow_angle_straight=120.0, min_elbow_angle_hook=75.0, max_elbow_angle_hook=130.0`.
- **C05 (`c_fsm_deep_combo`):**
  Nới sâu toàn diện ngưỡng hình học và ngưỡng dịch chuyển vi mô: `min_elbow_angle_straight=120.0, min_extension_disp_ratio=0.22, min_extension_disp=0.05, min_retraction_ratio=0.22, min_extension_speed=0.35, refractory_cooldown_ms=120.0`.

### Họ A: Bộ nhận diện đỉnh vươn cổ tay độc lập (`PunchEventDetectorV2Config`)
- **C06 (`a_v2_default`):**
  Tham số mặc định trong `punch_event_detector_v2.py`: `min_keypoint_confidence=0.40, min_horizontal_extension=0.15, min_peak_prominence=0.01, peak_radius_frames=3, evidence_radius_frames=6, same_arm_refractory_frames=4, cross_arm_duplicate_frames=2`.
- **C07 (`a_v2_sensitive`):**
  Tăng độ nhạy với đòn ngắn và đòn nhanh: `min_keypoint_confidence=0.30, min_horizontal_extension=0.10, min_peak_prominence=0.008, peak_radius_frames=2, evidence_radius_frames=5, same_arm_refractory_frames=3, cross_arm_duplicate_frames=2`.
- **C08 (`a_v2_conservative`):**
  Tăng ngưỡng độ vươn và độ nổi để hạn chế FP: `min_keypoint_confidence=0.40, min_horizontal_extension=0.18, min_peak_prominence=0.015, peak_radius_frames=3, evidence_radius_frames=6, same_arm_refractory_frames=5, cross_arm_duplicate_frames=2`.
- **C09 (`a_v2_moderate`):**
  Mức cân bằng giữa độ nhạy và chống nhiễu: `min_keypoint_confidence=0.35, min_horizontal_extension=0.12, min_peak_prominence=0.012, peak_radius_frames=3, evidence_radius_frames=6, same_arm_refractory_frames=4, cross_arm_duplicate_frames=2`.

### Họ B: Bộ nhận diện sự kiện shadow chuẩn hóa thân người (`EventDetectorConfig`)
- **C10 (`b_shadow_default`):**
  Tham số mặc định trong `pipeline/strike_events.py`: `min_confidence=0.4, min_reach=0.65, min_prominence=0.04, min_extension_speed=0.5, refractory_ms=160.0, peak_radius_ms=120.0, evidence_radius_ms=240.0`.
- **C11 (`b_shadow_conservative`):**
  Ngưỡng cao để kiểm soát chặt FP: `min_confidence=0.5, min_reach=0.75, min_prominence=0.06, min_extension_speed=0.8, refractory_ms=200.0, peak_radius_ms=120.0, evidence_radius_ms=240.0`.
- **C12 (`b_shadow_moderate`):**
  Ngưỡng trung bình: `min_confidence=0.45, min_reach=0.70, min_prominence=0.05, min_extension_speed=0.6, refractory_ms=180.0, peak_radius_ms=120.0, evidence_radius_ms=240.0`.

---

## 4. Quy tắc chọn cấu hình trên DEV (Selection Rule)

Cấu hình tốt nhất được chọn **DUY NHẤT bằng tập DEV**, theo các bước ưu tiên nghiêm ngặt sau:

1. **Ràng buộc cứng 1 (Bảo toàn Recall DEV-2):**
   Trên tập DEV-2 (`vid_01..06`), `FN` phải giữ nguyên là **0** (phát hiện đủ 5/5 đòn vid_01 và 1/1 đòn vid_04).
2. **Ràng buộc cứng 2 (Bảo toàn False Positives DEV-2, Tiêu chí 4):**
   Trên tập DEV-2, tổng `FP` không được vượt quá baseline (**tối đa 6 FP**).
   Đồng thời không xuất hiện thêm bất kỳ detection mới nào trên các clip không có đòn đấm (`vid_02 <= 3, vid_03 == 0, vid_05 <= 1, vid_06 <= 1`).
   *Bất kỳ cấu hình nào vi phạm ràng buộc 1 hoặc 2 đều bị LOẠI NGAY LẬP TỨC.*
3. **Mục tiêu tối ưu hóa chính:**
   Trong các cấu hình thỏa mãn ràng buộc cứng 1 và 2, chọn cấu hình có **Recall gộp trên tập DEV cao nhất** (tổng số nhãn đúng trên Adam + V4 chia cho tổng số nhãn trên Adam + V4).
4. **Quy tắc giải hòa (Tie-breaking):**
   - Nếu hai cấu hình có cùng Recall gộp DEV: Chọn cấu hình có số lượng "dư chưa kiểm chứng" trên DEV-3 (V4) thấp hơn.
   - Nếu vẫn bằng nhau: Chọn cấu hình có Macro F1 (theo chỉ số phụ IoU) cao hơn.
   - Nếu vẫn bằng nhau: Ưu tiên theo thứ tự kiến trúc FSM (Họ C) > V2 (Họ A) > Shadow (Họ B) để giảm thiểu biến động mã nguồn.

Sau khi đã chọn đúng 01 cấu hình tốt nhất trên DEV theo quy tắc trên, cấu hình đó sẽ được đưa vào chạy trên tập TEST **đúng một lần duy nhất** để ghi nhận kết quả cuối cùng.
