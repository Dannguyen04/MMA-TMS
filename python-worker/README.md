# Python Worker — Martial Arts Tracker Phase 2

AI Worker phân tích video võ thuật dùng **YOLOv8-Pose** (chính xác hơn MediaPipe Phase 1).

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
