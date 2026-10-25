# T-012 Handover

- Nhánh: feat/T-012-ai-demo    Commit: 67c9fc0 (script + test), a125f4a (bằng chứng chạy)
- Trạng thái: IN REVIEW — phần A bị chặn, chưa đủ điều kiện nghiệm thu demo.

## Thay đổi
- `python-worker/demo_t012_summary.py`: đọc result/nhãn, dùng lại hai bộ đọc nhãn và `match_bipartite_predictions` của T-022 với ±3 khung; bảng từng impact frame/tay/nhãn, mm:ss.s và giới hạn sử dụng. Có kiểm contract trước khi lập bảng.
- `python-worker/test_demo_t012_summary.py`: kiểm ghép toàn cục một-một, biên dung sai, dự đoán trùng/ngoài nhãn, định dạng thời gian, hai bộ đọc và contract. Dữ liệu test tổng hợp, chưa xác nhận được trên output video thật.
- `python-worker/benchmark_results/t012_demo/`: log nguyên văn, run_info.json chứa SHA-256 hai video/nhãn và model, argv, exit code, thời gian lệnh; summary.md ghi BLOCKED, không ghi số liệu giả.

## Đối chiếu tiêu chí nghiệm thu
| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. Hai ứng viên, chọn đúng thứ tự | CHƯA ĐẠT. `python-worker/benchmark_results/t012_demo/run_info.json:1`: cả hai lệnh mã 1, không tạo JSON. Mỗi ứng viên gọi đúng một lần. Không thể đo ngoài nhãn, recall hoặc chọn clip. |
| 2. Hai lần clip được chọn giống impact frame/tay | CHƯA ĐO. Chưa chọn clip nên không gọi lần thứ ba; không thay tham số hay ngưỡng để né lỗi. |
| 3. Contract, detectorVersion và thời gian | CHƯA ĐO trên output thật. `python-worker/demo_t012_summary.py:27` kiểm schemaVersion, số hữu hạn không âm, totalFrames nguyên, frames/kicks dạng mảng. Không có detectorVersion/meta.timingsSeconds vì worker thoát lỗi. Thời gian lệnh lỗi khoảng 5.255s (vid_01), 4.165s (Adam), không dùng làm thời gian chờ demo. |
| 4. Bảng đủ cú đấm, khớp result | CHƯA ĐẠT trên video thật; `python-worker/benchmark_results/t012_demo/summary.md:1` ghi rõ bị chặn. Script/test đã có bảng và câu giới hạn. |
| 5. Diff đúng phạm vi, test qua | 45 passed in 5.66s cho bộ kiểm tra bắt buộc. Thay đổi của phiên này chỉ nằm trong script/test, thư mục kết quả và handover. Diff với fight-camp có thêm các file T-022 đã merge sẵn, liệt kê bên dưới; không sửa chúng. Không khẳng định đã chạy toàn bộ test ngoài lệnh bắt buộc. |
| 6. Test ghép và định dạng | `python-worker/test_demo_t012_summary.py:1`, cùng lệnh pytest bắt buộc: PASS. |

## Lệnh đã chạy
CWD của các lệnh Python: `D:/test/ai-worktrees/T-012/python-worker`.
Python dùng đường dẫn tuyệt đối đã chỉ định; `PYTHONIOENCODING=utf-8`. Không tạo venv/cài thư viện.
Các lệnh chạy trực tiếp, không tạo tiến trình nền. Output được Tee vào log và chỉ hiện tối đa 40 dòng cuối.

```text
D:/test/ai-worktrees/T-022/python-worker/.venv/Scripts/python.exe process_video.py --input validation_videos/vid_01_cross_heavybag.mp4 --output benchmark_results/t012_demo/vid_01_run1.json --training-mode HEAVY_BAG --martial-art boxing --model yolov8n-pose
```

Phần cuối output nguyên văn:

```text
❌ Lỗi: Unsupported martial art discipline 'boxing' requested. No discipline-specific evaluator is integrated in Task 4 (only generic legacy evaluators available).
Traceback (most recent call last):
  File "D:\test\ai-worktrees\T-012\python-worker\process_video.py", line 775, in <module>
    process_video(
  File "D:\test\ai-worktrees\T-012\python-worker\process_video.py", line 184, in process_video
    raise RubricSelectionError(
action_result.RubricSelectionError: Unsupported martial art discipline 'boxing' requested. No discipline-specific evaluator is integrated in Task 4 (only generic legacy evaluators available).
```

Exit code: 1.

```text
D:/test/ai-worktrees/T-022/python-worker/.venv/Scripts/python.exe process_video.py --input test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6/adam.mp4 --output benchmark_results/t012_demo/adam_run1.json --training-mode HEAVY_BAG --martial-art boxing --model yolov8n-pose
```

Phần cuối output nguyên văn:

```text
❌ Lỗi: Unsupported martial art discipline 'boxing' requested. No discipline-specific evaluator is integrated in Task 4 (only generic legacy evaluators available).
Traceback (most recent call last):
  File "D:\test\ai-worktrees\T-012\python-worker\process_video.py", line 775, in <module>
    process_video(
  File "D:\test\ai-worktrees\T-012\python-worker\process_video.py", line 184, in process_video
    raise RubricSelectionError(
action_result.RubricSelectionError: Unsupported martial art discipline 'boxing' requested. No discipline-specific evaluator is integrated in Task 4 (only generic legacy evaluators available).
```

Exit code: 1.

```text
D:/test/ai-worktrees/T-022/python-worker/.venv/Scripts/python.exe -m pytest -q test_demo_t012_summary.py test_punch_analyzer.py test_pipeline.py test_worker_delivery.py test_release_safety.py
```

Phần cuối output nguyên văn:

```text
.............................................                            [100%]
45 passed in 5.66s
```

Exit code: 0.

```text
D:/test/ai-worktrees/T-022/python-worker/.venv/Scripts/python.exe process_video.py --help
```

Phần cuối output nguyên văn:

```text
                        [--coach-stance {orthodox,southpaw,switch,unknown}]
                        [--martial-art {boxing,muay_thai,kickboxing,karate,taekwondo,mma,generic,unknown}]
                        [--training-mode {HEAVY_BAG,PAD_WORK,SHADOW_BOXING,SPARRING}]
                        [--camera-view {FRONT,SIDE,DIAGONAL}]
                        [--exercise-id EXERCISE_ID]
                        [--evidence-protocol {whole_body_v1,upper_body_v1,lower_body_v1}]
                        [--analysis-purpose {training,longitudinal_monitoring,rehabilitation}]

Phân tích kỹ thuật võ thuật từ video dùng YOLO-Pose

options:
  -h, --help            show this help message and exit
  --input INPUT, -i INPUT
                        Đường dẫn video MP4 hoặc URL
  --output OUTPUT, -o OUTPUT
                        File JSON output (mặc định: result.json)
  --model {yolov8n-pose,yolov8s-pose,yolov8m-pose,yolov8l-pose,yolov8x-pose}, -m {yolov8n-pose,yolov8s-pose,yolov8m-pose,yolov8l-pose,yolov8x-pose}
                        Model YOLO-Pose (n=nhanh/CPU, x=chính xác/GPU)
  --conf CONF, -c CONF  Ngưỡng confidence (0–1, mặc định: 0.5)
  --max-frames MAX_FRAMES
                        Giới hạn số frame (dùng để test nhanh)
  --stance {orthodox,southpaw,switch,unknown}
                        Thế thủ võ sĩ do user khai báo (mặc định: None ->
                        unknown)
  --coach-stance {orthodox,southpaw,switch,unknown}
                        Thế thủ võ sĩ do HLV xác nhận (ưu tiên cao hơn
                        --stance)
  --martial-art {boxing,muay_thai,kickboxing,karate,taekwondo,mma,generic,unknown}
                        Môn võ phân tích (mặc định: None -> generic)
  --training-mode {HEAVY_BAG,PAD_WORK,SHADOW_BOXING,SPARRING}
                        Loại buổi tập, dùng để chọn detector phù hợp
  --camera-view {FRONT,SIDE,DIAGONAL}
                        Góc máy do nguồn upload khai báo
  --exercise-id EXERCISE_ID
                        Declared assigned exercise ID; never an AI-confirmed
                        label
  --evidence-protocol {whole_body_v1,upper_body_v1,lower_body_v1}
  --analysis-purpose {training,longitudinal_monitoring,rehabilitation}
                        Declared review context; does not grant clinical
                        permissions
```

Exit code: 0.

```text
D:/test/ai-worktrees/T-022/python-worker/.venv/Scripts/python.exe demo_t012_summary.py --help
```

Phần cuối output nguyên văn:

```text
usage: demo_t012_summary.py [-h] --result RESULT --labels LABELS
                            [--output OUTPUT]

Offline event summary; reuses the frozen T-022 readers and matching policy.

options:
  -h, --help       show this help message and exit
  --result RESULT  Worker result JSON
  --labels LABELS  T-022 CSV/DEV-2 JSON labels
  --output OUTPUT
```

Exit code: 0.

Các thao tác bổ sung: tạo SHA-256 video/nhãn/model và ghi run_info.json/summary.md; git status/branch, git diff --name-only fight-camp, stage và commit các file đúng phạm vi.

Diff đã có sẵn từ T-022 khi bắt đầu (chỉ xem danh sách, không đọc nội dung ngoài phần được phép):
```text
docs/tickets/T-022-HANDOVER.md
python-worker/benchmark_results/punch_recall_protocol_t022.md
python-worker/benchmark_results/punch_recall_t022_baseline.json
python-worker/benchmark_results/punch_recall_t022_dev.json
python-worker/benchmark_results/punch_recall_t022_final.json
python-worker/evaluate_punch_recall.py
python-worker/test_evaluate_punch_recall.py
```

## Lệch so với ticket
Hai result JSON không tồn tại do cả hai lệnh bắt buộc bị RubricSelectionError. Chưa thể chọn clip, chạy xác nhận, kiểm contract thật hoặc ghi meta.timingsSeconds/detectorVersion. summary.md là báo cáo bị chặn, không phải bảng kết quả demo.

## Câu hỏi / việc còn mở
- Mâu thuẫn ticket/code: argparse cho phép boxing nhưng runtime báo `Unsupported martial art discipline 'boxing' requested. No discipline-specific evaluator is integrated in Task 4 (only generic legacy evaluators available).` Traceback ở process_video.py:184. Cần chủ dự án quyết định ticket/tham số hoặc baseline tương thích; phiên này giữ nguyên lệnh và không sửa worker/threshold.
- Cần kế hoạch tiếp tục có kiểm soát số lần chạy sau khi giải quyết mâu thuẫn; chưa có clip được chọn để chạy lần thứ ba.
- Kiểm định script trên result thật còn mở; hiện chỉ có test dữ liệu tổng hợp.
- Phần B do Dan chạy; không kết nối Supabase/Redis, không push, merge, đổi nhánh, commit video/model.
