import unittest

from pose_math import Point, EMAState, apply_ema, detect_active_leg
from kick_analyzer import KickAnalyzer, KickState
from punch_analyzer import SingleArmTracker, PunchState


class TestPoseObservation(unittest.TestCase):
    def test_reappearing_joint_does_not_inherit_occluded_coordinates(self):
        state = EMAState()
        apply_ema(Point(.4, .8), state)
        apply_ema(Point(0, 0, .01), state)
        self.assertEqual(apply_ema(Point(.6, .5), state), Point(.6, .5))

    def test_chamber_below_hip_with_occluded_support_leg(self):
        pose = [Point(0, 0, 0) for _ in range(17)]
        pose[5], pose[11] = Point(.5, .2), Point(.5, .5)
        pose[13], pose[15] = Point(.7, .52), Point(.65, .7)
        self.assertEqual(detect_active_leg(pose), "left")

    def test_ground_pose_does_not_start_chamber(self):
        pose = [Point(0, 0, 0) for _ in range(17)]
        pose[5], pose[11] = Point(.2, .5), Point(.5, .5)
        pose[13], pose[15] = Point(.7, .52), Point(.65, .7)
        self.assertEqual(detect_active_leg(pose), "none")

    def test_invalid_joint_does_not_generate_reacquisition_speed(self):
        a = KickAnalyzer()
        a.update(60, 100, Point(.2, .2), time_ms=0)
        a.update(None, None, Point(0, 0, .01), time_ms=40, landmarks_valid=False)
        a.update(90, 100, Point(.8, .8), time_ms=80)
        self.assertEqual(a.state, KickState.CHAMBERING)
        self.assertEqual(a.peak_speed, 0)

    def test_leg_switch_cannot_complete_previous_leg_cycle(self):
        a = KickAnalyzer()
        a.update(60, 100, Point(.2, .2), time_ms=0, active_leg="left")
        a.update(100, 100, Point(.5, .2), time_ms=40, active_leg="left")
        a.update(70, 100, Point(.9, .2), time_ms=80, active_leg="right")
        self.assertEqual(a.results, [])
        self.assertEqual(a.state, KickState.CHAMBERING)

    def test_discontinuity_discards_motion_but_keeps_finished_results(self):
        a = KickAnalyzer()
        a.update(60, 100, Point(.2, .2), time_ms=0)
        a.reset_motion()
        a.update(100, 100, Point(.9, .2), time_ms=40)
        self.assertEqual(a.state, KickState.CHAMBERING)
        self.assertEqual(a.peak_speed, 0)

    def test_preferred_leg_stays_locked_during_occlusion(self):
        pose = [Point(0, 0, 0) for _ in range(17)]
        pose[11], pose[15] = Point(.5, .5), Point(.7, .2)
        self.assertEqual(detect_active_leg(pose, preferred_leg="right"), "right")

    def test_late_punch_retraction_is_not_accepted(self):
        a = SingleArmTracker("right")
        a.state = PunchState.RETRACTING
        a.start_time_ms, a.start_reach, a.impact_reach = 0, .1, .4
        result = a.update(Point(.5, .3), Point(.6, .4), Point(.55, .3),
                          Point(.3, .3), Point(.3, .3), 50, 2000)
        self.assertIsNone(result)
        self.assertEqual(a.state, PunchState.GUARD)

    def test_punch_confidence_gap_cannot_launch_on_reacquisition(self):
        a = SingleArmTracker("right")
        a.prev_reach, a.prev_wrist = .05, Point(.5, .3)
        a.update(Point(.5, .3), Point(.6, .4), Point(0, 0, .01),
                 Point(.3, .3), Point(.3, .3), 1, 40)
        a.update(Point(.5, .3), Point(.6, .4), Point(.8, .3),
                 Point(.3, .3), Point(.3, .3), 2, 80)
        self.assertEqual(a.state, PunchState.GUARD)

    def test_fast_launch_displacement_counts_toward_complete_punch(self):
        a = SingleArmTracker("right")
        shoulder = Point(.4, .3)
        opposite = Point(.3, .3)
        samples = [(0, Point(.5, .4), Point(.45, .32)),
                   (40, Point(.6, .4), Point(.72, .3)),
                   (80, Point(.6, .3), Point(.76, .3)),
                   (120, Point(.6, .4), Point(.6, .35)),
                   (160, Point(.5, .4), Point(.5, .35))]
        results = [a.update(shoulder, elbow, wrist, opposite, opposite, i, t)
                   for i, (t, elbow, wrist) in enumerate(samples)]
        self.assertEqual(sum(result is not None for result in results), 1)

    def test_single_frame_kick_spike_cannot_score(self):
        a = KickAnalyzer()
        a.update(60, 100, Point(.2, .2), time_ms=0)
        a.update(150, 100, Point(.5, .2), time_ms=16.7)
        a.update(90, 100, Point(.2, .2), time_ms=33.4)
        self.assertEqual(a.results, [])
