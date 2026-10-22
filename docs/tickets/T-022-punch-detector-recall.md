# T-022 · Tăng recall của detector đấm

| | |
| --- | --- |
| **Trạng thái** | READY (chủ dự án duyệt 20/10, [quyết định 20](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)) |
| **Phần** | Worker (`python-worker`) |
| **Nhánh** | `feat/T-022-punch-detector-recall` từ `fight-camp` mới nhất |
| **Người nhận** | Gemini |
| **Phụ thuộc** | Không. Không chặn ticket Fight Camp nào. Nên xong trước 26/10 để demo AI (T-012, 27–29/10) biết dùng detector nào |

## Bối cảnh

Worker hiện chạy detector đấm `legacy_fsm_v1` (máy trạng thái trong `python-worker/punch_analyzer.py`). Chủ dự án đã bỏ che kết quả AI trên giao diện (commit `7d4a9b3`), nên người dùng thấy đúng chất lượng của detector. Số đo ngày 20/10, chạy qua worker thật:

- **Adam** (`adam.mp4`, nhãn `adam_gt.csv`, 18 đoạn): chỉ **8/18** đoạn có detection trong đoạn. Bỏ sót 10 đoạn, gồm Cross, Hook, Uppercut ở các chuỗi nhanh. 2 đoạn bị nhận trùng. 3 detection nằm ngoài mọi nhãn. Cả 13 cú đều là `Unknown punch`.
- **6 clip kiểm chứng** (`validation_videos/vid_01…06`, nhãn `ground_truth/gt_0*.json`): 6 TP / 6 FP / 0 FN (precision 50%, recall 100%). Không tụt so với benchmark 15/09 (6/10/0).
- Báo cáo `docs/archive/ai/AI-DETECTOR-REMEASURE-20261006.md`: 17/28 lần bỏ sót đòn đấm (61%) là do chu trình FSM bị hủy vì không đạt ngưỡng hình học (vươn tay, góc khuỷu, tốc độ), không phải do thiếu pose. `punch_event_detector_v2.py` được viết cho đúng vấn đề này ("FSM cũ đợi hết một chu trình về thế thủ, nên gộp các chuỗi nhanh") nhưng chỉ có test, chưa được `process_video.py` gọi. Detector shadow `pipeline/strike_events.py::detect_punch_events` có recall cao hơn nhưng bắn nhiều cú giả trên clip không có đòn.

Mục tiêu của ticket: **tăng recall trên video chưa dùng để chỉnh**, giữ số cú giả không tăng. Chủ dự án không còn video riêng, nên dữ liệu đo là dữ liệu công khai BoxingVI (xem "Dữ liệu").

## Nguyên tắc bắt buộc (đã nằm trong benchmark 15/09)

1. **Không nới ngưỡng theo một video.** Mọi thay đổi chỉ được chọn bằng tập DEV; tập TEST chạy đúng một lần, ở cuối.
2. **Đóng băng trước, sửa sau.** Giao thức đo, danh sách cấu hình thử và baseline được commit trước khi đổi detector.
3. **Kết quả âm tính được chấp nhận.** Nếu không cấu hình nào đạt tiêu chí, báo cáo trung thực và dừng; không nới tiêu chí, không đổi cách đếm để đạt.
4. Số đo chỉ nói về **phát hiện sự kiện**, không nói gì về độ chính xác loại đòn hay chấm kỹ thuật.

## Dữ liệu

Tất cả nằm trong `python-worker/test_results/` (thư mục không được git theo dõi; không commit video).

| Tập | Nguồn | Nhãn | Dùng để |
| --- | --- | --- | --- |
| DEV-1 | `test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6/adam.mp4` | `adam_gt.csv` cùng thư mục (18 dòng; frame inclusive, 30 fps, 600 khung) | Chỉnh và chọn cấu hình |
| DEV-2 | `validation_videos/vid_01…06.mp4` (60 fps) | `ground_truth/gt_01…06_*.json`, chỉ tính `evaluation_scope == "IN_SCOPE"` và `label == "PUNCH"` (vid_01: 5, vid_04: 1) | Chỉnh; đo số cú giả. `vid_02, 03, 05, 06` không có đòn đấm trong phạm vi nên mọi detection ở đó là FP |
| DEV-3 | BoxingVI **V4**: `test_results/external/boxingvi_original_20261006/rgb/IVvOmoB88FM.mp4` (35.363 khung, 23,976 fps) | `test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6/clean_annotation_data/V4.csv` (560 đoạn) | Chỉnh |
| TEST | BoxingVI **V6** `rgb/cQW-h8yGbRc.mp4` (46.704 khung, 685 đoạn, `V6.csv`) và **V10** `rgb/OfZFdwW322E.mp4` (26.917 khung, 25 fps, 152 đoạn, `V10.csv`) | như trên | Đo cuối, một lần |
| TEST-mở rộng (tùy chọn) | BoxingVI V1, V2, V3, V5, V7, V8, V9: link YouTube trong `test_results/external/boxingvi_original_20261006/video_metadata_rows.json`, nhãn `V*.csv` đã có | như trên | Chỉ khi **chủ dự án** đặt file RGB vào `test_results/external/boxingvi_original_20261006/rgb/`. Gemini **không tự tải** video từ YouTube |

Giới hạn cần ghi trong handover:

- Nhãn BoxingVI chỉ đánh dấu các đòn; khoảng giữa các nhãn **không** chắc là không có đòn. Vì vậy trên BoxingVI chỉ đo **recall**; số detection ngoài mọi nhãn ghi là "dư chưa kiểm chứng", không gọi là FP. Số cú giả chỉ đo ở DEV-2.
- V4, V6, V10 từng được dùng để chỉnh **tracker** (`docs/archive/ai/AI-TRACKER-IDENTITY-20261006.md`) và làm tập chẩn đoán cho model phân loại. Chưa thấy ghi nhận chúng dùng để chỉnh ngưỡng detector đấm. Gemini kiểm tra lịch sử git của `punch_analyzer.py`, `punch_event_detector_v2.py`, `pipeline/strike_events.py` và ghi kết luận vào handover. Vì vậy TEST ở đây là "gần độc lập", không phải độc lập hoàn toàn; kết luận của báo cáo phải nói rõ điều này.
- Adam nằm trong tập huấn luyện model phân loại (quyết định 06/10). Điều đó không ảnh hưởng detector không học, nhưng không được dùng Adam để nói về phân loại.
- FPS khác nhau theo video (24000/1001, 25, 30, 60). Không đổi khung sang giây bằng một FPS cố định.
- Video quá dài thì cắt theo quy tắc ghi trước vào file giao thức (ví dụ cửa sổ cố định theo số khung, liên tục, chứa nhãn); không chọn cửa sổ sau khi đã thấy kết quả.

## Phạm vi

File thêm hoặc sửa (đã kiểm tra là có thật, trừ file mới):

| File | Việc |
| --- | --- |
| `python-worker/evaluate_punch_recall.py` (**mới**) | Chấm recall theo giao thức dưới đây cho DEV/TEST; ghi JSON gồm hash video, hash mã, hash nhãn |
| `python-worker/test_evaluate_punch_recall.py` (**mới**) | Test cho cách ghép (một-một, biên, trùng, dung sai) bằng dữ liệu nhỏ tự tạo |
| `python-worker/benchmark_results/punch_recall_t022_baseline.json` (**mới**) | Baseline đóng băng của detector hiện tại |
| `python-worker/benchmark_results/punch_recall_t022_final.json` (**mới**) | Kết quả cuối |
| `python-worker/process_video.py` | Chỉ để chọn detector qua biến môi trường (xem "Thiết kế"). Vị trí hiện tại: nơi đặt `detector_version = "legacy_fsm_v1"` và gọi `detect_punch_events` (quanh dòng 319–325) |
| `python-worker/punch_event_detector_v2.py`, `python-worker/punch_analyzer.py` (`PunchDetectorConfig`), `python-worker/pipeline/strike_events.py` (`EventDetectorConfig`) | Có thể sửa tham số hoặc logic **sau khi** baseline đã đóng băng |
| `python-worker/test_punch_event_detector_v2.py`, `test_punch_analyzer.py` | Cập nhật hoặc thêm test cho phần đã đổi |

## Ngoài phạm vi

- Phân loại jab/cross/hook/uppercut, tay trái/phải, model temporal. Chưa mở.
- Detector đá và gối, chấm điểm kỹ thuật, `findings`, `coaching_delivery.py`.
- Frontend, NestJS, migration, Supabase. Không chạy `worker.py`, không kết nối Supabase hay Redis.
- Không cài thư viện. Không gọi Gemini API. Không sửa nhãn (`adam_gt.csv`, `V*.csv`, `gt_*.json`) và không thêm nhãn mới.
- Không tải video từ YouTube.
- Không đổi tracker (`person_tracker.py`) trừ khi baseline chứng minh bỏ sót do mất mục tiêu; nếu vậy ghi vào "Câu hỏi" của handover thay vì sửa.

## Thiết kế

### 1. Giao thức đo (đóng băng trước khi sửa)

Một detection là cú đấm với `impactFrame` (trường `impactFrame`, `startFrame`, `endFrame` trong đầu ra `punches` của worker; xem `result["punches"]` trong `process_video.py`). Với mỗi video:

- Đoạn nhãn **được nhận ra** nếu có detection mà `impactFrame` nằm trong `[start_frame − 3, end_frame + 3]` của nhãn. Ghép **một-một** (mỗi detection chỉ ghép tối đa một nhãn; chọn ghép tối đa số cặp rồi tối thiểu độ lệch tới giữa đoạn).
- Chỉ số chính: `recall = số nhãn được nhận ra / tổng nhãn`, tính riêng từng video và gộp.
- Chỉ số phụ: `evaluate_intervals` trong `pipeline/boxing_research.py` với `min_iou=0.1` (cùng cách `evaluate_external_boxing.py` đang dùng).
- Số detection không ghép được: trên DEV-2 là FP; trên BoxingVI là "dư chưa kiểm chứng".
- Số nhãn có từ 2 detection trở lên (nhận trùng) cũng được báo.
- Với DEV-2 dùng lại `run_strike_suite.py --validation-only` và `evaluate_punch_detector.py::run_evaluation_suite` (sai số 350 ms) để số liệu so được với benchmark 15/09.

### 2. Cấu hình ứng viên (ghi trước)

Tối đa **12** cấu hình, thuộc ba họ, ghi tên và tham số vào file giao thức trước khi chạy:

- A: `PunchEventDetectorV2Config` (`punch_event_detector_v2.py`) cho cả `shadow_boxing` (hiện chỉ dành cho `heavy_bag`).
- B: `EventDetectorConfig` của `pipeline/strike_events.py` (shadow hiện có).
- C: `PunchDetectorConfig` của FSM (`min_extension_disp_ratio`, `min_retraction_ratio`, `min_elbow_angle_straight`, `min_extension_speed`, `refractory_cooldown_ms`).

Chọn cấu hình tốt nhất **chỉ bằng DEV** theo quy tắc ghi trước (ví dụ: recall gộp DEV cao nhất, với ràng buộc FP trên DEV-2 không vượt baseline). Sau đó chạy TEST đúng một lần.

### 3. Tích hợp

Thêm biến môi trường `PUNCH_DETECTOR` (`legacy` mặc định, `v2`, `shadow`) đọc trong `process_video.py` để chọn detector đang trả `punches`. Mặc định giữ `legacy`, nên không có thay đổi hành vi nào cho tới khi chủ dự án bật. Ghi `detectorVersion` thật vào kết quả. Nếu không cấu hình nào đạt tiêu chí thì **không thêm** biến này, chỉ nộp phần đo.

## Tiêu chí nghiệm thu

1. `punch_recall_t022_baseline.json` được commit **trước** mọi thay đổi detector (commit riêng), kèm hash video, hash nhãn, hash mã, hash tham số. Baseline phải tái hiện được: Adam ra 8/18, DEV-2 ra 6 TP / 6 FP / 0 FN (sai lệch nào so với số này phải được giải thích).
2. Mọi cấu hình đã thử, kể cả cấu hình bị loại, được ghi trong `punch_recall_t022_final.json` với kết quả DEV. Số cấu hình ≤ 12.
3. Trên **TEST** (V6, V10): recall gộp tăng **ít nhất 10 điểm phần trăm tuyệt đối** so với baseline của cùng tập, và recall của từng video trong TEST **không giảm**.
4. Trên DEV-2: FN vẫn 0 và tổng FP **không tăng** so với baseline (6). Không detection mới nào xuất hiện trên `vid_02, 03, 05, 06` so với baseline.
5. Trên TEST, số "dư chưa kiểm chứng" trên mỗi 1.000 khung không tăng quá 25% tương đối so với baseline. Nếu tăng nhiều hơn, ghi rõ và nêu lý do.
6. TEST chỉ chạy một lần với cấu hình đã chọn; file kết quả ghi thời điểm chạy và hash cấu hình. Chạy lại để "thử thêm" là vi phạm.
7. Handover nói rõ: TEST là gần độc lập (nêu cách đã kiểm tra lịch sử chỉnh ngưỡng); kết quả không chứng minh độ chính xác loại đòn hay chấm kỹ thuật.
8. Nếu tiêu chí 3 hoặc 4 không đạt: handover ghi "KHÔNG ĐẠT", số liệu thật và phân tích ngắn lý do (xem lại mục chẩn đoán trong `AI-DETECTOR-REMEASURE-20261006.md`). Ticket vẫn có thể được duyệt như kết quả âm tính. Không nới tiêu chí.
9. `PUNCH_DETECTOR` mặc định là `legacy`; với mặc định, đầu ra worker trên 6 clip kiểm chứng và Adam **giống hệt** trước ticket (cùng `punches`, cùng `detectorVersion`).
10. Mọi quy tắc mới có test; test hiện có vẫn qua.

## Lệnh kiểm tra bắt buộc

Chạy trong `python-worker`, bằng Python của `.venv` (Windows: `.\.venv\Scripts\python.exe`):

```bash
python -m pytest -q test_evaluate_punch_recall.py test_punch_analyzer.py test_punch_event_detector_v2.py test_shadow_punch_expansion.py test_pipeline.py test_person_tracker.py test_worker_delivery.py test_release_safety.py
python run_strike_suite.py --validation-only --output test_results/strike_t022_after
python evaluate_punch_recall.py --help
```

Dán nguyên văn phần cuối output của từng lệnh vào handover, kèm đường dẫn hai file JSON kết quả. Claude sẽ chạy lại baseline và TEST bằng cùng cấu hình đã ghi và đối chiếu từng con số.
