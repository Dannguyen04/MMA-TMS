FROM python:3.11-slim

# Cài OpenCV dependencies
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cài Python dependencies trước (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY *.py .
COPY pipeline ./pipeline

# Pre-download YOLO model (giảm cold-start time)
# Use the repository's frozen pose weights, not a mutable network download.
COPY yolov8n-pose.pt ./yolov8n-pose.pt
RUN python -c "import process_video; from ultralytics import YOLO; YOLO('yolov8n-pose.pt')"

# Tmp directory cho video processing
RUN useradd --create-home --uid 10001 worker \
    && mkdir -p /tmp/martial-arts-worker \
    && chown worker:worker /tmp/martial-arts-worker

ENV PYTHONUNBUFFERED=1
USER worker

CMD ["python", "worker.py"]

