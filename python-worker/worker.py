"""Worker BullMQ chính thức cho luồng phân tích video MMA-TMS."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import tempfile
from pathlib import Path
from typing import Any

import httpx
from bullmq import Worker
from dotenv import load_dotenv
from jsonschema import Draft202012Validator, FormatChecker

from process_video import process_video

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
log = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
QUEUE_NAME = os.getenv("QUEUE_NAME", "video-analysis")
NESTJS_API_URL = os.getenv("NESTJS_API_URL", "http://localhost:3001").rstrip("/")
WORKER_SECRET_TOKEN = os.getenv("WORKER_SECRET_TOKEN", "")
YOLO_MODEL = os.getenv("YOLO_MODEL", "yolov8n-pose")
TMP_DIR = Path(
    os.getenv(
        "TMP_DIR",
        str(Path(tempfile.gettempdir()) / "martial-arts-worker"),
    )
)
CONTRACTS_DIR = Path(
    os.getenv(
        "CONTRACTS_DIR",
        str(Path(__file__).resolve().parent.parent / "contracts"),
    )
)
QUEUE_CONTRACT = "video-analysis-queue.v1.schema.json"
STATUS_CONTRACT = "worker-job-status.v1.schema.json"
RESULT_CONTRACT = "analysis-result.v1.schema.json"
CALLBACK_ATTEMPTS = 3


def validate_contract(name: str, value: Any) -> None:
    """Kiểm tra dữ liệu qua JSON Schema dùng chung trước khi trao đổi giữa các runtime."""

    schema_path = CONTRACTS_DIR / name
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(value)


def require_configuration() -> None:
    """Từ chối khởi động khi thiếu bí mật hoặc hợp đồng JSON Schema bắt buộc."""

    missing = []
    if not WORKER_SECRET_TOKEN:
        missing.append("WORKER_SECRET_TOKEN")
    # Thiếu schema khiến mọi job lỗi và không gửi được callback FAILED.
    for name in (QUEUE_CONTRACT, STATUS_CONTRACT, RESULT_CONTRACT):
        if not (CONTRACTS_DIR / name).is_file():
            missing.append(str(CONTRACTS_DIR / name))
    if missing:
        raise RuntimeError(f"Thiếu cấu hình worker bắt buộc: {', '.join(missing)}")


async def notify_nestjs(job_id: str, payload: dict[str, Any]) -> None:
    """Gửi callback có kiểm tra HTTP và thử lại lỗi mạng tạm thời."""

    validate_contract(STATUS_CONTRACT, payload)
    headers = {
        "Content-Type": "application/json",
        "x-worker-secret": WORKER_SECRET_TOKEN,
    }
    last_error: Exception | None = None

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
        for attempt in range(1, CALLBACK_ATTEMPTS + 1):
            try:
                response = await client.patch(
                    f"{NESTJS_API_URL}/jobs/{job_id}/status",
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()
                return
            except httpx.HTTPError as error:
                last_error = error
                if attempt < CALLBACK_ATTEMPTS:
                    await asyncio.sleep(2 ** (attempt - 1))

    raise RuntimeError(f"Callback NestJS thất bại: {last_error}")


async def download_job_input(job_id: str) -> Path:
    """Tải video riêng tư qua API worker; queue không chứa URL do caller kiểm soát."""

    target = TMP_DIR / f"{job_id}_input.mp4"
    # File dở dang từ lần thử trước (tải lỗi giữa chừng/worker bị kill) sẽ làm
    # open("xb") ném FileExistsError ở mọi lần retry.
    target.unlink(missing_ok=True)
    headers = {"x-worker-secret": WORKER_SECRET_TOKEN}
    try:
        async with (
            httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0)) as client,
            client.stream(
                "GET",
                f"{NESTJS_API_URL}/jobs/{job_id}/input",
                headers=headers,
            ) as response,
        ):
            response.raise_for_status()
            with target.open("xb") as destination:
                async for chunk in response.aiter_bytes():
                    destination.write(chunk)
    except BaseException:
        target.unlink(missing_ok=True)
        raise
    return target


async def finalize_result(job_id: str, local_path: Path) -> str:
    """Gửi kết quả về backend để kiểm tra, lưu riêng tư và hoàn tất transaction."""

    content = await asyncio.to_thread(local_path.read_bytes)
    headers = {
        "Content-Type": "application/octet-stream",
        "Content-Length": str(len(content)),
        "x-worker-secret": WORKER_SECRET_TOKEN,
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
        response = await client.post(
            f"{NESTJS_API_URL}/jobs/{job_id}/result",
            content=content,
            headers=headers,
        )
        response.raise_for_status()
        payload = response.json()
    data = payload.get("data") if isinstance(payload, dict) else None
    result_url = data.get("resultUrl") if isinstance(data, dict) else None
    if not isinstance(result_url, str) or not result_url:
        raise RuntimeError("Backend không trả về đường dẫn kết quả đã bảo vệ")
    return result_url


def is_final_attempt(job: Any) -> bool:
    """Xác định lỗi hiện tại có làm cạn số lần thử của BullMQ hay chưa."""

    attempts_made = int(getattr(job, "attemptsMade", 0) or 0)
    options = getattr(job, "opts", {}) or {}
    attempts = int(options.get("attempts", 1) or 1)
    return attempts_made + 1 >= attempts


async def report_progress(job: Any, stage: str, percent: int) -> None:
    """Ghi tiến độ bằng API BullMQ để giữ nguyên khóa và event stream."""

    await job.updateProgress({"stage": stage, "percent": percent})


async def process_job(job: Any, _job_token: str) -> dict[str, Any]:
    """Xử lý đúng một lần thử; BullMQ chịu trách nhiệm khóa và retry."""

    payload = getattr(job, "data", {}) or {}
    # Schema bắt buộc jobId/videoId là UUID nên không cần kiểm tra lại bên dưới.
    validate_contract(QUEUE_CONTRACT, payload)
    job_id = payload["jobId"]

    result_path = TMP_DIR / f"{job_id}_result.json"
    input_path: Path | None = None
    try:
        await notify_nestjs(job_id, {"status": "PROCESSING"})
        await report_progress(job, "DOWNLOADING", 5)
        input_path = await download_job_input(job_id)
        await report_progress(job, "INFERENCE", 15)

        result = await asyncio.to_thread(
            process_video,
            input_path=str(input_path),
            model_name=YOLO_MODEL,
            output_path=str(result_path),
            verbose=True,
        )
        validate_contract(RESULT_CONTRACT, result)

        await report_progress(job, "UPLOADING", 85)
        result_url = await finalize_result(job_id, result_path)

        score = result["summary"].get("bestScore")
        health_alerts = result.get("healthAlerts", [])

        await report_progress(job, "PERSISTING", 95)
        await report_progress(job, "PERSISTING", 100)

        return {
            "resultUrl": result_url,
            "score": score,
            "alertCount": len(health_alerts),
            "hasImpairment": bool(health_alerts),
        }
    except Exception:
        log.exception("Job %s thất bại", job_id)
        if is_final_attempt(job):
            await notify_nestjs(
                job_id,
                {
                    "status": "FAILED",
                    "errorCode": "VIDEO_ANALYSIS_FAILED",
                    "errorMessage": "Video analysis failed after all retry attempts.",
                },
            )
        raise
    finally:
        if result_path.exists():
            await asyncio.to_thread(result_path.unlink)
        if input_path and input_path.exists():
            await asyncio.to_thread(input_path.unlink)


async def run_worker() -> None:
    """Khởi động worker và đóng kết nối nhẹ nhàng khi nhận tín hiệu dừng."""

    require_configuration()
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    shutdown_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    def request_shutdown(_signal: int, _frame: Any) -> None:
        loop.call_soon_threadsafe(shutdown_event.set)

    signal.signal(signal.SIGINT, request_shutdown)
    signal.signal(signal.SIGTERM, request_shutdown)

    worker = Worker(
        QUEUE_NAME,
        process_job,
        {
            "connection": REDIS_URL,
            "concurrency": 1,
            "lockDuration": 120_000,
            "stalledInterval": 30_000,
        },
    )
    log.info("Worker BullMQ đang lắng nghe queue %s", QUEUE_NAME)
    await shutdown_event.wait()
    log.info("Đang đóng worker BullMQ")
    await worker.close()


if __name__ == "__main__":
    asyncio.run(run_worker())
