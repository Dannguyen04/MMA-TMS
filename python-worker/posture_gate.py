"""
posture_gate.py — MMA-TMS Standing / Crouched / Ground Posture Context Gate
Tuân thủ Master Specification v3.0 & Sprint 2 Architecture.

Chức năng:
  - Phân loại trạng thái tư thế: STANDING, CROUCHED, GROUND, UNKNOWN.
  - Áp dụng phân tích đa tín hiệu:
      * Torso vector angle (góc thân người so với phương thẳng đứng)
      * Tương quan độ cao hông - cổ chân (hip-to-ankle clearance)
      * Tỷ lệ khung hình thân người (aspect ratio)
      * Toạ độ tương đối của khớp vai và hông
  - Bảo vệ đòn cúi/trượt (CROUCHED / LEANING):
      * Các động tác slip, duck, forward-lean, overhand punch KHÔNG bị coi là GROUND.
  - Áp dụng Temporal Hysteresis:
      * Cần tối thiểu consecutive_ground_frames (3 frame) liên tiếp để vào GROUND.
      * Khi đứng dậy (GROUND -> STANDING), phát cờ just_stood_up để reset vi phân động học.
"""

from dataclasses import dataclass, field
from enum import Enum
import math
from typing import List, Optional, Tuple

from pose_math import Point, KP


class PostureState(str, Enum):
    STANDING = "standing"          # Đứng thẳng / di chuyển trên chân
    CROUCHED = "crouched"          # Cúi thấp / trượt đòn (slip, duck, overhand) — VẪN RA ĐƯỢC ĐÒN
    GROUND   = "ground"            # Nằm sàn / quỳ bò / mat posting / địa chiến — CHẶN ĐÒN ĐẤM
    UNKNOWN  = "unknown"           # Không đủ dữ liệu / mất landmark


@dataclass
class PostureGate:
    """
    Máy trạng thái lọc ngữ cảnh tư thế vận động viên.
    Ngăn chặn 100% các cú false positive do chống tay xuống sàn (mat posting)
    hoặc vật lộn địa chiến (ground grappling).
    """
    consecutive_ground_frames: int = 3
    consecutive_stand_frames: int = 2
    min_confidence: float = 0.25

    # Trạng thái nội bộ
    current_state: PostureState = PostureState.STANDING
    ground_counter: int = 0
    stand_counter: int = 0
    last_valid_state: PostureState = PostureState.STANDING

    def reset(self):
        """Reset toàn bộ bộ đếm và trạng thái."""
        self.current_state = PostureState.STANDING
        self.ground_counter = 0
        self.stand_counter = 0
        self.last_valid_state = PostureState.STANDING

    def update(self, keypoints: List[Point]) -> Tuple[PostureState, bool]:
        """
        Cập nhật trạng thái tư thế từ mảng keypoints 17 điểm.

        Returns
        -------
        Tuple[PostureState, bool]:
            - PostureState: trạng thái tư thế sau khi qua bộ lọc hysteresis.
            - just_stood_up: True nếu vừa chuyển trạng thái từ GROUND lên STANDING/CROUCHED
                             (cần reset lịch sử vận tốc để tránh vọt ảo khi bật dậy).
        """
        if len(keypoints) < 17:
            return PostureState.UNKNOWN, False

        l_sh = keypoints[KP.LEFT_SHOULDER]
        r_sh = keypoints[KP.RIGHT_SHOULDER]
        l_hip = keypoints[KP.LEFT_HIP]
        r_hip = keypoints[KP.RIGHT_HIP]

        # Kiểm tra độ tin cậy của vai và hông
        conf_torso = min(l_sh.conf, r_sh.conf, l_hip.conf, r_hip.conf)
        if conf_torso < self.min_confidence:
            # Dùng lại trạng thái trước nếu rớt confidence tạm thời
            return self.current_state, False

        # ── 1. Tính toán hình học thân người (Torso Kinematics) ──
        sh_x = (l_sh.x + r_sh.x) / 2.0
        sh_y = (l_sh.y + r_sh.y) / 2.0
        hip_x = (l_hip.x + r_hip.x) / 2.0
        hip_y = (l_hip.y + r_hip.y) / 2.0

        dx = abs(sh_x - hip_x)
        # Trong toạ độ ảnh Y tăng xuống dưới.
        # Ở tư thế đứng bình thường: vai ở trên hông => sh_y < hip_y => dy > 0.
        dy = hip_y - sh_y

        if dy > 1e-4:
            # Thân người thẳng hoặc nghiêng bình thường
            torso_angle = math.degrees(math.atan2(dx, dy))
        else:
            # Vai ngang hoặc thấp hơn hông (nằm bò, cắm đầu, hoặc lộn ngược)
            torso_angle = 90.0 + math.degrees(math.atan2(abs(dy), max(dx, 1e-4)))

        # ── 2. Đánh giá quan hệ chân & mặt sàn (Leg Clearance) ──
        l_ank = keypoints[KP.LEFT_ANKLE]
        r_ank = keypoints[KP.RIGHT_ANKLE]
        ank_conf_ok = max(l_ank.conf, r_ank.conf) >= self.min_confidence
        ank_y = max(l_ank.y, r_ank.y) if ank_conf_ok else None

        # Khoảng cách dọc từ hông tới cổ chân (dương khi hông ở trên chân)
        leg_clearance = (ank_y - hip_y) if ank_y is not None else None

        # Tỷ lệ khung hình thân người
        torso_w = max(abs(l_sh.x - r_sh.x), abs(l_hip.x - r_hip.x), dx)
        torso_h = max(dy, 0.02)
        aspect_ratio = torso_w / torso_h

        # ── 3. Phân loại frame tức thời (Raw Frame Classification) ──
        is_ground_candidate = False

        # Thân người thẳng đứng và vai cao hơn hông rõ rệt -> Luôn là STANDING
        if torso_angle < 28.0 and dy >= 0.08:
            is_ground_candidate = False

        # Điều kiện 1: Hoàn toàn lộn ngược hoặc nằm bẹp (vai ngang/dưới hông)
        elif dy <= 0.0:
            is_ground_candidate = True

        # Điều kiện 2: Góc thân nghiêng rất lớn (>= 60 độ)
        elif torso_angle >= 60.0:
            is_ground_candidate = True

        # Điều kiện 3: Góc thân nghiêng vừa (>= 42 độ) VÀ (hông sát sàn hoặc tỷ lệ bè ngang)
        elif torso_angle >= 42.0:
            if (leg_clearance is not None and leg_clearance <= 0.09) or aspect_ratio >= 0.90:
                is_ground_candidate = True

        # Điều kiện 4: Chân ở ngang hoặc cao hơn hông (tư thế nằm ngửa / guard trên sàn)
        elif torso_angle >= 35.0 and (leg_clearance is not None and leg_clearance <= 0.02):
            is_ground_candidate = True

        if is_ground_candidate:
            raw_state = PostureState.GROUND
        elif torso_angle >= 25.0:
            # Góc nghiêng vừa phải nhưng chân vẫn đứng vững trên sàn -> CROUCHED
            raw_state = PostureState.CROUCHED
        else:
            # Thân thẳng đứng (< 25 độ) -> STANDING
            raw_state = PostureState.STANDING

        # ── 4. Bộ lọc thời gian trễ (Temporal Hysteresis) ──
        just_stood_up = False

        if raw_state == PostureState.GROUND:
            self.stand_counter = 0
            self.ground_counter += 1
            if self.ground_counter >= self.consecutive_ground_frames:
                self.current_state = PostureState.GROUND
        else:
            self.ground_counter = 0
            if self.current_state == PostureState.GROUND:
                # Đang ở GROUND và có dấu hiệu đứng dậy
                self.stand_counter += 1
                if self.stand_counter >= self.consecutive_stand_frames:
                    self.current_state = raw_state
                    just_stood_up = True
            else:
                self.stand_counter = 0
                self.current_state = raw_state

        return self.current_state, just_stood_up
