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


if __name__ == "__main__":
    unittest.main()
