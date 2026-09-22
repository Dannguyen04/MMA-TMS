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
COPY python-worker/requirements.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Sao chép toàn bộ module pipeline và hợp đồng dùng chung.
COPY python-worker/*.py .
COPY python-worker/pipeline ./pipeline
COPY contracts /contracts

# Pre-download YOLO model (giảm cold-start time)
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n-pose.pt')"

# Tmp directory cho video processing
RUN mkdir -p /tmp/martial-arts-worker

ENV PYTHONUNBUFFERED=1

CMD ["python", "worker.py"]

