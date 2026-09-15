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


@dataclass
class PoseValidityConfig:
    """
    Cấu hình kiểm tra tính hợp lệ của landmark và hình học (Phase 2A).
    EXPERIMENTAL / REQUIRES BENCHMARK CALIBRATION:
    Các giá trị này là tham số thực nghiệm giai đoạn đầu, không phải chân lý cơ sinh học tuyệt đối.
    """
    min_landmark_confidence: float = 0.35  # Ngưỡng tin cậy tối thiểu cho từng landmark
    min_segment_length: float = 0.02       # Chiều dài tối thiểu của vector BA, BC (chuẩn hóa 0..1)


def is_landmark_valid(
    p: Optional[Point],
    min_confidence: float = 0.35,
) -> bool:
    """
    Kiểm tra một landmark có hợp lệ hay không:
    - Điểm tồn tại (không None)
    - Tọa độ là số hữu hạn (finite)
    - Độ tin cậy (conf) đạt ngưỡng tối thiểu
    """
    if p is None:
        return False
    if not (math.isfinite(p.x) and math.isfinite(p.y) and math.isfinite(p.conf)):
        return False
    if p.conf < min_confidence:
        return False
    return True


def are_landmarks_valid(
    points: list[Optional[Point]],
    min_confidence: float = 0.35,
) -> bool:
    """Kiểm tra một danh sách landmark có đồng thời hợp lệ hay không."""
    return all(is_landmark_valid(p, min_confidence=min_confidence) for p in points)


def calculate_angle(
    a: Optional[Point],
    b: Optional[Point],
    c: Optional[Point],
    min_confidence: Optional[float] = None,
    min_segment_length: Optional[float] = None,
    config: Optional[PoseValidityConfig] = None,
) -> Optional[float]:
    """
    Tính góc tại đỉnh B, tạo bởi 3 điểm A-B-C.
    Trả về góc từ 0 đến 180 độ (float) nếu hình học hợp lệ, hoặc None nếu không hợp lệ.

    TECH-DEBT: POSE-GEOMETRY-001:
    Góc hiện tại được tính trên tọa độ ảnh chuẩn hóa (normalized image coordinates).
    Vì x_norm = x_px / width và y_norm = y_px / height, hệ tọa độ không đẳng hướng (non-isotropic)
    đối với video không vuông (như 16:9 3840x2160).
    Phase 2A giữ nguyên để không làm sai lệch các ngưỡng đã căn chỉnh của detector.
    Công việc tương lai cần benchmark góc normalized vs pixel/isotropic geometry
    trên tập mẫu pose được gắn nhãn trước khi căn chỉnh lại ngưỡng.

    Yêu cầu kiểm tra tính hợp lệ:
    1. Cả 3 điểm A, B, C đều tồn tại (không None).
    2. Tọa độ là số thực hữu hạn (math.isfinite).
    3. Độ tin cậy conf của A, B, C đều >= min_confidence.
    4. Vector BA có độ dài >= min_segment_length (không suy biến / near-zero).
    5. Vector BC có độ dài >= min_segment_length (không suy biến / near-zero).
    6. Các phép toán số học an toàn.
    """
    if a is None or b is None or c is None:
        return None

    if config is None:
        config = PoseValidityConfig()
    conf_thresh = min_confidence if min_confidence is not None else config.min_landmark_confidence
    seg_thresh = min_segment_length if min_segment_length is not None else config.min_segment_length

    # Kiểm tra tính hợp lệ từng landmark
    if not (is_landmark_valid(a, conf_thresh) and
            is_landmark_valid(b, conf_thresh) and
            is_landmark_valid(c, conf_thresh)):
        return None

    # Vector BA (từ B đến A) và BC (từ B đến C)
    v_ba_x = a.x - b.x
    v_ba_y = a.y - b.y
    v_bc_x = c.x - b.x
    v_bc_y = c.y - b.y

    len_ba = math.hypot(v_ba_x, v_ba_y)
    len_bc = math.hypot(v_bc_x, v_bc_y)

    # Kiểm tra vector suy biến / trùng điểm
    if len_ba < seg_thresh or len_bc < seg_thresh:
        return None

    radians = math.atan2(v_bc_y, v_bc_x) - math.atan2(v_ba_y, v_ba_x)
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
    # Unobserved joints must not drag the next visible joint toward an
    # extrapolated/off-screen coordinate. Preserve confidence, reset history.
    if not is_landmark_valid(value):
        state.initialized = False
        return Point(value.x, value.y, value.conf)
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


def detect_active_leg(keypoints: list[Point], preferred_leg: str = "none") -> str:
    """
    Xác định chân nào đang đá dựa vào độ cao cổ chân so với hông.
    Trả về: 'left', 'right', hoặc 'none'.
    Port của detectActiveLeg() trong posemath.js.

    Lưu ý: trong tọa độ ảnh, Y tăng xuống dưới.
    Chân đang đá sẽ có ankle.y nhỏ hơn (lên cao hơn trong ảnh).
    """
    if len(keypoints) < 17:
        return "none"
    if preferred_leg in ("left", "right"):
        return preferred_leg

    left_ankle  = keypoints[KP.LEFT_ANKLE]
    right_ankle = keypoints[KP.RIGHT_ANKLE]
    left_hip    = keypoints[KP.LEFT_HIP]
    right_hip   = keypoints[KP.RIGHT_HIP]

    candidates = {}
    for side, hip, knee_idx, ankle, shoulder_idx in (
        ("left", left_hip, KP.LEFT_KNEE, left_ankle, KP.LEFT_SHOULDER),
        ("right", right_hip, KP.RIGHT_KNEE, right_ankle, KP.RIGHT_SHOULDER),
    ):
        if not are_landmarks_valid([hip, ankle]):
            continue
        knee = keypoints[knee_idx]
        # Keep observing the same leg through extension and recovery. The
        # downstream geometry gate still rejects missing knees/ankles.
        lift = hip.y - ankle.y
        if lift > 0.08:
            candidates[side] = lift
            continue
        shoulder = keypoints[shoulder_idx]
        if not are_landmarks_valid([shoulder, knee]):
            continue
        torso_height = hip.y - shoulder.y
        thigh = math.hypot(knee.x - hip.x, knee.y - hip.y)
        # A raised thigh can chamber a kick while the ankle is below the hip.
        # Require an upright torso; crouching/ground poses are not candidates.
        if (torso_height > 0.05 and torso_height > abs(hip.x - shoulder.x)
                and thigh >= 0.02 and knee.y - hip.y < 0.5 * thigh):
            candidates[side] = (hip.y - knee.y) / thigh
    if not candidates:
        return "none"
    return max(candidates, key=candidates.get)


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


def get_angle_color_label(angle: Optional[float]) -> str:
    """Nhãn màu phản hồi theo góc (dùng trong JSON output). Trả về 'none' nếu góc là None."""
    if angle is None:
        return "none"
    if angle < 80:
        return "good"       # xanh lá
    if angle < 130:
        return "neutral"    # vàng
    return "poor"           # đỏ


def calculate_arm_length(shoulder: Point, elbow: Point, wrist: Point) -> float:
    """
    Tính tổng chiều dài cánh tay (xương cánh tay + cẳng tay).
    Đây là đại lượng sinh trắc học bất biến theo góc xoay thân (profile/frontal view).
    """
    if not (shoulder and elbow and wrist):
        return 0.0
    upper_arm = math.dist((shoulder.x, shoulder.y), (elbow.x, elbow.y))
    forearm = math.dist((elbow.x, elbow.y), (wrist.x, wrist.y))
    return upper_arm + forearm


def calculate_directional_reach_speed(prev_reach: float, curr_reach: float, dt_ms: float) -> float:
    """
    Tính vận tốc duỗi tay có hướng dọc theo trục vai-cổ tay (normalized/s).
    Dương = duỗi ra xa vai (extending).
    Âm = thu tay về vai (retracting).
    """
    if dt_ms <= 0:
        return 0.0
    return ((curr_reach - prev_reach) / dt_ms) * 1000.0
