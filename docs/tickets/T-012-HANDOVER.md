# T-012 Handover (phần A)

- Nhánh: `feat/T-012-ai-demo`. Commit: xem `git log`; script và test ở `67c9fc0` (Codex), kết quả chạy thật trong commit kèm handover này.
- Trạng thái: IN REVIEW
- Người làm: Codex viết `demo_t012_summary.py` và test, nhưng không chạy được video vì ticket có hai tham số sai (`--martial-art boxing`, `--model yolov8n-pose.pt`), rồi hết hạn mức. Ticket đã sửa. Chủ dự án yêu cầu bỏ qua Codex để làm nhanh (25/10), nên Claude chạy các lệnh và viết handover này.

## Thay đổi

- `python-worker/demo_t012_summary.py`, `test_demo_t012_summary.py` (Codex, `67c9fc0`): tóm tắt sự kiện đấm, dùng lại `match_bipartite_predictions` và bộ đọc nhãn của T-022, kiểm contract.
- `python-worker/benchmark_results/t012_demo/`: `vid_01_run1.json`, `adam_run1.json` (result), `summary.md` (bảng cho người trình bày, clip đã chọn), `summary_vid_01.md`, `summary_adam.md`, `run_info.json` (hash video và model, lệnh, độ ổn định, contract, thời gian), log từng lần chạy.
- Không sửa worker, detector, ngưỡng, backend hay frontend.

## Kết quả

| Ứng viên | Nhãn bắt được | Ngoài mọi nhãn (±3 khung) | Thời lượng |
| --- | --- | --- | --- |
| vid_01_cross_heavybag | **5/5** | **0** | 10,1 s, 608 khung, 60 fps |
| Adam | 8/18 | 3 (5 không ghép một-một) | 597 khung |

- **Clip chọn: `vid_01_cross_heavybag.mp4`**, theo tiêu chí (a): không có dự đoán ngoài nhãn. Nhãn 5 của `gt_01` (jab, khung 406–444) là `PROBE`/`OUT_OF_SCOPE` trong file nhãn gốc, nên chỉ có 5 nhãn trong phạm vi chấm.
- **Ổn định:** hai lần chạy vid_01 cho cùng `punches`: impact frame 75, 132, 184, 370, 578, đều tay phải.
- **Contract** (`workerResultBoundarySchema`): đạt cả năm điều kiện; `schemaVersion = 1.0.0`, `detectorVersion = legacy_fsm_v1`.
- **Thời gian xử lý trên CPU** (`meta.timingsSeconds.frames`): 154,5 s ở lần 1 (chạy song song với Adam), 52,9 s ở lần 2 (chạy một mình). Phần B nên dự tính khoảng 1 phút.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí | Đáp ứng ở đâu |
| --- | --- |
| 1 | Bảng trên; `run_info.json` (`selection_reason`) |
| 2 | `run_info.json`: `stable_punches_run1_vs_run2 = true` |
| 3 | `run_info.json`: `contract_checks_pass = true`, `detectorVersion`, `timingsSeconds` |
| 4 | `summary.md`: 5 dòng, khớp 5 `punches` trong `vid_01_run1.json`, có tổng và câu giới hạn |
| 5 | Chỉ thêm file trong `python-worker/demo_t012_summary.py`, test, `benchmark_results/t012_demo/`, handover |
| 6 | `test_demo_t012_summary.py` |

## Lệnh đã chạy

```text
$ python -m pytest -q test_demo_t012_summary.py test_punch_analyzer.py test_pipeline.py test_worker_delivery.py test_release_safety.py
.............................................                            [100%]
45 passed in 5.11s
$ python process_video.py --help        -> exit 0
$ python demo_t012_summary.py --help    -> exit 0
```

Python: `D:/test/ai-worktrees/T-022/python-worker/.venv/Scripts/python.exe`, chạy với `PYTHONIOENCODING=utf-8` (console cp1252 lỗi với ký tự tiếng Việt trong log của `process_video.py`).

## Lệch so với ticket

- Lần chạy thứ hai của vid_01 dùng để so độ ổn định; file result không commit (trùng lần 1), kết quả ghi trong `run_info.json`.
- Hai lần chạy lỗi tham số của Codex không tính vào số lần chạy (ticket đã ghi).

## Câu hỏi / việc còn mở

- Phần B (Dan, 30/10): upload `vid_01_cross_heavybag.mp4`, so số cú đấm trên màn kết quả với `summary.md` (5 cú, tay phải).
