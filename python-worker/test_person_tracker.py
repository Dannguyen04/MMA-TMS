"""
test_person_tracker.py — Unit tests cho PersonTracker & Discontinuity Protection
Tuân thủ tiêu chuẩn MMA-TMS Master Specification & Sprint 2 Architecture.
Chạy: python test_person_tracker.py
"""

import unittest
from types import SimpleNamespace

from pose_math import KP, Point
from person_tracker import PersonTracker, TrackedPerson
from punch_analyzer import PunchAnalyzer, PunchState


def make_yolo_result(boxes_xyxy: list, keypoints_list: list):
    """Giả lập cấu trúc kết quả trả về từ Ultralytics YOLOv8-Pose."""
    import torch

    class FakeBoxes:
        def __init__(self, xyxy_list):
            self.xyxy = torch.tensor(xyxy_list, dtype=torch.float32) if len(xyxy_list) > 0 else torch.empty((0, 4))
            self.conf = torch.tensor([0.9] * len(xyxy_list), dtype=torch.float32) if len(xyxy_list) > 0 else torch.empty((0,))
        def __len__(self):
            return len(self.xyxy)
        def __getitem__(self, idx):
            return SimpleNamespace(
                xyxy=self.xyxy[idx:idx+1],
                conf=self.conf[idx:idx+1]
            )

    class FakeKeypoints:
        def __init__(self, kps_list):
            # Shape [N, 17, 3]
            self.data = torch.tensor(kps_list, dtype=torch.float32) if len(kps_list) > 0 else torch.empty((0, 17, 3))

    boxes_obj = FakeBoxes(boxes_xyxy)
    kps_obj = FakeKeypoints(keypoints_list)

    return [SimpleNamespace(boxes=boxes_obj, keypoints=kps_obj)]


def create_raw_kps(center_x=0.5, center_y=0.5, scale=1.0) -> list:
    """Tạo raw keypoints [[x, y, conf], ...] 17 điểm bao quanh center_x, center_y."""
    raw = []
    for i in range(17):
        # Tạo toạ độ x, y quanh center
        dx = (i % 3 - 1) * 20.0 * scale
        dy = (i // 3 - 2) * 20.0 * scale
        raw.append([center_x * 1000.0 + dx, center_y * 1000.0 + dy, 0.9])
    return raw


class TestPersonTracker(unittest.TestCase):

    def setUp(self):
        self.tracker = PersonTracker(max_missing_frames=15, max_landmark_jump=0.14)

    def test_a_single_athlete_stable_id(self):
        """Test A: Một vận động viên duy nhất di chuyển tự nhiên -> track_id giữ nguyên qua 50 frame."""
        for f in range(50):
            cx = 0.5 + 0.001 * f
            cy = 0.5
            box = [cx * 1000 - 100, cy * 1000 - 200, cx * 1000 + 100, cy * 1000 + 200]
            kps = [create_raw_kps(cx, cy)]
            yolo_res = make_yolo_result([box], kps)

            pts, is_disc = self.tracker.update(yolo_res, frame_idx=f, img_w=1000, img_h=1000)

            self.assertIsNotNone(pts)
            self.assertEqual(self.tracker.target.track_id, 1)
            if f > 0:
                self.assertFalse(is_disc)

    def test_b_larger_person_does_not_steal_target(self):
        """Test B: Một người thứ hai có diện tích lớn hơn bước vào khung hình -> target KHÔNG bị cướp."""
        # Frame 0: VĐV mục tiêu xuất hiện (box 200x400)
        box_ath = [400, 300, 600, 700]  # area = 80,000
        kps_ath = create_raw_kps(0.5, 0.5)
        res0 = make_yolo_result([box_ath], [kps_ath])
        self.tracker.update(res0, frame_idx=0, img_w=1000, img_h=1000)
        self.assertEqual(self.tracker.target.track_id, 1)

        # Frame 1..20: Người thứ 2 (ví dụ trọng tài hoặc HLV) đứng gần camera (box 350x600, area = 210,000)
        for f in range(1, 20):
            box_ath = [405, 300, 605, 700]
            kps_ath = create_raw_kps(0.505, 0.5)

            # Người lớn hơn đứng ở góc trái x = 100..450
            box_large = [100, 200, 450, 800]
            kps_large = create_raw_kps(0.275, 0.5, scale=1.5)

            res = make_yolo_result([box_large, box_ath], [kps_large, kps_ath])
            pts, is_disc = self.tracker.update(res, frame_idx=f, img_w=1000, img_h=1000)

            self.assertIsNotNone(pts)
            # Phải giữ nguyên track_id = 1 của VĐV ban đầu
            self.assertEqual(self.tracker.target.track_id, 1)
            # Toạ độ tâm của target phải khớp với VĐV (cx ~ 0.505), không phải người lớn hơn (cx ~ 0.275)
            self.assertAlmostEqual(self.tracker.target.center[0], 0.505, delta=0.03)

    def test_c_referee_crosses_in_front(self):
        """Test C: Trọng tài đi lướt ngang qua phía trước VĐV -> target vẫn là VĐV."""
        # VĐV đứng ở giữa x ~ 0.5
        box_ath = [400, 300, 600, 700]
        kps_ath = create_raw_kps(0.5, 0.5)
        self.tracker.update(make_yolo_result([box_ath], [kps_ath]), frame_idx=0, img_w=1000, img_h=1000)

        # Trọng tài đi từ x = 0.1 sang x = 0.9, cắt ngang qua x = 0.5 ở frame 5..7
        for f in range(1, 15):
            ref_x = 0.1 + f * 0.06
            box_ref = [ref_x * 1000 - 120, 250, ref_x * 1000 + 120, 750]
            kps_ref = create_raw_kps(ref_x, 0.5)

            box_ath_f = [400, 300, 600, 700]
            kps_ath_f = create_raw_kps(0.5, 0.5)

            res = make_yolo_result([box_ath_f, box_ref], [kps_ath_f, kps_ref])
            pts, is_disc = self.tracker.update(res, frame_idx=f, img_w=1000, img_h=1000)

            self.assertEqual(self.tracker.target.track_id, 1)
            self.assertAlmostEqual(self.tracker.target.center[0], 0.5, delta=0.05)

    def test_d_temporary_occlusion_survives(self):
        """Test D: Mục tiêu bị che khuất tạm thời (5 frame rỗng) -> tracker vẫn sống sót qua cache."""
        box_ath = [400, 300, 600, 700]
        kps_ath = create_raw_kps(0.5, 0.5)
        self.tracker.update(make_yolo_result([box_ath], [kps_ath]), frame_idx=0, img_w=1000, img_h=1000)

        # 5 frame không có detection
        empty_res = make_yolo_result([], [])
        for f in range(1, 6):
            pts, is_disc = self.tracker.update(empty_res, frame_idx=f, img_w=1000, img_h=1000)
            self.assertIsNotNone(pts)  # Vẫn trả về cache
            self.assertEqual(self.tracker.target.missing_frames, f)
            self.assertEqual(self.tracker.target.track_id, 1)

        # Frame 6: VĐV xuất hiện trở lại ở vị trí gần đó
        box_back = [410, 300, 610, 700]
        kps_back = create_raw_kps(0.51, 0.5)
        pts_back, is_disc = self.tracker.update(make_yolo_result([box_back], [kps_back]), frame_idx=6, img_w=1000, img_h=1000)

        self.assertIsNotNone(pts_back)
        self.assertEqual(self.tracker.target.track_id, 1)
        self.assertEqual(self.tracker.target.missing_frames, 0)

    def test_e_permanent_disappearance_triggers_reacquisition(self):
        """Test E: Mục tiêu biến mất quá max_missing_frames (15 frames) -> huỷ và tái thiết lập (reacquire)."""
        box_ath = [400, 300, 600, 700]
        kps_ath = create_raw_kps(0.5, 0.5)
        self.tracker.update(make_yolo_result([box_ath], [kps_ath]), frame_idx=0, img_w=1000, img_h=1000)
        self.assertEqual(self.tracker.target.track_id, 1)

        # 16 frames rỗng (> 15)
        empty_res = make_yolo_result([], [])
        for f in range(1, 17):
            pts, is_disc = self.tracker.update(empty_res, frame_idx=f, img_w=1000, img_h=1000)

        # Target đã bị giải phóng
        self.assertIsNone(self.tracker.target)

        # VĐV mới / xuất hiện lại
        box_new = [200, 300, 400, 700]
        kps_new = create_raw_kps(0.3, 0.5)
        pts_new, is_disc = self.tracker.update(make_yolo_result([box_new], [kps_new]), frame_idx=17, img_w=1000, img_h=1000)

        self.assertIsNotNone(pts_new)
        self.assertEqual(self.tracker.target.track_id, 2)  # Track ID mới được cấp
        self.assertTrue(is_disc)  # Discontinuity được kích hoạt

    def test_f_catastrophic_landmark_jump_resets_velocity_and_blocks_false_punch(self):
        """Test F: Bước nhảy toạ độ đột biến (teleport) kích hoạt flag discontinuity và không sinh cú đấm ảo."""
        box1 = [400, 300, 600, 700]
        kps1 = create_raw_kps(0.5, 0.5)
        pts1, is_disc1 = self.tracker.update(make_yolo_result([box1], [kps1]), frame_idx=0, img_w=1000, img_h=1000)

        # Nhảy đột biến 180 pixel (0.18 screen units > max_landmark_jump 0.14)
        box2 = [580, 300, 780, 700]
        kps2 = create_raw_kps(0.68, 0.5)
        pts2, is_disc2 = self.tracker.update(make_yolo_result([box2], [kps2]), frame_idx=1, img_w=1000, img_h=1000)

        # Tracker phải phát hiện sự bất thường này
        self.assertTrue(is_disc2)

        # Kiểm tra với PunchAnalyzer: khi nhận is_discontinuous=True, vi phân bị huỷ và KHÔNG sinh punch
        analyzer = PunchAnalyzer()
        res1 = analyzer.update(pts1, frame_idx=0, time_ms=0.0, is_discontinuous=is_disc1)
        res2 = analyzer.update(pts2, frame_idx=1, time_ms=16.7, is_discontinuous=is_disc2)

        self.assertIsNone(res1)
        self.assertIsNone(res2)
        # Không được phép bị vọt lên EXTENDING do vận tốc ảo
        self.assertEqual(analyzer.state, PunchState.GUARD)


def create_person_kps(cx: float, cy: float, torso: float = 100.0, conf: float = 0.9) -> list:
    """Keypoints [[x_px, y_px, conf]] giải phẫu hợp lý: vai/hông là điểm neo; `cy` = giữa thân, `torso` = dài vai->hông (px)."""
    sh_y, hip_y = cy - torso / 2, cy + torso / 2
    pts = {
        0: (cx, sh_y - 0.45 * torso),
        5: (cx - 0.4 * torso, sh_y), 6: (cx + 0.4 * torso, sh_y),
        7: (cx - 0.55 * torso, cy), 8: (cx + 0.55 * torso, cy),
        9: (cx - 0.6 * torso, hip_y), 10: (cx + 0.6 * torso, hip_y),
        11: (cx - 0.3 * torso, hip_y), 12: (cx + 0.3 * torso, hip_y),
        13: (cx - 0.3 * torso, hip_y + 0.9 * torso), 14: (cx + 0.3 * torso, hip_y + 0.9 * torso),
        15: (cx - 0.3 * torso, hip_y + 1.8 * torso), 16: (cx + 0.3 * torso, hip_y + 1.8 * torso),
    }
    return [[*pts.get(i, (cx, cy)), conf if i in pts else 0.1] for i in range(17)]


def create_person_box(cx: float, cy: float, torso: float = 100.0) -> list:
    return [cx - 0.75 * torso, cy - 0.95 * torso, cx + 0.75 * torso, cy + 1.95 * torso]


def frame_of(people: list):
    """people = [(cx, cy, torso), ...] -> kết quả YOLO giả (ảnh 1000x1000)."""
    return make_yolo_result([create_person_box(*p) for p in people], [create_person_kps(*p) for p in people])


class TestIdentityAmbiguity(unittest.TestCase):
    """
    Danh tính khi có người thứ hai sát bên. Lỗi gốc (vid_04 khung 148): detection của mục tiêu rụng vài khung,
    đối thủ sát bên (IoU >= 0.20) bị nhận làm mục tiêu và danh tính dính vào người sai. Chuẩn: abstain
    (missing_frames > 0), không bao giờ trả pose của người khác như một quan sát tươi của mục tiêu.
    """

    def setUp(self):
        self.tracker = PersonTracker(max_missing_frames=15, max_landmark_jump=0.14, fps=60.0)

    def _run(self, frames):
        """frames: iterable (frame_idx, people). Trả về list (frame, track_id, verified, centre_x, disc)."""
        out = []
        for f, people in frames:
            _, disc = self.tracker.update(frame_of(people), frame_idx=f, img_w=1000, img_h=1000)
            t = self.tracker.target
            if t is None:
                out.append((f, None, False, None, disc))
            else:
                out.append((f, t.track_id, t.missing_frames == 0, (t.bbox[0] + t.bbox[2]) / 2.0, disc))
        return out

    def test_g_adjacent_opponent_does_not_hijack_when_target_detection_drops(self):
        """Mục tiêu A rụng detection 4 khung, đối thủ B đứng sát (IoU với hộp cũ của A > 0.20) -> KHÔNG nhận B."""
        a_box, b_box = create_person_box(450, 500), create_person_box(520, 500)
        self.assertGreater(PersonTracker._compute_iou(a_box, b_box), 0.20)   # đúng điều kiện cũ gây nhảy danh tính
        frames = [(f, [(450, 500, 101), (520, 500, 100)] if not 20 <= f < 24 else [(520, 500, 100)]) for f in range(40)]
        rows = self._run(frames)
        for f, tid, verified, cx, disc in rows:
            self.assertEqual(tid, 1)
            if verified:
                self.assertAlmostEqual(cx, 450, delta=5, msg=f"khung {f}: pose tươi thuộc người sai")
        self.assertTrue(all(not r[2] for r in rows[20:24]))      # các khung rụng đều "chưa xác minh"
        self.assertTrue(all(r[2] for r in rows[24:]))            # A quay lại thì xác minh lại ngay
        self.assertTrue(rows[24][4])                              # và báo discontinuity để hạ nguồn reset vi phân

    def test_h_long_loss_never_adopts_the_opponent_and_reacquires_by_continuity(self):
        """Mất A lâu hơn max_missing_frames: B (luôn thấy) không bao giờ trở thành mục tiêu; A về chỗ cũ -> track mới."""
        frames = [(f, [(450, 500, 101), (560, 500, 100)] if not 10 <= f < 40 else [(560, 500, 100)]) for f in range(60)]
        rows = self._run(frames)
        for f, tid, verified, cx, disc in rows:
            if verified:
                self.assertAlmostEqual(cx, 450, delta=5, msg=f"khung {f}: pose tươi thuộc người sai")
        self.assertTrue(all(r[1] is None for r in rows[26:40]))   # đã giải phóng và KHÔNG đoán sang B
        self.assertEqual(rows[40][1], 2)                          # track mới (đứt quá hạn) nhưng đúng người
        self.assertTrue(rows[40][2] and rows[40][4])

    def test_i_overtaking_person_keeps_identity(self):
        """A nhanh vượt B chậm cùng hướng (hộp chồng lên nhau): luôn bám A, không nhảy sang B."""
        frames = [(f, [(200 + 30 * f, 500, 112), (500 + 5 * f, 500, 100)]) for f in range(40)]
        rows = self._run(frames)
        verified = [r for r in rows if r[2]]
        self.assertGreaterEqual(len(verified), 36)
        for f, tid, ok, cx, disc in verified:
            self.assertAlmostEqual(cx, 200 + 30 * f, delta=10, msg=f"khung {f}")

    def test_j_dropout_during_crossing_recovers_by_velocity(self):
        """A và B đi ngược chiều cắt nhau; A rụng detection ngay lúc cắt. Không bao giờ nhận B; A xuất hiện lại thì
        nhận đúng A nhờ vận tốc (dự đoán qua chỗ khuất)."""
        def people(f):
            a, b = (300 + 20 * f, 500, 101), (700 - 20 * f, 500, 100)
            return [b] if 8 <= f < 14 else [a, b]
        rows = self._run((f, people(f)) for f in range(40))
        for f, tid, verified, cx, disc in rows:
            if verified:
                self.assertAlmostEqual(cx, 300 + 20 * f, delta=10, msg=f"khung {f}: pose tươi thuộc người sai")
        self.assertTrue(all(r[2] for r in rows[16:]))

    def test_k_exact_overlap_is_ambiguous_and_abstains(self):
        """Hai người trùng khít (cùng tư thế, cùng hộp) trong 1 khung giữa lúc cắt nhau: khung đó phải "chưa xác minh"."""
        rows = self._run((f, [(300 + 20 * f, 500, 101), (700 - 20 * f, 500, 100)]) for f in range(30))
        overlap = next(r for r in rows if r[0] == 10)    # A=500, B=500
        self.assertFalse(overlap[2])
        for f, tid, verified, cx, disc in rows:
            if verified:
                self.assertAlmostEqual(cx, 300 + 20 * f, delta=10, msg=f"khung {f}: pose tươi thuộc người sai")

    def test_l_duplicate_box_of_same_person_is_not_a_competitor(self):
        """YOLO trả thêm hộp kéo dài cho CÙNG một người (vai trùng khớp): không được coi là mơ hồ / người thứ hai."""
        for f in range(30):
            person = (500 + f, 500, 100)
            ghost_box = create_person_box(*person)
            ghost_box[3] += 120
            res = make_yolo_result([create_person_box(*person), ghost_box],
                                   [create_person_kps(*person), create_person_kps(*person, conf=0.8)])
            self.tracker.update(res, frame_idx=f, img_w=1000, img_h=1000)
            self.assertEqual(self.tracker.target.track_id, 1)
            self.assertEqual(self.tracker.target.missing_frames, 0, msg=f"khung {f}")

    def test_m_small_distant_person_cannot_replace_a_lost_target(self):
        """Mục tiêu rụng; chỉ còn người ở xa (nhỏ ~1/6) ngay vị trí cũ: loại bằng cổng kích thước, không nhận."""
        frames = [(f, [(450, 500, 101), (800, 300, 100)] if f < 10 else [(800, 300, 100), (450, 500, 17)]) for f in range(30)]
        rows = self._run(frames)
        self.assertTrue(all(not r[2] for r in rows[10:]))

    def test_n_scene_cut_restarts_instead_of_guessing_by_old_position(self):
        """Ba người cùng đổi chỗ trong 1 khung (cắt cảnh): bắt đầu lại, track mới, discontinuity."""
        before = [(300, 500, 101), (600, 500, 90), (850, 450, 80)]
        after = [(120, 560, 101), (410, 540, 90), (700, 380, 80)]
        rows = self._run([(f, before) for f in range(10)] + [(10, after), (11, after)])
        self.assertEqual(rows[9][1], 1)
        self.assertEqual(rows[10][1], 2)
        self.assertTrue(rows[10][4])
        self.assertTrue(rows[11][2])

    def test_o_motion_gate_scales_with_frame_rate(self):
        """Cùng một cú dịch 0.9 chiều dài thân trong 1 khung (có người khác đã biết trong cảnh): quá cổng ở 60 fps
        (chưa xác minh, không đoán), nhưng là chuyển động bình thường ở 24 fps (cổng nở x2.5)."""
        def frames():
            for f in range(14):
                a_x = 450 if f < 10 else 540
                yield f, [(a_x, 500, 100), (900, 500, 100)]
        fast = PersonTracker(max_missing_frames=15, max_landmark_jump=0.14, fps=60.0)
        slow = PersonTracker(max_missing_frames=15, max_landmark_jump=0.14, fps=24.0)
        for tracker, expect_verified in ((fast, False), (slow, True)):
            for f, people in frames():
                tracker.update(frame_of(people), frame_idx=f, img_w=1000, img_h=1000)
                if f == 10:
                    self.assertEqual(tracker.target.missing_frames == 0, expect_verified, msg=f"fps={tracker.fps}")
                    self.assertEqual(tracker.target.track_id, 1)

    def test_p_sole_person_survives_zoom_and_jump(self):
        """Chỉ một người trong cảnh (không ai để nhầm): đổi zoom 3x + nhảy vị trí trong 1 khung vẫn là mục tiêu cũ,
        có báo discontinuity để hạ nguồn reset vi phân (không rơi vào trạng thái mất dấu vĩnh viễn)."""
        rows = self._run([(f, [(300, 500, 100)]) for f in range(10)] + [(f, [(620, 520, 300)]) for f in range(10, 20)])
        self.assertTrue(rows[10][2] and rows[10][4])
        self.assertTrue(all(r[1] == 1 and r[2] for r in rows))


if __name__ == "__main__":
    unittest.main()
