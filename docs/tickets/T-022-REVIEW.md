# T-022 Review

- Ngày review: 24/10/2026, Claude.
- Phạm vi: `feat/T-022-punch-detector-recall`: `4044a65` (phần dở của lượt Gemini 20/10, Claude commit khi lượt đó hết quota), `e49268e` (Claude merge `fight-camp`), `9daf8a7`, `bfd4d93`, `9551112` (Codex, 24/10).
- **Kết luận: APPROVED như kết quả âm tính** (tiêu chí 8). Không ứng viên nào trong C01–C12 đạt; detector giữ nguyên, không thêm `PUNCH_DETECTOR`. Không có vấn đề mức "chặn".

## Lệnh đã chạy lại (trong `python-worker`, `.venv`)

```text
pytest (8 file bắt buộc) : 66 passed in 11.02s
run_strike_suite.py --validation-only : exit 0, đủ 6 clip (vid_04: punches 2, kicks 1; vid_05: 1, 2; vid_06: 1, 0)
evaluate_punch_recall.py --help : exit 0
```

Không chạy lại TEST bằng cấu hình mới. Claude chỉ đọc cache và các file JSON đã commit.

## Số liệu (từ `benchmark_results/punch_recall_t022_baseline.json`, `_final.json`)

| Tập | Baseline C00 | Cuối (C00 dự phòng) |
| --- | --- | --- |
| Adam (DEV-1) | 8/18 | 8/18 |
| DEV-2 TP/FP/FN | 6/6/0 | 6/6/0 |
| V4 (DEV-3) | 0/71 | 0/71 |
| TEST V6 + V10 | 0/124 | 0/124 |

## Đối chiếu tiêu chí

| Tiêu chí | Kết quả | Ghi chú |
| --- | --- | --- |
| 1 | Đạt | Baseline commit riêng (`bfd4d93`) trước file kết quả cuối, có hash; tái hiện đúng Adam 8/18 và DEV-2 6/6/0 |
| 2 | Đạt | Đủ 12 ứng viên kèm kết quả DEV và lý do loại (`dev_eligibility`) |
| 3, 4 | KHÔNG ĐẠT (chấp nhận) | Mọi ứng viên vi phạm ràng buộc DEV-2 (FP tăng hoặc có FN); `selected_eligible_candidate_id = null` |
| 5 | Đạt | Dư chưa kiểm chứng trên TEST là 0 |
| 6 | Đạt | TEST chạy một lần (`timestamp` 2026-10-24T09:02Z, `configuration_sha256`). Sau lần chạy chỉ sửa chuỗi `print` (bỏ ký tự ✅ làm hỏng console cp1252), có ghi ở `post_evaluation_cli_fix`; không đổi phép tính |
| 7 | Đạt | Handover nêu lệnh kiểm tra lịch sử ba file detector, kết luận TEST "gần độc lập", và nói rõ không chứng minh độ chính xác loại đòn |
| 8 | Đạt | Handover ghi "KHÔNG ĐẠT", số liệu thật và chẩn đoán |
| 9 | Đạt | Không commit nào sửa `punch_analyzer.py`, `punch_event_detector_v2.py`, `pipeline/`; strike suite vẫn 6/6/0 |
| 10 | Đạt | `test_evaluate_punch_recall.py` có 10 ca, bộ bắt buộc 66 qua |

## Kiểm chứng thêm của Claude: vì sao BoxingVI ra 0

Mọi ứng viên FSM đều ra 0 trên V4, nên Claude kiểm xem có phải lỗi lệch khung hay lỗi cache không:

- Cache V4, V6, V10 dùng khung tuyệt đối (`frameIdx` 19000–20499, 36500–37999, 4000–5499), cùng hệ với nhãn.
- 1.500/1.500 khung có đủ 17 keypoint, `observationKind = fresh_detection`.
- Baseline không có dự đoán nào trên TEST (0 TP, 0 dư), nên đây không phải lỗi ghép.

Kết luận giống handover: detector cũ không bao giờ tới trạng thái impact trên cảnh thi đấu quay từ xa (854×480, khoảng 24 khung/giây, hai võ sĩ). C10 (shadow) bắt được 43/71 trên V4 nhưng sinh 41 FP trên DEV-2.

## Vấn đề

| # | Mức | Vị trí | Vấn đề | Xử lý |
| --- | --- | --- | --- | --- |
| 1 | Gợi ý | `evaluate_punch_recall.py` | Chuỗi `print` có emoji làm hỏng console Windows cp1252 | Đã sửa trong `9551112` |
| 2 | Gợi ý | Cho T-012 | Detector hiện có ra 0 trên video thi đấu BoxingVI | T-012 phải dùng video bao cát hoặc một người, giống Adam và vid_01. Không demo trên cảnh thi đấu hai người |

## Việc tiếp theo

- Chủ dự án merge `--no-ff` khi đồng ý (chỉ có script đo và kết quả, không đổi hành vi worker).
- T-012 (Codex): chọn video demo theo vấn đề 2.
