"""
person_tracker.py — Persistent Person Identity Tracking for Single-Athlete MMA Training
Tuân thủ tiêu chuẩn MMA-TMS Master Specification & Sprint 2 Architecture.

Cung cấp:
  1. Persistent Target Tracking (khóa mục tiêu cố định, không bị cướp bởi người lớn hơn)
  2. Temporal Identity Continuity (IoU + Center Distance + Scale Similarity)
  3. Catastrophic Landmark Jump Detection (bảo vệ chống đột biến vận tốc ảo)
  4. Reset-flagging cho downstream kinematic state machines
"""

import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np

from pose_math import KP, Point, parse_yolo_keypoints


@dataclass
class TrackedPerson:
    """Đại diện cho vận động viên đang được theo dõi liên tục qua chuỗi frame."""
    track_id: int
    bbox: List[float]                  # [x1, y1, x2, y2] toạ độ pixel
    norm_bbox: List[float]             # [x1, y1, x2, y2] toạ độ chuẩn hoá [0, 1]
    center: Tuple[float, float]        # (cx, cy) toạ độ chuẩn hoá [0, 1]
    area: float                        # Diện tích bounding box (pixel)
    keypoints: List[Point]             # 17 keypoints theo chuẩn YOLO-Pose
    confidence: float                  # Độ tin cậy trung bình của pose
    last_seen_frame: int
    missing_frames: int = 0


class PersonTracker:
    """
    Bộ theo dõi định danh cá nhân liên tục (Persistent Person Identity Tracker).
    Mục tiêu: Đảm bảo phân tích đúng 1 vận động viên mục tiêu trong video tập luyện,
    ngăn ngừa việc nhảy bounding box sang trọng tài, đối thủ hoặc người đi ngang qua.
    """

    def __init__(
        self,
        max_missing_frames: int = 15,     # ~250ms ở 60fps (thời gian cho phép mất dấu tạm thời)
        match_threshold: float = 0.25,     # Ngưỡng score kết hợp tối thiểu để match
        max_center_dist: float = 0.25,     # Khoảng cách tâm tối đa giữa 2 frame liên tiếp (chuẩn hoá)
        max_landmark_jump: float = 0.14,   # Độ dịch chuyển keypoint tối đa cho phép trước khi coi là teleport
    ):
        self.max_missing_frames = max_missing_frames
        self.match_threshold = match_threshold
        self.max_center_dist = max_center_dist
        self.max_landmark_jump = max_landmark_jump

        self.target: Optional[TrackedPerson] = None
        self.next_track_id: int = 1

        # Cờ báo hiệu frame hiện tại bị đứt gãy continuity (cần reset vi phân vận tốc)
        self.is_discontinuous: bool = False
        self.has_reacquired: bool = False

    def reset(self):
        """Khởi tạo lại trạng thái tracker."""
        self.target = None
        self.next_track_id = 1
        self.is_discontinuous = False
        self.has_reacquired = False

    @staticmethod
    def _compute_iou(box1: List[float], box2: List[float]) -> float:
        """Tính Intersection over Union giữa 2 bounding box [x1, y1, x2, y2]."""
        xA = max(box1[0], box2[0])
        yA = max(box1[1], box2[1])
        xB = min(box1[2], box2[2])
        yB = min(box1[3], box2[3])

        inter_w = max(0.0, xB - xA)
        inter_h = max(0.0, yB - yA)
        inter_area = inter_w * inter_h

        area1 = max(0.0, (box1[2] - box1[0]) * (box1[3] - box1[1]))
        area2 = max(0.0, (box2[2] - box2[0]) * (box2[3] - box2[1]))
        union_area = area1 + area2 - inter_area

        if union_area <= 0.0:
            return 0.0
        return inter_area / union_area

    def _extract_candidates(self, yolo_results, img_w: int, img_h: int) -> List[dict]:
        """Trích xuất tất cả các person detections hợp lệ từ kết quả YOLO."""
        candidates = []
        for result in yolo_results:
            if result.boxes is None or result.keypoints is None:
                continue
            boxes = result.boxes
            keypoints = result.keypoints

            for i in range(len(boxes)):
                box_xyxy = boxes[i].xyxy[0].tolist()  # [x1, y1, x2, y2] pixel
                conf = float(boxes[i].conf[0]) if boxes[i].conf is not None else 0.5
                if conf < 0.20:
                    continue

                area = (box_xyxy[2] - box_xyxy[0]) * (box_xyxy[3] - box_xyxy[1])
                if area < 100.0:
                    continue

                norm_box = [
                    box_xyxy[0] / img_w,
                    box_xyxy[1] / img_h,
                    box_xyxy[2] / img_w,
                    box_xyxy[3] / img_h,
                ]
                center = (
                    (norm_box[0] + norm_box[2]) / 2.0,
                    (norm_box[1] + norm_box[3]) / 2.0,
                )

                raw_kps = keypoints.data[i].cpu().numpy().tolist()
                parsed_kps = parse_yolo_keypoints(raw_kps, img_w, img_h)

                # Đánh giá độ tin cậy trung bình của 17 keypoints
                mean_kps_conf = sum(p.conf for p in parsed_kps) / len(parsed_kps) if parsed_kps else 0.0

                candidates.append({
                    "box": box_xyxy,
                    "norm_box": norm_box,
                    "center": center,
                    "area": area,
                    "keypoints": parsed_kps,
                    "confidence": (conf + mean_kps_conf) / 2.0,
                })
        return candidates

    def _select_initial_target(self, candidates: List[dict], frame_idx: int) -> Optional[TrackedPerson]:
        """Chọn mục tiêu ban đầu: người có diện tích lớn và nằm gần trung tâm nhất."""
        if not candidates:
            return None

        # Điểm ưu tiên: diện tích lớn + gần trung tâm khung hình (cx ~ 0.5, cy ~ 0.5)
        best_candidate = None
        best_score = -float("inf")

        for c in candidates:
            cx, cy = c["center"]
            dist_to_center = math.dist((cx, cy), (0.5, 0.5))
            # Score kết hợp diện tích và độ lệch tâm
            score = c["area"] * (1.0 - 0.4 * dist_to_center) * c["confidence"]
            if score > best_score:
                best_score = score
                best_candidate = c

        if best_candidate is None:
            return None

        tracked = TrackedPerson(
            track_id=self.next_track_id,
            bbox=best_candidate["box"],
            norm_bbox=best_candidate["norm_box"],
            center=best_candidate["center"],
            area=best_candidate["area"],
            keypoints=best_candidate["keypoints"],
            confidence=best_candidate["confidence"],
            last_seen_frame=frame_idx,
            missing_frames=0,
        )
        self.next_track_id += 1
        self.is_discontinuous = True  # Lần đầu tiên phát hiện -> bắt buộc reset derivative history
        self.has_reacquired = True
        return tracked

    def update(
        self,
        yolo_results,
        frame_idx: int,
        img_w: int,
        img_h: int,
    ) -> Tuple[Optional[List[Point]], bool]:
        """
        Cập nhật tracker với detections từ frame hiện tại.
        Trả về:
          (keypoints: Optional[list[Point]], is_discontinuous: bool)
        """
        self.is_discontinuous = False
        self.has_reacquired = False

        candidates = self._extract_candidates(yolo_results, img_w, img_h)

        # Trường hợp 1: Chưa có mục tiêu hoặc mục tiêu đã mất dấu quá lâu
        if self.target is None or self.target.missing_frames > self.max_missing_frames:
            self.target = self._select_initial_target(candidates, frame_idx)
            if self.target is not None:
                return self.target.keypoints, True
            return None, False

        # Trường hợp 2: Không có candidate nào trong frame này
        if not candidates:
            self.target.missing_frames += 1
            if self.target.missing_frames > self.max_missing_frames:
                self.target = None
                self.is_discontinuous = True
                return None, True
            # Vẫn trong ngưỡng cho phép: trả về keypoints frame trước (dùng cache)
            return self.target.keypoints, False

        # Trường hợp 3: Có target và có candidates -> Tìm candidate trùng khớp nhất với target
        best_candidate = None
        best_match_score = -1.0

        for c in candidates:
            iou = self._compute_iou(self.target.norm_bbox, c["norm_box"])
            cdist = math.dist(self.target.center, c["center"])
            scale_sim = min(self.target.area, c["area"]) / max(self.target.area, c["area"])

            # Điểm khoảng cách (1.0 nếu trùng tâm, giảm dần về 0 khi cdist >= max_center_dist)
            dist_score = max(0.0, 1.0 - (cdist / self.max_center_dist))

            # Độ tương đồng vị trí vai & hông (torso similarity) nếu có
            t_kps = self.target.keypoints
            c_kps = c["keypoints"]
            torso_sim = 1.0
            if len(t_kps) == 17 and len(c_kps) == 17:
                t_sh_x = (t_kps[KP.LEFT_SHOULDER].x + t_kps[KP.RIGHT_SHOULDER].x) / 2.0
                t_sh_y = (t_kps[KP.LEFT_SHOULDER].y + t_kps[KP.RIGHT_SHOULDER].y) / 2.0
                c_sh_x = (c_kps[KP.LEFT_SHOULDER].x + c_kps[KP.RIGHT_SHOULDER].x) / 2.0
                c_sh_y = (c_kps[KP.LEFT_SHOULDER].y + c_kps[KP.RIGHT_SHOULDER].y) / 2.0
                sh_dist = math.dist((t_sh_x, t_sh_y), (c_sh_x, c_sh_y))
                torso_sim = max(0.0, 1.0 - (sh_dist / self.max_center_dist))

            # Tổng hợp match score theo trọng số ưu tiên:
            # Identity continuity (IoU + Center + Torso) > Bounding box size
            match_score = (
                0.40 * iou +
                0.30 * dist_score +
                0.20 * torso_sim +
                0.10 * scale_sim
            )

            if match_score > best_match_score:
                best_match_score = match_score
                best_candidate = c

        # Đánh giá xem match có đạt ngưỡng tối thiểu hay không
        is_valid_match = (
            best_candidate is not None and
            (
                best_match_score >= self.match_threshold or
                self._compute_iou(self.target.norm_bbox, best_candidate["norm_box"]) >= 0.20 or
                math.dist(self.target.center, best_candidate["center"]) <= 0.12
            )
        )

        if is_valid_match:
            # Kiểm tra đột biến hình thể (Catastrophic Landmark Jump Protection)
            # Nếu mục tiêu vừa hồi phục sau frame rớt detection (track loss recovery), kích hoạt discontinuity
            discontinuous = (self.target.missing_frames > 0)
            prev_kps = self.target.keypoints
            curr_kps = best_candidate["keypoints"]

            if prev_kps and curr_kps and len(prev_kps) == 17 and len(curr_kps) == 17:
                disps = []
                for p_idx in [KP.LEFT_SHOULDER, KP.RIGHT_SHOULDER, KP.LEFT_HIP, KP.RIGHT_HIP]:
                    p1 = prev_kps[p_idx]
                    p2 = curr_kps[p_idx]
                    if p1.conf >= 0.25 and p2.conf >= 0.25:
                        d = math.dist((p1.x, p1.y), (p2.x, p2.y))
                        disps.append(d)

                if disps:
                    median_torso_disp = float(np.median(disps))
                    # Nếu toàn bộ thân người dịch chuyển > max_landmark_jump trong 1 frame
                    # Đây là hiện tượng teleport / nhầm người -> Phải đánh dấu discontinuous!
                    if median_torso_disp > self.max_landmark_jump:
                        discontinuous = True

            # Cập nhật mục tiêu
            self.target.bbox = best_candidate["box"]
            self.target.norm_bbox = best_candidate["norm_box"]
            self.target.center = best_candidate["center"]
            self.target.area = best_candidate["area"]
            self.target.keypoints = best_candidate["keypoints"]
            self.target.confidence = best_candidate["confidence"]
            self.target.last_seen_frame = frame_idx
            self.target.missing_frames = 0
            self.is_discontinuous = discontinuous

            return self.target.keypoints, discontinuous

        else:
            # Không match được candidate nào: mục tiêu bị che khuất hoặc rớt detection
            self.target.missing_frames += 1
            if self.target.missing_frames > self.max_missing_frames:
                # Quá hạn -> Xoá target và reacquire
                self.target = self._select_initial_target(candidates, frame_idx)
                if self.target is not None:
                    return self.target.keypoints, True
                return None, True

            # Chưa quá hạn: giữ nguyên keypoints frame trước (cache), không tạo đột biến vận tốc
            return self.target.keypoints, False
