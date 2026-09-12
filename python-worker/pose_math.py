"""
pose_math.py — Port của posemath.js sang Python
Các hàm toán học xử lý tọa độ cơ thể từ YOLO-Pose landmarks

YOLO-Pose landmark indices (17 keypoints, COCO format):
  0: Nose        1: Left Eye     2: Right Eye
  3: Left Ear    4: Right Ear    5: Left Shoulder
  6: Right Shoulder              7: Left Elbow
  8: Right Elbow 9: Left Wrist  10: Right Wrist
 11: Left Hip   12: Right Hip   13: Left Knee
 14: Right Knee 15: Left Ankle  16: Right Ankle
"""

import math
from dataclasses import dataclass, field
from typing import Optional


# ─── YOLO-Pose Landmark Indices (COCO 17-point) ───
class KP:
    NOSE           = 0
    LEFT_EYE       = 1
    RIGHT_EYE      = 2
    LEFT_EAR       = 3
    RIGHT_EAR      = 4
    LEFT_SHOULDER  = 5
    RIGHT_SHOULDER = 6
    LEFT_ELBOW     = 7
    RIGHT_ELBOW    = 8
    LEFT_WRIST     = 9
    RIGHT_WRIST    = 10
    LEFT_HIP       = 11
    RIGHT_HIP      = 12
    LEFT_KNEE      = 13
    RIGHT_KNEE     = 14
    LEFT_ANKLE     = 15
    RIGHT_ANKLE    = 16


@dataclass
class Point:
    """Tọa độ 2D được chuẩn hóa (0.0–1.0) hoặc pixel tùy context."""
    x: float
    y: float
    conf: float = 1.0   # confidence score từ YOLO


@dataclass
class EMAState:
    """Trạng thái EMA filter cho một landmark."""
    x: float = 0.0
    y: float = 0.0
    initialized: bool = False


def calculate_angle(a: Point, b: Point, c: Point) -> float:
    """
    Tính góc tại đỉnh B, tạo bởi 3 điểm A-B-C.
    Trả về góc từ 0 đến 180 độ.
    Port của calculateAngle() trong posemath.js.
    """
    if not (a and b and c):
        return 0.0
    radians = math.atan2(c.y - b.y, c.x - b.x) - math.atan2(a.y - b.y, a.x - b.x)
    angle = abs(radians * 180.0 / math.pi)
    if angle > 180.0:
        angle = 360.0 - angle
    return angle


def apply_ema(value: Point, state: EMAState, alpha: float = 0.35) -> Point:
    """
    Áp dụng Exponential Moving Average lên một điểm.
    Giảm jitter giữa các frame.
    Port của applyEMA() trong posemath.js.
    """
    if not state.initialized:
        state.x = value.x
        state.y = value.y
        state.initialized = True
        return Point(x=value.x, y=value.y, conf=value.conf)

    state.x = alpha * value.x + (1 - alpha) * state.x
    state.y = alpha * value.y + (1 - alpha) * state.y
    return Point(x=state.x, y=state.y, conf=value.conf)


def calculate_speed(prev: Optional[Point], curr: Point, dt_ms: float) -> float:
    """
    Tính tốc độ di chuyển của một điểm (normalized/s).
    dt_ms: delta time tính bằng milliseconds.
    Port của calculateSpeed() trong posemath.js.
    """
    if prev is None or dt_ms <= 0:
        return 0.0
    dx = curr.x - prev.x
    dy = curr.y - prev.y
    dist = math.sqrt(dx * dx + dy * dy)
    return (dist / dt_ms) * 1000.0


def detect_active_leg(keypoints: list[Point]) -> str:
    """
    Xác định chân nào đang đá dựa vào độ cao cổ chân so với hông.
    Trả về: 'left', 'right', hoặc 'none'.
    Port của detectActiveLeg() trong posemath.js.

    Lưu ý: trong tọa độ ảnh, Y tăng xuống dưới.
    Chân đang đá sẽ có ankle.y nhỏ hơn (lên cao hơn trong ảnh).
    """
    if len(keypoints) < 17:
        return "none"

    left_ankle  = keypoints[KP.LEFT_ANKLE]
    right_ankle = keypoints[KP.RIGHT_ANKLE]
    left_hip    = keypoints[KP.LEFT_HIP]
    right_hip   = keypoints[KP.RIGHT_HIP]

    CONF_THRESHOLD = 0.3
    if any(p.conf < CONF_THRESHOLD for p in [left_ankle, right_ankle, left_hip, right_hip]):
        return "none"

    # Khoảng cách dọc (hip.y - ankle.y): số dương = chân đang nhấc lên
    left_lift  = left_hip.y  - left_ankle.y
    right_lift = right_hip.y - right_ankle.y

    LIFT_THRESHOLD = 0.08

    if left_lift > LIFT_THRESHOLD and left_lift > right_lift + 0.03:
        return "left"
    if right_lift > LIFT_THRESHOLD and right_lift > left_lift + 0.03:
        return "right"
    return "none"


def parse_yolo_keypoints(raw_kps: list, img_w: int, img_h: int) -> list[Point]:
    """
    Chuyển đổi output YOLO-Pose thành danh sách Point chuẩn hóa (0–1).

    YOLO trả về keypoints dạng: [[x_px, y_px, conf], ...]
    Ta chuẩn hóa về [0, 1] để nhất quán với MediaPipe.

    :param raw_kps: list of [x, y, conf] hoặc tensor đã flatten
    :param img_w: chiều rộng ảnh (pixels)
    :param img_h: chiều cao ảnh (pixels)
    :return: list[Point] độ dài 17
    """
    points = []
    for kp in raw_kps:
        x_px, y_px, conf = float(kp[0]), float(kp[1]), float(kp[2])
        points.append(Point(
            x=x_px / img_w,
            y=y_px / img_h,
            conf=conf,
        ))
    return points


def get_angle_color_label(angle: float) -> str:
    """Nhãn màu phản hồi theo góc (dùng trong JSON output)."""
    if angle < 80:
        return "good"       # xanh lá
    if angle < 130:
        return "neutral"    # vàng
    return "poor"           # đỏ

