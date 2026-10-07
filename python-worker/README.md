# Python Worker — Martial Arts Tracker Phase 2

## Nhãn Adam hiện hành

Chủ dự án đã chốt 18 nhãn Adam gốc. Builder dùng CSV đã khóa hash; nhãn AI/Gemini
chỉ là tham khảo cho Adam. Dataset hiện hành có 4.775 mẫu, xem
[quyết định và phiên bản dữ liệu](../docs/AI-ADAM-LABEL-DECISION.md).

Đã chạy đầy đủ 3 seed × 40 epoch, chọn seed 20261007, epoch 37. Xem
[kết quả huấn luyện và checkpoint](../docs/AI-TRAINING-RESULTS-20261006.md).

Vòng cải tiến theo nhóm nguồn có runner riêng: baseline, sampler theo nguồn,
nhiễu pose và auxiliary heads, mỗi cấu hình 3 fold × 3 seed. Xem
[protocol và cách thực thi](../docs/AI-GROUP-CV-IMPLEMENTATION-20261006.md).
Đã chạy đủ 36 lượt và refit; [kết quả A0–A3](../docs/AI-GROUP-CV-RESULTS-20261006.md)
ghi cả mức tăng CV nhỏ và sự giảm chất lượng trên diagnostic sau refit.

```powershell
& '.\.venv\Scripts\python.exe' run_temporal_ablations.py --manifest test_results/provisional_dataset/20261006_adam_source_v1/manifest.json --fold-plan benchmark_results/proposed_development_folds_20261006.json --output test_results/temporal_ablations/next_group_run
```

Huấn luyện đầy đủ với nhãn Adam gốc (3 seed, tối đa 40 epoch, chọn checkpoint
bằng validation; calibration chỉ dùng sau khi chọn xong):

```powershell
& '.\.venv\Scripts\python.exe' train_provisional_model.py --manifest test_results/provisional_dataset/20261006_adam_source_v1/manifest.json --output test_results/provisional_training/next_full_run --epochs 40 --patience 10 --include-observed-test
```

Output phải là thư mục mới. Cờ `--include-observed-test` chỉ đo chẩn đoán trên
V9/V10 đã quan sát; không dùng kết quả đó để chọn model. Checkpoint được chọn
nằm trong `selected/`, có `report.json` và hash để nạp qua
`pipeline.temporal_checkpoint.load_temporal_checkpoint`.

## Gemini duyệt chéo dữ liệu

Đã thêm CLI offline/online cho lượt review thứ hai; mặc định chỉ tạo kế hoạch,
không gửi video. Key đọc từ `.env`, không ghi vào report. Xem
[cấu hình, phạm vi gửi video và trạng thái chạy](../docs/AI-GEMINI-CROSS-REVIEW.md).

## Lịch sử dataset tạm trước khi chốt nhãn Adam — 2026-10-06

Theo chấp thuận của chủ dự án, đã tạo 4.768 mẫu gồm dữ liệu nguồn và 14 nhãn AI
đề xuất qua kiểm tra pose; đã chạy thử huấn luyện 3 epoch. Nhãn AI chỉ vào train,
trọng số loss 0,25, không tự trở thành HLV xác nhận. Xem
[dataset, kết quả và lệnh sử dụng](../docs/AI-TEMPORARY-DATASET.md).

## Bộ dữ liệu chờ HLV duyệt

Đã đóng gói 4.754 skeleton nghiên cứu và 67 task review từ 7 video có sẵn;
**0 mẫu HLV đã xác nhận**. Xem [gói dữ liệu và hướng dẫn mở công cụ](../docs/AI-COACH-REVIEW-DATASET.md).
Chạy `serve_coach_review_dataset.py` để hỗ trợ tua video MP4; file review xuất ra
chưa được xác thực và không được tự động dùng làm gold training data.

## Temporal AI — cập nhật 2026-10-05

Đã thêm normalizer theo timestamp, exporter pose offline, auditor dữ liệu bốn
split và benchmark nhiều seed cho legacy TCN / residual TCN / graph-temporal
baseline. Các mô hình vẫn research-only; không thay classifier active hoặc mở
chấm kỹ thuật. Các ví dụ legacy phía dưới không phải đầu ra production đã kiểm định.

- [Thiết kế, contract và lệnh chạy](../docs/AI-TEMPORAL-IMPLEMENTATION.md)
- [Quy trình thu thập/gán nhãn cho HLV](../docs/AI-DATA-COLLECTION-PROTOCOL.md)
- Template dữ liệu: `../docs/examples/temporal-dataset.manifest.json` (rỗng,
  chưa đủ điều kiện huấn luyện; không có nhãn HLV giả).

Benchmark mirror giữ feature version cũ vì thiếu timestamp/aspect metadata.
Normalizer mới cần dữ liệu YOLO cùng pipeline triển khai; không tráo hai feature
contract chỉ vì cùng số kênh. Kết quả benchmark và kiểm thử hiện tại được ghi trong
`../AI_UPGRADE_STATUS.md`.

AI Worker phân tích video võ thuật dùng **YOLOv8-Pose**. Chưa có benchmark độc lập để kết luận chính xác hơn pipeline khác.

Hướng hiện tại: [Movement evidence v1](../docs/AI-MOVEMENT-EVIDENCE-v1.md) —
chuẩn bị bằng chứng để HLV/bác sĩ review, không tự chấm kỹ thuật hay quyết định y tế.

## AI upgrade — implementation status

See [implementation report](../AI_UPGRADE_STATUS.md) for setup, checks and remaining release blockers.
The active detector remains legacy FSM; `shadowEventDetection` is experimental,
not calibrated and never used to replace active output based on candidate counts.
Session scores and prescriptive coaching are withheld while coverage is unknown.
Worker delivery now requires migration 015, a registered active pose configuration,
and successful authenticated `POST /coaching/results` before marking a job DONE.

## Cấu trúc

```
python-worker/
├── pose_math.py        ← Port của posemath.js (17-keypoint COCO)
├── kick_analyzer.py    ← Port của kickStateMachine.js
├── process_video.py    ← Pipeline chính: video → JSON
├── worker.py           ← Redis/BullMQ queue listener (Phase 3)
├── test_pose_math.py   ← Unit tests (không cần pytest)
├── requirements.txt
├── Dockerfile
└── .env.example
```

## Thiết lập

```bash
# Venv đã tạo sẵn với uv
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # Linux/Mac

pip install -r requirements.txt
```

## Chạy thử (Phase 2 — standalone)

### Xử lý video file

```bash
python process_video.py --input sample.mp4 --output result.json
```

### Tùy chọn model

```bash
# Nhanh, chạy được CPU (mặc định)
python process_video.py -i video.mp4 -m yolov8n-pose

# Chính xác hơn, cần GPU
python process_video.py -i video.mp4 -m yolov8x-pose

# Giới hạn 100 frame (test nhanh)
python process_video.py -i video.mp4 --max-frames 100
```

### Unit tests (không cần video)

```bash
python test_pose_math.py
```

## Cấu trúc JSON Output

```json
{
    "meta": {
        "videoPath": "sample.mp4",
        "model": "yolov8n-pose",
        "fps": 30.0,
        "totalFrames": 900,
        "durationMs": 30000
    },
    "frames": [
        {
            "frameIdx": 0,
            "timeMs": 0.0,
            "activeLeg": "right",
            "kneeAngle": 168.5,
            "hipAngle": 92.3,
            "kickState": "idle",
            "kickStateLabel": "Đứng thủ",
            "landmarks": [
                { "x": 0.512, "y": 0.234, "conf": 0.98 }
                // ... 17 keypoints
            ]
        }
    ],
    "kicks": [
        {
            "score": 85,
            "grade": "GOOD",
            "emoji": "🟡",
            "details": [
                "✅ Rút gối tốt (68°)",
                "✅ Bung chân tốt (145°)",
                "⚠️ Đá còn chậm"
            ],
            "minChamberAngle": 68.0,
            "maxExtensionAngle": 145.0,
            "peakSpeed": 0.72,
            "startFrame": 120,
            "endFrame": 195,
            "startTimeMs": 4000.0,
            "endTimeMs": 6500.0
        }
    ],
    "summary": {
        "totalKicks": 3,
        "avgScore": 80.0,
        "bestScore": 92,
        "bestKickIdx": 2
    }
}
```

## YOLO-Pose vs MediaPipe

| Tiêu chí              | MediaPipe (Phase 1) | YOLOv8-Pose (Phase 2)        |
| --------------------- | ------------------- | ---------------------------- |
| Keypoints             | 33 (full body)      | 17 (COCO format)             |
| Chạy được CPU         | ✅ Tốt              | ✅ n-model                   |
| Cần GPU               | Không               | l/x-model                    |
| Xử lý video offline   | ❌                  | ✅                           |
| Phát hiện nhiều người | ❌                  | ✅                           |
| Độ chính xác          | Tốt                 | Tốt hơn (đặc biệt occlusion) |

## Phase 3 — Worker Mode

Cấu hình `.env` và chạy:

```bash
cp .env.example .env
# Điền REDIS_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY

python worker.py
```

Worker sẽ tự động lắng nghe queue `video-analysis` từ Redis và xử lý jobs do NestJS gửi đến.

## Dataset công khai cho học tập

Worker có catalog và bộ nhập dữ liệu cho UCF101, KTH Boxing, BoxingDataset và dữ liệu
MMA-TMS tự gắn nhãn. Video được lưu cục bộ trong `data/public/` và không commit vào Git.

```bash
# Xem catalog, nguồn và giới hạn sử dụng
python prepare_public_dataset.py catalog

# Sau khi tải/giải nén UCF101 vào data/public/ucf101
python prepare_public_dataset.py prepare \
  --dataset ucf101 \
  --root data/public/ucf101 \
  --output data/manifests/ucf101.json

# BoxingDataset dùng metadata.csv và giữ các clip từ cùng trận trong cùng split
python prepare_public_dataset.py prepare \
  --dataset boxing_dataset \
  --root data/public/boxing_dataset \
  --metadata data/public/boxing_dataset/metadata.csv \
  --output data/manifests/boxing_dataset.json
```

Manifest chia `train/val/test` bằng hash của `groupId`. Chỉ các mẫu có cùng groupId
mới được giữ cùng split; phải kiểm tra độc lập quan hệ video/võ sĩ trước khi coi
đây là chia dữ liệu chống rò rỉ hoàn chỉnh. Nhãn public `boxing`/`punch` chỉ được
dùng cho detection; chỉ nhãn kỹ thuật đã được gắn rõ (`jab`, `cross`, `hook`,
`round_kick`) mới có `eligibleForTechniqueTraining=true`.

Chạy split test qua pipeline hiện tại và tạo báo cáo:

```bash
python evaluate_public_dataset.py \
  --manifest data/manifests/ucf101.json \
  --split test \
  --limit 20 \
  --max-frames 180 \
  --output data/reports/ucf101-test.json
```

Báo cáo này đo sự hiện diện hành động ở mức clip, không phải precision/recall
của từng đòn theo thời gian. Technique accuracy kiểm tra nhãn có xuất hiện trong
clip, không thay thế confusion matrix một-một theo sự kiện; dataset nhãn thô trả về
`not_evaluable_no_fine_grained_labels` thay vì tạo ra một con số gây hiểu nhầm.

## Thử nghiệm BoxingVI và video ngoài hệ thống (2026-10-03)

Trạng thái: **research-only, chưa đủ điều kiện production**. Video, skeleton và
weights thử nghiệm nằm trong `test_results/` (Git-ignored); không tải dữ liệu người
dùng lên dịch vụ bên ngoài. Nguồn được cố định tại commit
`96f3a7d0716040682381fb63f80afac96f74cfa6` của
[boxe.ml](https://github.com/leonardosm14/boxe.ml), có nguồn gốc skeleton từ
[BoxingVI](https://github.com/Bikudebug/BoxingVI). Giấy phép mã nguồn MIT không tự
xác lập quyền thương mại đối với video/dữ liệu upstream.

```sh
python train_boxing_research.py fetch
python train_boxing_research.py train --output test_results/boxing_research/new_run
python evaluate_external_boxing.py --fresh --inference test_results/external/new_inference.json --model test_results/boxing_research/new_run --output benchmark_results/new_external_report.json
```

`fetch` chỉ tải tệp công khai, không chạy code/notebook/checkpoint của bên thứ ba.
Huấn luyện dùng PyTorch có sẵn, seed cố định, checkpoint NPZ số (`allow_pickle=False`).
Không thay mô hình active trong worker. Mỗi run lưu hash dữ liệu/mã/weights, tập
train, validation, calibration và test tách theo video. Không khẳng định đã tách
được võ sĩ vì metadata danh tính không có. V6 bị cách ly do schema khác; hàng nhãn
lỗi bị loại mà không dịch chuyển quan hệ hàng nhãn/skeleton.

`evaluate_external_boxing.py` đo ghép sự kiện một-một theo temporal IoU 0.1/0.3/0.5,
không chế ra nhãn thời điểm chạm đích từ giữa đoạn. Phân loại trên ranh giới nhãn
chuẩn được báo riêng, không được gọi là độ chính xác end-to-end.

Kết quả chi tiết: `benchmark_results/boxing_research_run01.json`,
`benchmark_results/boxing_data_audit.json`, `benchmark_results/external_adam_report.json`.
Giữ nguyên báo cáo lần đầu; từ lúc xem kết quả, V9/V10 và adam không còn là test
chưa từng quan sát để tinh chỉnh các phiên bản sau.

`pipeline/release_safety.py` hiện chặn điểm, grade khẳng định, hướng dẫn kỹ thuật,
nhãn kỹ thuật authoritative và confidence chưa kiểm định ở đầu ra worker/callback.
Giữ timeline, ID và kinematic evidence; nhãn heuristic chỉ nằm trong trường
`experimentalTechnique`. UI dùng `Punch (unclassified)` thay vì đoán cross/hook.
Không có cờ môi trường để bỏ qua chính sách này. Cần một thay đổi phát hành được
review cùng bằng chứng độc lập trước khi mở lại tự đánh giá kỹ thuật.
## Movement evidence — hướng triển khai hiện tại (2026-10-03)

Worker xuất thêm `movementEvidence`: ngữ cảnh bài tập khai báo, quality/coverage,
đoạn video liên tục để chuyên gia xem lại và hướng dẫn ghi hình. Không cần nhận dạng
được đòn; không coi đoạn review là lần lặp, không score hay kết luận y tế.

CLI bổ sung `--exercise-id`, `--evidence-protocol` (`whole_body_v1`, `upper_body_v1`,
`lower_body_v1`) và `--analysis-purpose` (`training`, `longitudinal_monitoring`,
`rehabilitation`). Worker nhận `exerciseContext` tùy chọn trong queue payload;
backend producer hiện tại chưa nối context này từ kế hoạch tập.

Chi tiết phạm vi, giới hạn và kiểm chứng: [movement evidence v1](../docs/AI-MOVEMENT-EVIDENCE-v1.md).

## Six-punch video trial and recovered V6 (2026-10-06)

`recover_boxingvi_v6.py` now recovers the previously quarantined V6 by matching
explicit source frame IDs (column 0 is not confidence). The new 5,460-sample
dataset preserves all 18 original Adam labels. `run_v6_reflection.py` compares
auxiliary TCN training with/without anatomical joint-aware reflection across
four source folds and three seeds. Historical checkpoints remain loadable.

`recognize_boxing_video.py` runs local single-person video recognition with
explicit `unknown` results for poor pose, insufficient calibration support, low
probability or reflection disagreement. It is a research trial, not the active
worker model. `pipeline/recognition_metrics.py` counts missed/abstained events
and extra accepted events, rather than reporting accuracy only on accepted clips.

```powershell
.\.venv\Scripts\python.exe recognize_boxing_video.py --video VIDEO.mp4 --checkpoint test_results/temporal_ablations/20261006_v6_reflection_v1/selected --output test_results/video_recognition/NEW_VIDEO
```

Optional `--pose-cache` requires matching video and YOLO weight hashes. Its
generating code is explicitly unverified when an existing cache is used.
Use a new output directory for each run. See the [six-punch scope, results and
reproduction notes](../docs/AI-SIX-PUNCH-VIDEO-20261006.md).
