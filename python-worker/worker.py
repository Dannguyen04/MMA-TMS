"""
worker.py — Redis Queue Listener (BullMQ format)
Phase 3 integration: lắng nghe jobs từ NestJS BullMQ

BullMQ lưu jobs trong Redis với key pattern:
  bull:<queue-name>:waiting  (list)
  bull:<queue-name>:<job-id> (hash)

Worker này poll Redis, nhận job, chạy process_video.py,
rồi ghi kết quả lên Supabase Storage và báo hoàn thành.

Môi trường: xem .env.example
"""

import json
import logging
import os
import sys
import time
import uuid
from pathlib import Path

import httpx
import redis

from process_video import process_video

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
log = logging.getLogger(__name__)


# ─── Cấu hình (load từ .env qua python-dotenv) ───
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

REDIS_URL       = os.getenv("REDIS_URL", "redis://localhost:6379")
QUEUE_NAME      = os.getenv("QUEUE_NAME", "video-analysis")
SUPABASE_URL    = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY    = os.getenv("SUPABASE_SERVICE_KEY", "")  # service role key
NESTJS_API_URL  = os.getenv("NESTJS_API_URL", "http://localhost:3001")
WORKER_SECRET_TOKEN = os.getenv("WORKER_SECRET_TOKEN", "mma-tms-worker-local-secret-2026")
YOLO_MODEL      = os.getenv("YOLO_MODEL", "yolov8n-pose")
POLL_INTERVAL_S = float(os.getenv("POLL_INTERVAL_S", "2.0"))
import tempfile
default_tmp_dir = str(Path(tempfile.gettempdir()) / "martial-arts-worker")
TMP_DIR         = Path(os.getenv("TMP_DIR", default_tmp_dir))
if str(TMP_DIR).startswith("/tmp") and os.name == "nt":
    TMP_DIR = Path(default_tmp_dir)

TMP_DIR.mkdir(parents=True, exist_ok=True)

# BullMQ Redis key patterns (BullMQ uses :wait, older Bull uses :waiting)
WAIT_KEYS       = [f"bull:{QUEUE_NAME}:wait", f"bull:{QUEUE_NAME}:waiting"]
ACTIVE_KEY      = f"bull:{QUEUE_NAME}:active"
COMPLETED_KEY   = f"bull:{QUEUE_NAME}:completed"
FAILED_KEY      = f"bull:{QUEUE_NAME}:failed"


def get_redis() -> redis.Redis:
    if REDIS_URL.startswith("rediss://"):
        return redis.from_url(REDIS_URL, decode_responses=True, ssl_cert_reqs=None)
    return redis.from_url(REDIS_URL, decode_responses=True)


# ─── Supabase Storage Upload ───
def upload_to_supabase(local_path: str, remote_path: str) -> str:
    """
    Upload file lên Supabase Storage.
    Trả về public URL.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.warning("Supabase chưa cấu hình — bỏ qua upload, dùng local path")
        return f"local://{local_path}"

    bucket = "analysis-results"
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{remote_path}"

    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json",
        "x-upsert": "true",
    }

    with open(local_path, "rb") as f:
        file_bytes = f.read()

    # Thử POST với x-upsert: true (chuẩn Supabase Storage upload)
    response = httpx.post(url, content=file_bytes, headers=headers, timeout=30.0)
    if response.status_code not in (200, 201):
        # Fallback thử PUT nếu object đã tồn tại
        response = httpx.put(url, content=file_bytes, headers=headers, timeout=30.0)

    if response.status_code not in (200, 201):
        raise RuntimeError(f"Upload Supabase thất bại: {response.status_code} {response.text}")

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{remote_path}"
    log.info(f"✅ Đã upload: {public_url}")
    return public_url


# ─── NestJS API Callback (Bảo mật bằng Worker Secret Token) ───
def notify_nestjs(
    job_id: str,
    status: str,
    result_url: str = "",
    score: int = 0,
    health_alerts: list | None = None,
    joint_states: dict | None = None,
):
    """Gọi NestJS để cập nhật trạng thái job kèm token bảo mật.

    health_alerts: list[dict] từ SessionHealthMonitor.get_confirmed_alerts()
    joint_states:  dict[str, str] từ SessionHealthMonitor.get_joint_states()
    """
    if not NESTJS_API_URL:
        return

    try:
        headers = {
            "Content-Type": "application/json",
            "x-worker-secret": WORKER_SECRET_TOKEN,
        }
        httpx.patch(
            f"{NESTJS_API_URL}/jobs/{job_id}/status",
            json={
                "status":       status,
                "resultUrl":    result_url,
                "score":        score,
                "healthAlerts": health_alerts or [],
                "jointStates":  joint_states or {},
            },
            headers=headers,
            timeout=10.0,
        )
    except Exception as e:
        log.warning(f"Không thể báo NestJS: {e}")


# ─── Job Processing ───
def process_job(r: redis.Redis, job_id: str):
    """Xử lý một job từ BullMQ."""
    job_key = f"bull:{QUEUE_NAME}:{job_id}"

    # Đọc data job
    job_data = r.hget(job_key, "data")
    if not job_data:
        log.error(f"Không tìm thấy data cho job {job_id}")
        return

    payload = json.loads(job_data)
    video_url = payload.get("videoUrl", "")
    db_job_id = payload.get("jobId", job_id)

    log.info(f"🎬 Đang xử lý job {db_job_id}: {video_url}")

    # Cập nhật trạng thái PROCESSING
    r.hset(job_key, "processedOn", int(time.time() * 1000))
    notify_nestjs(db_job_id, "PROCESSING")

    try:
        # ── Đường dẫn output ──
        result_filename = f"{db_job_id}_result.json"
        local_result    = str(TMP_DIR / result_filename)

        # ── Chạy YOLO-Pose pipeline ──
        start_t = time.time()
        result = process_video(
            input_path=video_url,
            model_name=YOLO_MODEL,
            output_path=local_result,
            verbose=True,
        )
        elapsed = time.time() - start_t
        log.info(f"⚡ Xử lý xong trong {elapsed:.1f}s")

        # ── Upload lên Supabase ──
        remote_path = f"results/{db_job_id}/{result_filename}"
        result_url  = upload_to_supabase(local_result, remote_path)

        # ── Lấy điểm tốt nhất & anomaly data ──
        best_score   = result["summary"].get("bestScore", 0)
        health_alerts = result.get("healthAlerts", [])
        joint_states  = result["summary"].get("jointHealthStates", {})

        # ── Cập nhật Redis job status (BullMQ format) ──
        r.hset(job_key, mapping={
            "returnvalue": json.dumps({
                "resultUrl":    result_url,
                "score":        best_score,
                "alertCount":   result["summary"].get("healthAlertCount", 0),
                "hasImpairment": len(health_alerts) > 0,
            }),
            "finishedOn":  int(time.time() * 1000),
        })
        # An toàn đa luồng: Chỉ xóa chính xác job_id này khỏi ACTIVE_KEY và đẩy sang COMPLETED_KEY
        r.lrem(ACTIVE_KEY, 1, job_id)
        r.rpush(COMPLETED_KEY, job_id)

        # ── Thông báo NestJS (kèm anomaly data) ──
        notify_nestjs(
            db_job_id,
            "DONE",
            result_url=result_url,
            score=best_score,
            health_alerts=health_alerts,
            joint_states=joint_states,
        )

        alert_count = len(health_alerts)
        log.info(f"✅ Job {db_job_id} hoàn thành. Score: {best_score}, Health Alerts: {alert_count}")
        if alert_count > 0:
            log.warning(f"⚠️  {alert_count} CONFIRMED_IMPAIRMENT alert(s) phát hiện!")

    except Exception as e:
        log.error(f"❌ Job {db_job_id} thất bại: {e}", exc_info=True)

        r.hset(job_key, "failedReason", str(e))
        # An toàn đa luồng: Chỉ xóa chính xác job_id này khỏi ACTIVE_KEY và đẩy sang FAILED_KEY
        r.lrem(ACTIVE_KEY, 1, job_id)
        r.rpush(FAILED_KEY, job_id)
        notify_nestjs(db_job_id, "FAILED")


# ─── Main Loop ───
def run_worker():
    """Vòng lặp chính: poll Redis và xử lý jobs."""
    log.info(f"🚀 Worker khởi động")
    log.info(f"   Redis:      {REDIS_URL}")
    log.info(f"   Queue:      {QUEUE_NAME}")
    log.info(f"   Model:      {YOLO_MODEL}")
    log.info(f"   Supabase:   {SUPABASE_URL or '(chưa cấu hình)'}")

    r = get_redis()

    # Kiểm tra kết nối Redis
    try:
        r.ping()
        log.info("✅ Kết nối Redis thành công")
    except redis.ConnectionError as e:
        log.error(f"❌ Không thể kết nối Redis: {e}")
        sys.exit(1)

    log.info(f"👂 Đang lắng nghe queue '{QUEUE_NAME}'...")

    while True:
        try:
            job_id = None
            for wait_k in WAIT_KEYS:
                job_id = r.lmove(wait_k, ACTIVE_KEY, "RIGHT", "LEFT")
                if job_id:
                    break

            if job_id:
                process_job(r, job_id)
            else:
                time.sleep(POLL_INTERVAL_S)

        except KeyboardInterrupt:
            log.info("\n⛔ Worker dừng.")
            break
        except Exception as e:
            log.error(f"Lỗi không xác định: {e}", exc_info=True)
            time.sleep(5)  # back-off trước khi thử lại


if __name__ == "__main__":
    run_worker()

