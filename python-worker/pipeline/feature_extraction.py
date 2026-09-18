"""
feature_extraction.py — Pure Functional Feature Extractor (Task 2)

Trích xuất đặc trưng hình học cơ thể theo từng frame:
- extract_lower_body_features: tính góc gối, góc hông, tính hợp lệ hình học (validity gating)
- extract_upper_body_features: tính góc khuỷu trái/phải phục vụ legacy display

Nguyên tắc bắt buộc:
- Pure functions, stateless, không mutate bất kỳ đối tượng bên ngoài nào.
- Không sở hữu EMA, không update/reset PostureGate, không giữ state giữa các frame.
- Không chứa logic threshold mới hay chấm rubric.
"""

from typing import Optional

from pose_math import (
    KP, Point, PoseValidityConfig,
    calculate_angle, detect_active_leg,
    is_landmark_valid, are_landmarks_valid,
)
from pipeline.contracts import (
    LowerBodyFrameFeatures,
    UpperBodyFrameFeatures,
    LEGACY_ELBOW_DISPLAY_FALLBACK_DEG,
)


def extract_lower_body_features(
    filtered_kps: list[Point],
    posture: str,
    preferred_leg: str = "none",
    pose_config: Optional[PoseValidityConfig] = None,
) -> LowerBodyFrameFeatures:
    """
    Trích xuất đặc trưng thân dưới và kiểm tra rào chắn hợp lệ (Phase 2A Validity Gate).

    :param filtered_kps: 17 keypoints đã qua lọc EMA.
    :param posture: Trạng thái tư thế hiện tại ("standing", "crouched", "ground").
    :param preferred_leg: Chân đang ưu tiên theo dõi ("left", "right", "none").
    :param pose_config: Cấu hình ngưỡng kiểm tra landmark/vector.
    :return: LowerBodyFrameFeatures.
    """
    if pose_config is None:
        pose_config = PoseValidityConfig()

    # Nếu đang ở GROUND: ép active_leg = "none"
    if posture == "ground":
        active_leg = "none"
    else:
        active_leg = detect_active_leg(filtered_kps, preferred_leg=preferred_leg)

    l_hip_conf = round(filtered_kps[KP.LEFT_HIP].conf, 3)
    l_knee_conf = round(filtered_kps[KP.LEFT_KNEE].conf, 3)
    l_ankle_conf = round(filtered_kps[KP.LEFT_ANKLE].conf, 3)
    r_hip_conf = round(filtered_kps[KP.RIGHT_HIP].conf, 3)
    r_knee_conf = round(filtered_kps[KP.RIGHT_KNEE].conf, 3)
    r_ankle_conf = round(filtered_kps[KP.RIGHT_ANKLE].conf, 3)

    landmarks_valid = False
    geometry_valid = False
    rejection_reason = "NONE"
    knee_angle: Optional[float] = None
    hip_angle: Optional[float] = None
    active_ankle: Optional[Point] = None

    if active_leg == "left":
        hip = filtered_kps[KP.LEFT_HIP]
        knee = filtered_kps[KP.LEFT_KNEE]
        ankle = filtered_kps[KP.LEFT_ANKLE]
        shoulder = filtered_kps[KP.LEFT_SHOULDER]
        active_ankle = ankle

        if not are_landmarks_valid([hip, knee, ankle], min_confidence=pose_config.min_landmark_confidence):
            landmarks_valid = False
            geometry_valid = False
            rejection_reason = "INSUFFICIENT_LOWER_BODY_CONFIDENCE"
        else:
            landmarks_valid = True
            knee_angle = calculate_angle(hip, knee, ankle, config=pose_config)
            if knee_angle is None:
                geometry_valid = False
                rejection_reason = "DEGENERATE_VECTOR_LENGTH"
            else:
                geometry_valid = True
                rejection_reason = "NONE"

            if is_landmark_valid(shoulder, min_confidence=pose_config.min_landmark_confidence):
                hip_angle = calculate_angle(shoulder, hip, knee, config=pose_config)

    elif active_leg == "right":
        hip = filtered_kps[KP.RIGHT_HIP]
        knee = filtered_kps[KP.RIGHT_KNEE]
        ankle = filtered_kps[KP.RIGHT_ANKLE]
        shoulder = filtered_kps[KP.RIGHT_SHOULDER]
        active_ankle = ankle

        if not are_landmarks_valid([hip, knee, ankle], min_confidence=pose_config.min_landmark_confidence):
            landmarks_valid = False
            geometry_valid = False
            rejection_reason = "INSUFFICIENT_LOWER_BODY_CONFIDENCE"
        else:
            landmarks_valid = True
            knee_angle = calculate_angle(hip, knee, ankle, config=pose_config)
            if knee_angle is None:
                geometry_valid = False
                rejection_reason = "DEGENERATE_VECTOR_LENGTH"
            else:
                geometry_valid = True
                rejection_reason = "NONE"

            if is_landmark_valid(shoulder, min_confidence=pose_config.min_landmark_confidence):
                hip_angle = calculate_angle(shoulder, hip, knee, config=pose_config)

    else:
        landmarks_valid = False
        geometry_valid = False
        max_leg_conf = max(l_ankle_conf, r_ankle_conf, l_knee_conf, r_knee_conf)
        if max_leg_conf < pose_config.min_landmark_confidence:
            rejection_reason = "INSUFFICIENT_LOWER_BODY_CONFIDENCE"
        else:
            rejection_reason = "ACTIVE_LEG_NONE"

    return LowerBodyFrameFeatures(
        active_leg=active_leg,
        knee_angle=knee_angle,
        hip_angle=hip_angle,
        active_ankle=active_ankle,
        landmarks_valid=landmarks_valid,
        geometry_valid=geometry_valid,
        rejection_reason=rejection_reason,
        posture=posture,
        left_hip_conf=l_hip_conf,
        left_knee_conf=l_knee_conf,
        left_ankle_conf=l_ankle_conf,
        right_hip_conf=r_hip_conf,
        right_knee_conf=r_knee_conf,
        right_ankle_conf=r_ankle_conf,
    )


def extract_upper_body_features(
    filtered_kps: list[Point],
    min_confidence: float = 0.25,
) -> UpperBodyFrameFeatures:
    """
    Trích xuất đặc trưng thân trên và tính góc khuỷu phục vụ legacy display.

    :param filtered_kps: 17 keypoints đã qua lọc EMA.
    :param min_confidence: Ngưỡng confidence tối thiểu cho cụm vai-khuỷu-cổ tay (mặc định 0.25).
    :return: UpperBodyFrameFeatures.
    """
    l_sh = filtered_kps[KP.LEFT_SHOULDER]
    r_sh = filtered_kps[KP.RIGHT_SHOULDER]
    l_el = filtered_kps[KP.LEFT_ELBOW]
    r_el = filtered_kps[KP.RIGHT_ELBOW]
    l_wr = filtered_kps[KP.LEFT_WRIST]
    r_wr = filtered_kps[KP.RIGHT_WRIST]

    # Tay trái
    l_valid = min(l_sh.conf, l_el.conf, l_wr.conf) > min_confidence
    if l_valid:
        calc_l = calculate_angle(l_sh, l_el, l_wr, min_confidence=min_confidence)
        if calc_l is not None:
            l_angle = calc_l
            is_l_fallback = False
        else:
            l_angle = LEGACY_ELBOW_DISPLAY_FALLBACK_DEG
            is_l_fallback = True
            l_valid = False
    else:
        l_angle = LEGACY_ELBOW_DISPLAY_FALLBACK_DEG
        is_l_fallback = True

    # Tay phải
    r_valid = min(r_sh.conf, r_el.conf, r_wr.conf) > min_confidence
    if r_valid:
        calc_r = calculate_angle(r_sh, r_el, r_wr, min_confidence=min_confidence)
        if calc_r is not None:
            r_angle = calc_r
            is_r_fallback = False
        else:
            r_angle = LEGACY_ELBOW_DISPLAY_FALLBACK_DEG
            is_r_fallback = True
            r_valid = False
    else:
        r_angle = LEGACY_ELBOW_DISPLAY_FALLBACK_DEG
        is_r_fallback = True

    return UpperBodyFrameFeatures(
        left_elbow_angle=l_angle,
        right_elbow_angle=r_angle,
        is_left_fallback=is_l_fallback,
        is_right_fallback=is_r_fallback,
        left_shoulder=l_sh,
        right_shoulder=r_sh,
        left_elbow=l_el,
        right_elbow=r_el,
        left_wrist=l_wr,
        right_wrist=r_wr,
        left_arm_valid=l_valid,
        right_arm_valid=r_valid,
    )

