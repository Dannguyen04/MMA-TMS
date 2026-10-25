# T-012 · Demo AI ngắn: chạy worker hiện có trên video bao cát

| | |
| --- | --- |
| **Trạng thái** | READY (25/10) |
| **Người nhận** | A (chạy thử offline, đo, bảng tóm tắt): Codex. B (chạy thật trên backend ở buổi tổng duyệt 30/10): Dan |
| **Phụ thuộc** | [T-022](./T-022-REVIEW.md) (APPROVED 24/10, kết quả âm tính). Nhánh T-012 tạo từ `fight-camp` rồi merge `feat/T-022-punch-detector-recall`; chủ dự án merge T-022 trước T-012 |
| **Nguồn** | [Phạm vi, quyết định 16 và 20](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi); [review T-022](./T-022-REVIEW.md) |

## Bối cảnh

Quyết định 16: phần AI đã làm được tính vào đồ án, không phát triển thêm, trình bày bằng một demo ngắn chạy worker **hiện có**. T-022 cho thấy detector cũ ra 0 cú đấm trên video thi đấu quay từ xa (BoxingVI). Trên video bao cát một người, detector chạy tốt hơn: `vid_01` thuộc bộ kiểm chứng 6 clip (toàn bộ 6 clip: 6 TP / 6 FP / 0 FN), còn Adam đạt 8/18. Demo vì vậy dùng video bao cát.

Luồng thật: HLV upload video ở `/coach/video-analysis/upload` → NestJS (`src/videos`, `src/jobs`) đẩy job vào BullMQ trên Redis → `python-worker/worker.py` nhận job, chạy `process_video`, đưa kết quả lên Supabase Storage, rồi gọi `PATCH /jobs/:id/status` (header `x-worker-secret`) → màn `/coach/video-analysis/[videoId]` hiển thị. Luồng này cần `.env` (Supabase, Redis, `WORKER_SECRET_TOKEN`), nên chỉ chủ dự án chạy được (phần B). Phần A chứng minh trước, ở chế độ offline, rằng video chọn cho ra kết quả ổn định và đúng contract mà NestJS chấp nhận.

## Phạm vi

### Phần A (Codex, offline, không có `.env`)

1. **Chọn clip.** Ứng viên: `python-worker/validation_videos/vid_01_cross_heavybag.mp4` (nhãn `ground_truth/gt_01_cross_heavybag.json`) và Adam (`test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6/adam.mp4`, nhãn `adam_gt.csv` cùng thư mục, 18 nhãn; thư mục này không nằm trong git, Claude chép sẵn vào worktree). Chạy `process_video.py` trên cả hai với `--training-mode HEAVY_BAG --martial-art boxing --model yolov8n-pose`. Chọn clip theo thứ tự ưu tiên: (a) không có dự đoán nằm ngoài mọi nhãn; (b) tỉ lệ nhãn được bắt cao hơn; (c) ngắn hơn. Ghi lý do chọn.
2. **Ổn định:** chạy clip đã chọn **hai lần**. `punches` (impact frame, tay) của hai lần phải giống hệt nhau; khác thì ghi lại và dừng (không chỉnh ngưỡng).
3. **Contract:** kiểm output khớp `workerResultBoundarySchema` trong `nestjs-api/src/jobs/jobs.service.ts`: `schemaVersion = "1.0.0"`; `meta.fps`, `meta.totalFrames`, `meta.durationMs` là số không âm; `frames`, `kicks` là mảng. Ghi `meta.detectorVersion`.
4. **Thời gian xử lý:** ghi `meta.timingsSeconds` của lần chạy (CPU) để chủ dự án biết khán giả phải chờ bao lâu ở phần B.
5. **Bảng tóm tắt cho người trình bày:** script mới `python-worker/demo_t012_summary.py` đọc file result và file nhãn, in và ghi `benchmark_results/t012_demo/summary.md`: mỗi cú đấm phát hiện có thời điểm `mm:ss.s`, tay, khớp nhãn nào. Ghép bằng `match_bipartite_predictions` và bộ đọc nhãn có sẵn trong `evaluate_punch_recall.py` (của T-022; nhánh T-012 đã có vì Claude merge nhánh T-022 vào), dung sai ±3 khung; không chép logic chấm mới. Cuối bảng ghi số nhãn bắt được trên tổng, và câu "Kết quả chỉ đếm sự kiện đấm, không chấm kỹ thuật hay phân loại đòn".
6. **Kết quả lưu ở** `python-worker/benchmark_results/t012_demo/`: hai file result JSON, `summary.md`, `run_info.json` (hash video, model, lệnh đã chạy, thời gian).

### Phần B (Dan, có `.env`, làm ở tổng duyệt 30/10)

1. Chạy Redis, backend, frontend ở API mode, và `python-worker/worker.py` với `.env` của team.
2. Đăng nhập HLV giả, upload clip đã chọn ở phần A, chọn loại buổi tập bao cát.
3. Chờ job `DONE` (thời gian tham chiếu: mục 4 phần A), mở `/coach/video-analysis/[videoId]` và so số cú đấm với `summary.md`. Lệch thì dùng `summary.md` và file result của phần A làm phương án dự phòng khi trình bày.

## Ngoài phạm vi

Sửa `punch_analyzer.py`, `punch_event_detector_v2.py`, `pipeline/`, `worker.py`, `process_video.py` hay ngưỡng nào (quyết định 16). Chạy trên video thi đấu BoxingVI. Phân loại đòn, chấm kỹ thuật. Sửa backend, frontend. Commit video mới hay file model `.pt`. Kết nối Supabase, Redis.

## Tiêu chí nghiệm thu

1. Có kết quả `process_video.py` của cả hai ứng viên; clip được chọn đúng thứ tự ưu tiên ở mục 1, có lý do ghi bằng số.
2. Hai lần chạy clip đã chọn cho cùng `punches` (so impact frame và tay), hoặc handover ghi rõ chỗ khác.
3. Output đạt cả năm điều kiện contract ở mục 3; handover ghi `detectorVersion` và thời gian xử lý.
4. `summary.md` liệt kê đủ mọi cú đấm phát hiện, kèm khớp nhãn, tổng số và câu giới hạn. Con số trong `summary.md` khớp với file result (Claude sẽ đếm lại).
5. `git diff fight-camp` không có thay đổi ở các file ngoài phạm vi; mọi test có sẵn vẫn qua.
6. `demo_t012_summary.py` có test cho phần ghép và định dạng thời gian (`test_demo_t012_summary.py`).

## Lệnh kiểm tra bắt buộc

Chạy trong `python-worker` bằng Python của `.venv`:

```bash
python -m pytest -q test_demo_t012_summary.py test_punch_analyzer.py test_pipeline.py test_worker_delivery.py test_release_safety.py
python process_video.py --help
python demo_t012_summary.py --help
```

Dán phần cuối output vào `docs/tickets/T-012-HANDOVER.md` theo [TEAM-WORKFLOW §6](../TEAM-WORKFLOW.md#6-handover-bắt-buộc-docsticketst-xxx-handovermd).

## Ghi chú cho người thực hiện

- Không cài thư viện. File `yolov8n-pose.pt` đã có trong `python-worker/` (không commit).
- Video và nhãn chỉ dùng để đo, không chỉnh ngưỡng theo chúng.
- Thấy mâu thuẫn giữa ticket và code thì ghi vào mục "Câu hỏi" của handover, không đoán.
