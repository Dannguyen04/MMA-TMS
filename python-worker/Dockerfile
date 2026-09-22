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
COPY .env.example .env

# Pre-download YOLO model (giảm cold-start time)
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n-pose')"

# Tmp directory cho video processing
RUN mkdir -p /tmp/martial-arts-worker

ENV PYTHONUNBUFFERED=1

CMD ["python", "worker.py"]

