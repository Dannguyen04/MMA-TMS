"""
person_tracker.py — Persistent Person Identity Tracking for Single-Athlete MMA Training
Tuân thủ tiêu chuẩn MMA-TMS Master Specification & Sprint 2 Architecture.

Cung cấp:
  1. Persistent Target Tracking (khóa mục tiêu cố định, không bị cướp bởi người lớn hơn)
  2. Temporal Identity Continuity (liên tục tư thế thân + vận tốc, KHÔNG dùng ngoại hình)
  3. Loại trừ lẫn nhau giữa các track (một detection không thể vừa là mục tiêu vừa là người khác)
  4. Abstain thay vì nhảy danh tính: mơ hồ/không khớp -> mục tiêu "chưa xác minh" (missing_frames > 0)
  5. Catastrophic Landmark Jump Detection (bảo vệ chống đột biến vận tốc ảo)
  6. Reset-flagging cho downstream kinematic state machines

Nguyên nhân lỗi cũ (vid_04, khung 148): mục tiêu chỉ được so với CHÍNH NÓ. Khi detection của mục tiêu rụng một
khung (ngã/che khuất), detection duy nhất còn gần là đối thủ (IoU >= 0.20 hoặc tâm <= 0.12) bị nhận làm mục tiêu
và danh tính dính vào người sai cho tới khi mất dấu lần sau. Bản này theo dõi cả những người khác (không dùng
ngoại hình): detection đã được một track khác giải thích tốt hơn thì không thể là mục tiêu; ứng viên mơ hồ giữa
hai người thì mục tiêu thành "chưa xác minh" (missing_frames > 0) thay vì đoán. Sau khi mất dấu quá hạn chỉ tái
thu nhận bằng bằng chứng liên tục (vị trí/tư thế/kích thước), mặc định KHÔNG đoán bằng luật "lớn nhất, gần tâm".
"""

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from pose_math import KP, Point, parse_yolo_keypoints

# Điểm neo thân dùng để so liên tục tư thế giữa các khung (vai + hông).
_ANCHORS = (KP.LEFT_SHOULDER, KP.RIGHT_SHOULDER, KP.LEFT_HIP, KP.RIGHT_HIP)
_ANCHOR_CONF = 0.30   # cùng ngưỡng 0.25-0.30 mà phần còn lại của pipeline dùng cho keypoint hợp lệ


@dataclass
class TrackedPerson:
    """Đại diện cho một người đang được theo dõi liên tục qua chuỗi frame (mục tiêu hoặc người khác)."""
    track_id: int
    bbox: List[float]                  # [x1, y1, x2, y2] toạ độ pixel
    norm_bbox: List[float]             # [x1, y1, x2, y2] toạ độ chuẩn hoá [0, 1]
    center: Tuple[float, float]        # (cx, cy) toạ độ chuẩn hoá [0, 1]
    area: float                        # Diện tích bounding box (pixel)
    keypoints: List[Point]             # 17 keypoints theo chuẩn YOLO-Pose
    confidence: float                  # Độ tin cậy trung bình của pose
    last_seen_frame: int
    missing_frames: int = 0
    # --- trạng thái chuyển động (pixel), chỉ dùng nội bộ ---
    kp_px: Optional[np.ndarray] = field(default=None, repr=False, compare=False)   # (17, 3) x, y, conf theo pixel
    velocity: Tuple[float, float] = (0.0, 0.0)                      # px/khung của điểm neo thân
    scale: float = 0.0                                              # chiều dài thân (vai->hông) px, EMA


class PersonTracker:
    """
    Bộ theo dõi định danh cá nhân liên tục (Persistent Person Identity Tracker).
    Mục tiêu: Đảm bảo phân tích đúng 1 vận động viên mục tiêu trong video tập luyện,
    ngăn ngừa việc nhảy bounding box sang trọng tài, đối thủ hoặc người đi ngang qua.
    """

    def __init__(
        self,
        max_missing_frames: int = 15,     # ~250ms ở 60fps (thời gian cho phép mất dấu tạm thời)
        match_threshold: float = 0.25,     # (giữ cho tương thích chữ ký cũ; không còn dùng để chấp nhận match)
        max_center_dist: float = 0.25,     # (giữ cho tương thích chữ ký cũ)
        max_landmark_jump: float = 0.14,   # Độ dịch chuyển keypoint tối đa cho phép trước khi coi là teleport
        gate_base: float = 0.60,           # Cổng chấp nhận (chiều dài thân, ở 60 fps) cho 1 khung liền kề
        gate_growth: float = 0.30,         # Cổng nở thêm mỗi khung bỏ lỡ (60 fps)
        gate_max: float = 2.0,             # Trần của cổng (60 fps): người không thể "dịch" quá ~0.6 chiều cao người
        ambiguity_ratio: float = 2.0,      # Ứng viên tốt nhất phải rẻ hơn ứng viên thứ nhì >= ratio lần (+ ambiguity_floor)
        ambiguity_floor: float = 0.15,     # Sàn cộng thêm (đơn vị: chiều dài thân), tránh ratio vô nghĩa khi cost ~ 0
        max_scale_ratio: float = 2.5,      # Tỉ lệ chiều dài thân tối đa cho phép giữa 2 lần thấy cùng một người
        max_box_height_ratio: float = 3.5, # Tỉ lệ chiều cao box tối đa (rộng hơn vì box bị cắt khi che khuất: đầu+vai ~ 1/3 thân)
        duplicate_frac: float = 0.15,      # Hai detection cùng một người nếu điểm neo thân lệch <= tỉ lệ này của bề rộng vai
        scene_cut_min_tracks: int = 3,     # Số track sống tối thiểu cùng mất khớp trong 1 khung để coi là cắt cảnh
        reacquire_patience: Optional[int] = None,  # None = không đoán; N = sau N khung vẫn mơ hồ thì quay về luật chọn ban đầu
        fps: Optional[float] = None,       # fps video: cổng dịch chuyển tính cho 60 fps, nở ra x(60/fps) khi fps thấp hơn
    ):
        self.max_missing_frames = max_missing_frames
        self.match_threshold = match_threshold
        self.max_center_dist = max_center_dist
        self.max_landmark_jump = max_landmark_jump
        # Hệ số thời gian của cổng: dịch chuyển mỗi khung tỉ lệ nghịch với fps. fps chưa biết -> giả định 30 fps.
        self.fps = fps
        self._speed_scale = max(1.0, 60.0 / fps) if fps and fps > 0 else 2.0
        self.gate_base = gate_base
        self.gate_growth = gate_growth
        self.gate_max = gate_max
        self.ambiguity_ratio = ambiguity_ratio
        self.ambiguity_floor = ambiguity_floor
        self.max_scale_ratio = max_scale_ratio
        self.max_box_height_ratio = max_box_height_ratio
        self.duplicate_frac = duplicate_frac
        self.scene_cut_min_tracks = scene_cut_min_tracks
        self.reacquire_patience = reacquire_patience

        self.target: Optional[TrackedPerson] = None
        self.next_track_id: int = 1
        self.others: List[TrackedPerson] = []   # mọi người khác đang thấy (loại trừ lẫn nhau, KHÔNG phải mục tiêu)
        self._next_other_id: int = 1
        self._last_known: Optional[TrackedPerson] = None   # snapshot mục tiêu cuối khi bị giải phóng
        self._released_at: Optional[int] = None

        # Cờ báo hiệu frame hiện tại bị đứt gãy continuity (cần reset vi phân vận tốc)
        self.is_discontinuous: bool = False
        self.has_reacquired: bool = False
        # Quyết định ở khung vừa xử lý (chỉ để chẩn đoán): acquire / match / ambiguous / no_match / scene_cut / ...
        self.last_decision: str = ""

    def reset(self):
        """Khởi tạo lại trạng thái tracker."""
        self.target = None
        self.next_track_id = 1
        self.others = []
        self._next_other_id = 1
        self._last_known = None
        self._released_at = None
        self.is_discontinuous = False
        self.has_reacquired = False
        self.last_decision = ""

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
                    "kp_px": np.asarray(raw_kps, dtype=float).reshape(-1, 3),
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

        tracked = self._new_person(best_candidate, frame_idx, self.next_track_id)
        self.next_track_id += 1
        self.is_discontinuous = True  # Lần đầu tiên phát hiện -> bắt buộc reset derivative history
        self.has_reacquired = True
        return tracked

    # ------------------------------------------------------------------ nội bộ: hình học liên tục

    @staticmethod
    def _torso_length(kp_px: np.ndarray) -> Optional[float]:
        if kp_px is None or len(kp_px) < 13:
            return None
        if min(kp_px[a, 2] for a in _ANCHORS) < _ANCHOR_CONF:
            return None
        sh = (kp_px[KP.LEFT_SHOULDER, :2] + kp_px[KP.RIGHT_SHOULDER, :2]) / 2.0
        hp = (kp_px[KP.LEFT_HIP, :2] + kp_px[KP.RIGHT_HIP, :2]) / 2.0
        length = float(np.hypot(*(sh - hp)))
        return length if length > 1.0 else None

    @staticmethod
    def _anchor_centroid(kp_px: np.ndarray) -> Optional[np.ndarray]:
        pts = [kp_px[a, :2] for a in _ANCHORS if kp_px[a, 2] >= _ANCHOR_CONF]
        return np.mean(pts, axis=0) if len(pts) >= 2 else None

    def _is_duplicate(self, c1: dict, c2: dict) -> bool:
        """
        Hai detection là CÙNG MỘT người (YOLO đôi khi trả hộp thừa/hộp bị kéo dài cho một người): các điểm neo thân tin
        cậy ở cả hai gần trùng nhau (trung vị <= `duplicate_frac` bề rộng vai). Hai người khác nhau không thể trùng vai
        sát như vậy, nên không bao giờ bị gộp nhầm.
        """
        k1, k2 = c1["kp_px"], c2["kp_px"]
        shared = [a for a in _ANCHORS if k1[a, 2] >= _ANCHOR_CONF and k2[a, 2] >= _ANCHOR_CONF]
        if len(shared) < 2:
            return False
        widths = []
        for k in (k1, k2):
            if k[KP.LEFT_SHOULDER, 2] >= _ANCHOR_CONF and k[KP.RIGHT_SHOULDER, 2] >= _ANCHOR_CONF:
                widths.append(float(np.hypot(*(k[KP.LEFT_SHOULDER, :2] - k[KP.RIGHT_SHOULDER, :2]))))
        if not widths or min(widths) < 4.0:
            return False
        dist = float(np.median([np.hypot(*(k1[a, :2] - k2[a, :2])) for a in shared]))
        return dist <= self.duplicate_frac * min(widths)

    def _new_person(self, cand: dict, frame_idx: int, track_id: int) -> TrackedPerson:
        box_h = cand["box"][3] - cand["box"][1]
        scale = self._torso_length(cand["kp_px"]) or 0.3 * box_h
        return TrackedPerson(
            track_id=track_id,
            bbox=cand["box"],
            norm_bbox=cand["norm_box"],
            center=cand["center"],
            area=cand["area"],
            keypoints=cand["keypoints"],
            confidence=cand["confidence"],
            last_seen_frame=frame_idx,
            missing_frames=0,
            kp_px=cand["kp_px"],
            velocity=(0.0, 0.0),
            scale=float(scale),
        )

    def _cost(self, tr: TrackedPerson, cand: dict, frame_idx: int, enforce_scale: bool = True) -> float:
        """
        Chi phí liên tục danh tính giữa track `tr` và ứng viên `cand` (không dùng ngoại hình). Đơn vị: CHIỀU DÀI THÂN
        của track nên không phụ thuộc độ phân giải/khoảng cách camera.
          1. Tư thế thân: độ lệch trung vị của các điểm neo (vai, hông) tin cậy ở cả hai khung so với vị trí dự đoán
             (vị trí cũ + vận tốc * min(dt, max_missing_frames): ngoại suy hằng-vận-tốc tối đa bằng đúng khoảng mất dấu mà tracker chấp nhận). Không đủ 2 điểm neo -> dùng tâm bounding box, phạt x1.5 (bằng chứng yếu).
          2. Hộp: 0.25 * (1 - IoU) giữa hộp dự đoán và hộp ứng viên (phá hòa giữa các detection gần như trùng nhau).
          3. Kích thước: chiều dài thân đổi quá `max_scale_ratio` lần, hoặc chiều cao hộp quá `max_box_height_ratio`
             lần -> loại hẳn (inf; khán giả/người ở xa, kể cả khi ứng viên không có keypoint thân); chênh nhỏ hơn thì
             phạt mềm 0.5 * (|ln tỉ lệ| - 0.25). `enforce_scale=False` chỉ dùng khi ứng viên là người duy nhất trong cảnh.
        """
        h_t = max(tr.bbox[3] - tr.bbox[1], 1.0)
        h_c = max(cand["box"][3] - cand["box"][1], 1.0)
        if enforce_scale and max(h_c / h_t, h_t / h_c) > self.max_box_height_ratio:
            return float("inf")
        dt = max(1, frame_idx - tr.last_seen_frame)
        shift = np.array(tr.velocity) * min(dt, self.max_missing_frames)
        scale = max(tr.scale, 8.0)
        d_pose = None
        if tr.kp_px is not None:
            diffs = [float(np.hypot(*(tr.kp_px[a, :2] + shift - cand["kp_px"][a, :2])))
                     for a in _ANCHORS
                     if tr.kp_px[a, 2] >= _ANCHOR_CONF and cand["kp_px"][a, 2] >= _ANCHOR_CONF]
            if len(diffs) >= 2:
                d_pose = float(np.median(diffs)) / scale
        shifted = [tr.bbox[0] + shift[0], tr.bbox[1] + shift[1], tr.bbox[2] + shift[0], tr.bbox[3] + shift[1]]
        if d_pose is None:
            tc = ((shifted[0] + shifted[2]) / 2.0, (shifted[1] + shifted[3]) / 2.0)
            cc = ((cand["box"][0] + cand["box"][2]) / 2.0, (cand["box"][1] + cand["box"][3]) / 2.0)
            d_pose = 1.5 * math.dist(tc, cc) / scale
        cost = d_pose + 0.25 * (1.0 - self._compute_iou(shifted, cand["box"]))
        c_len = self._torso_length(cand["kp_px"])
        if c_len is not None and tr.scale > 0:
            dev = abs(math.log(c_len / tr.scale))
            if enforce_scale and dev > math.log(self.max_scale_ratio):
                return float("inf")
            cost += 0.5 * max(0.0, dev - 0.25)
        return cost

    def _gate(self, tr: TrackedPerson, frame_idx: int) -> float:
        dt = max(1, frame_idx - tr.last_seen_frame)
        return self._speed_scale * min(self.gate_max, self.gate_base + self.gate_growth * (dt - 1))

    def _assign(self, tracks: List[TrackedPerson], cands: List[dict], frame_idx: int):
        """Gán tham lam 1-1 theo chi phí tăng dần trong cổng. Trả (match, cost_matrix)."""
        cost = np.full((len(tracks), len(cands)), np.inf)
        for i, tr in enumerate(tracks):
            g = self._gate(tr, frame_idx)
            for j, c in enumerate(cands):
                v = self._cost(tr, c, frame_idx)
                if v <= g:
                    cost[i, j] = v
        pairs = sorted((cost[i, j], i, j) for i in range(len(tracks)) for j in range(len(cands)) if np.isfinite(cost[i, j]))
        match: Dict[int, int] = {}
        used = set()
        for v, i, j in pairs:
            if i in match or j in used:
                continue
            match[i] = j
            used.add(j)
        return match, cost

    def _apply(self, tr: TrackedPerson, cand: dict, frame_idx: int):
        old = tr.kp_px
        dt = max(1, frame_idx - tr.last_seen_frame)
        if old is not None:
            # Vận tốc từ ĐÚNG các điểm neo chung (tin cậy ở cả hai khung): đổi tập điểm neo (vd. hông "hiện" ra) không
            # được tạo vận tốc giả. Chặn trên 0.5 chiều dài thân/khung.
            shared = [a for a in _ANCHORS if old[a, 2] >= _ANCHOR_CONF and cand["kp_px"][a, 2] >= _ANCHOR_CONF]
            if len(shared) >= 2:
                v = np.mean([cand["kp_px"][a, :2] - old[a, :2] for a in shared], axis=0) / dt
                cap = 0.5 * max(tr.scale, 8.0)
                norm = float(np.hypot(*v))
                if norm > cap:
                    v = v * (cap / norm)
                tr.velocity = (0.5 * tr.velocity[0] + 0.5 * float(v[0]), 0.5 * tr.velocity[1] + 0.5 * float(v[1]))
        length = self._torso_length(cand["kp_px"])
        if length is not None:
            tr.scale = 0.7 * tr.scale + 0.3 * length if tr.scale > 0 else length
        tr.bbox = cand["box"]
        tr.norm_bbox = cand["norm_box"]
        tr.center = cand["center"]
        tr.area = cand["area"]
        tr.keypoints = cand["keypoints"]
        tr.kp_px = cand["kp_px"]
        tr.confidence = cand["confidence"]
        tr.last_seen_frame = frame_idx
        tr.missing_frames = 0

    def _update_others(self, cands: List[dict], frame_idx: int, exclude: Optional[set] = None):
        """Cập nhật các track người khác với những detection mà mục tiêu không dùng; tạo track mới cho phần còn lại."""
        exclude = set(exclude or ())
        # Detection thừa của chính mục tiêu (hộp trùng người) không phải một người khác.
        for j in list(exclude):
            exclude.update(k for k in range(len(cands)) if k != j and self._is_duplicate(cands[j], cands[k]))
        free = [j for j in range(len(cands)) if j not in exclude]
        sub = [cands[j] for j in free]
        match, _ = self._assign(self.others, sub, frame_idx)
        kept = []
        used = set()
        for i, tr in enumerate(self.others):
            if i in match:
                self._apply(tr, sub[match[i]], frame_idx)
                used.add(match[i])
                kept.append(tr)
            else:
                tr.missing_frames += 1
                if tr.missing_frames <= self.max_missing_frames:
                    kept.append(tr)
        for k, c in enumerate(sub):
            if k not in used:
                kept.append(self._new_person(c, frame_idx, -self._next_other_id))
                self._next_other_id += 1
        self.others = kept

    # ------------------------------------------------------------------ chọn lại mục tiêu sau khi mất

    def _claimed(self, cand: dict, frame_idx: int) -> bool:
        """Detection đã được một track người khác (đang sống) giải thích -> không thể là mục tiêu quay lại."""
        for t in self.others:
            if t.missing_frames <= self.max_missing_frames and self._cost(t, cand, frame_idx) <= self._gate(t, frame_idx):
                return True
        return False

    def _reacquire(self, candidates: List[dict], frame_idx: int) -> Optional[Tuple[TrackedPerson, int]]:
        """
        Chọn lại mục tiêu khi chưa có (đầu video) hoặc đã bị giải phóng.
          - Đầu video (không có ký ức): luật cũ (người lớn nhất, gần tâm).
          - Có ký ức: chỉ xét detection CHƯA được track người khác giải thích (đối thủ/khán giả đang được theo dõi
            liên tục không thể là mục tiêu quay lại), rồi nhận ứng viên duy nhất nhất quán với vị trí/tư thế/kích thước
            cuối cùng của mục tiêu, hoặc người duy nhất trong cảnh. Mơ hồ -> chờ; hết `reacquire_patience` mới quay về
            luật chọn ban đầu (vẫn chỉ trong số detection chưa được giải thích).
        Trả (TrackedPerson, chỉ số ứng viên) hoặc None (= vẫn chưa xác minh được mục tiêu).
        """
        if not candidates:
            return None
        mem = self._last_known
        if mem is None:
            person = self._select_initial_target(candidates, frame_idx)
            if person is None:
                return None
            return self._promote(person, candidates), self._index_of(candidates, person)
        free = [j for j, c in enumerate(candidates) if not self._claimed(c, frame_idx)]
        if not free:
            return None
        scored = sorted((self._cost(mem, candidates[j], frame_idx), j) for j in free)
        pick = None
        if scored[0][0] <= self._gate(mem, frame_idx):
            second = scored[1][0] if len(scored) > 1 else float("inf")
            if second > self.ambiguity_ratio * scored[0][0] + self.ambiguity_floor:
                pick = scored[0][1]
        if pick is None and len(candidates) == 1 and not self.others_alive():
            pick = free[0]
        if pick is None:
            if self.reacquire_patience is None:
                return None   # không có bằng chứng liên tục -> không đoán (abstain)
            waited = frame_idx - (self._released_at if self._released_at is not None else frame_idx)
            if waited < self.reacquire_patience:
                return None
            person = self._select_initial_target([candidates[j] for j in free], frame_idx)
            if person is None:
                return None
            return self._promote(person, candidates), self._index_of(candidates, person)
        return self._adopt(candidates[pick], frame_idx), pick

    def _promote(self, person: TrackedPerson, candidates: List[dict]) -> TrackedPerson:
        """Người vừa được chọn làm mục tiêu có thể đang nằm trong `others`: gỡ track trùng để không tự loại trừ chính mình."""
        j = self._index_of(candidates, person)
        if j >= 0:
            self._drop_other_matching(candidates[j], person.last_seen_frame)
        return person

    def _adopt(self, cand: dict, frame_idx: int) -> TrackedPerson:
        person = self._new_person(cand, frame_idx, self.next_track_id)
        self.next_track_id += 1
        self.is_discontinuous = True
        self.has_reacquired = True
        self._drop_other_matching(cand, frame_idx)
        return person

    def _drop_other_matching(self, cand: dict, frame_idx: int):
        best = None
        for t in self.others:
            v = self._cost(t, cand, frame_idx)
            if v <= self._gate(t, frame_idx) and (best is None or v < best[0]):
                best = (v, t)
        if best is not None:
            self.others.remove(best[1])

    @staticmethod
    def _index_of(candidates: List[dict], person: TrackedPerson) -> int:
        for j, c in enumerate(candidates):
            if c["box"] == person.bbox:
                return j
        return -1

    def others_alive(self) -> bool:
        """Có track người khác nào đang sống ngoài detection hiện tại không (để biết cảnh có >1 người)."""
        return any(t.missing_frames <= self.max_missing_frames for t in self.others)

    def _release(self, frame_idx: int):
        self._last_known = self.target
        self._released_at = frame_idx
        self.target = None

    # ------------------------------------------------------------------ API chính

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
        Khi mục tiêu chưa xác minh được (mơ hồ / không khớp), `target.missing_frames > 0` như khi rớt detection.
        """
        self.is_discontinuous = False
        self.has_reacquired = False
        self.last_decision = ""

        candidates = self._extract_candidates(yolo_results, img_w, img_h)

        # Trường hợp 1: Chưa có mục tiêu hoặc mục tiêu đã mất dấu quá lâu
        if self.target is None or self.target.missing_frames > self.max_missing_frames:
            if self.target is not None:
                self._release(frame_idx)
            got = self._reacquire(candidates, frame_idx)
            if got is not None:
                self.target, j = got
                self._update_others(candidates, frame_idx, exclude={j} if j >= 0 else set())
                self.last_decision = "acquire"
                return self.target.keypoints, True
            self._update_others(candidates, frame_idx)
            self.last_decision = "no_target"
            return None, False

        # Trường hợp 2: Không có candidate nào trong frame này
        if not candidates:
            self.target.missing_frames += 1
            self._update_others(candidates, frame_idx)
            self.last_decision = "no_candidates"
            if self.target.missing_frames > self.max_missing_frames:
                self._release(frame_idx)
                self.is_discontinuous = True
                return None, True
            # Vẫn trong ngưỡng cho phép: trả về keypoints frame trước (dùng cache)
            return self.target.keypoints, False

        # Trường hợp 3: Có target và có candidates -> gán 1-1 giữa MỌI track (mục tiêu + người khác) và detection
        if self.target.kp_px is not None:
            # track "người khác" trùng hệt mục tiêu (hộp thừa sinh ra trước khi biết) thực chất là mục tiêu
            self.others = [t for t in self.others
                           if t.kp_px is None or not self._is_duplicate({"kp_px": t.kp_px}, {"kp_px": self.target.kp_px})]
        tracks = [self.target] + self.others
        match, cost = self._assign(tracks, candidates, frame_idx)
        # Cắt cảnh / camera giật: ít nhất 3 track còn "sống" mà KHÔNG track nào khớp detection nào -> mọi liên tục
        # (kể cả ký ức mục tiêu) đã mất cùng lúc, bắt đầu lại như đầu video thay vì đoán theo vị trí cũ.
        live = [i for i, t in enumerate(tracks) if t.missing_frames == 0]
        if len(live) >= self.scene_cut_min_tracks and not any(i in match for i in live):
            self.target = None
            self.others = []
            self._last_known = None
            self.target = self._select_initial_target(candidates, frame_idx)
            self._update_others(candidates, frame_idx, exclude={self._index_of(candidates, self.target)})
            self.last_decision = "scene_cut"
            return self.target.keypoints, True
        j_star = match.get(0)
        ambiguous = False
        sole = False
        if j_star is None and not self.others_alive():
            # Người DUY NHẤT trong cảnh (bỏ qua hộp thừa trùng người, không có track người khác nào đang sống): không có
            # ai để nhầm, nên nhận lại ngay cả khi vượt cổng dịch chuyển (giật hình/pose nhảy) và báo discontinuity để
            # hạ nguồn reset vi phân. Không cần cổng kích thước (không có ai khác để lẫn với; đổi khung hình/zoom/góc
            # quay làm chiều dài thân đổi mạnh là bình thường).
            distinct = [j for j, c in enumerate(candidates)
                        if not any(self._is_duplicate(candidates[k], c) for k in range(j))]
            if len(distinct) == 1:
                j_star, sole = distinct[0], True
        if j_star is not None and not sole:
            best = cost[0, j_star]
            # (i) ứng viên khác cũng khớp mục tiêu gần ngang, và không bị track khác giải thích tốt hơn
            for j in range(len(candidates)):
                if j == j_star or not np.isfinite(cost[0, j]):
                    continue
                if self._is_duplicate(candidates[j_star], candidates[j]):
                    continue   # cùng một người, không phải đối thủ cạnh tranh
                owner = next((i for i, jj in match.items() if jj == j and i != 0), None)
                if owner is not None and cost[owner, j] <= cost[0, j]:
                    continue
                if cost[0, j] <= self.ambiguity_ratio * best + self.ambiguity_floor:
                    ambiguous = True
                    break
            # (ii) detection được chọn cũng khớp một track người khác gần ngang
            if not ambiguous:
                for i in range(1, len(tracks)):
                    if np.isfinite(cost[i, j_star]) and cost[i, j_star] <= self.ambiguity_ratio * best + self.ambiguity_floor:
                        ambiguous = True
                        break

        if j_star is not None and not ambiguous:
            cand = candidates[j_star]
            # Kiểm tra đột biến hình thể (Catastrophic Landmark Jump Protection)
            # Nếu mục tiêu vừa hồi phục sau frame rớt detection (track loss recovery), kích hoạt discontinuity
            discontinuous = (self.target.missing_frames > 0)
            prev_kps = self.target.keypoints
            curr_kps = cand["keypoints"]

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

            self._apply(self.target, cand, frame_idx)
            self._update_others(candidates, frame_idx, exclude={j_star})
            self.is_discontinuous = discontinuous
            self.last_decision = "match"
            return self.target.keypoints, discontinuous

        # Không xác minh được mục tiêu (không ứng viên nào trong cổng, hoặc mơ hồ): KHÔNG nhảy sang người khác.
        self.last_decision = "ambiguous" if ambiguous else "no_match"
        self.target.missing_frames += 1
        if self.target.missing_frames > self.max_missing_frames:
            # Quá hạn -> giải phóng và chọn lại theo chính sách tái thu nhận (không còn nhảy sang người gần nhất)
            self._release(frame_idx)
            got = self._reacquire(candidates, frame_idx)
            if got is not None:
                self.target, j = got
                self._update_others(candidates, frame_idx, exclude={j} if j >= 0 else set())
                self.last_decision = "reacquire"
                return self.target.keypoints, True
            self._update_others(candidates, frame_idx)
            self.is_discontinuous = True
            return None, True
        # Các track người khác vẫn được cập nhật bằng detection mà chúng giải thích được.
        self._update_others(candidates, frame_idx)

        # Chưa quá hạn: giữ nguyên keypoints frame trước (cache), không tạo đột biến vận tốc
        return self.target.keypoints, False
