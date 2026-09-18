"""
test_shadow_kick_classifier.py — Unit & Boundary Tests for Task 16 Kick Shadow Classifier
"""

import json
import unittest

from pipeline.contracts import EvidenceLevel
from pipeline.shadow_classifier import DecisionStatus
from pipeline.shadow_kick_classifier import (
    ShadowKickClassifier,
    VALIDATION_STATUS_NOT_VALIDATED,
)
from pipeline.stance_context import resolve_stance_context


class TestShadowKickClassifier(unittest.TestCase):

    def setUp(self):
        self.classifier = ShadowKickClassifier()
        self.orthodox_context = resolve_stance_context(coach_stance="orthodox")
        self.southpaw_context = resolve_stance_context(coach_stance="southpaw")

    def test_front_kick_lead_and_rear(self):
        # Lead front kick in orthodox (left leg)
        feat_lead = {
            "attacking_side": "left",
            "hip_rotation_angle": 15.0,
            "forward_trajectory_linearity": 0.88,
            "has_chamber_phase": True,
            "has_extension_phase": True,
        }
        dec_lead = self.classifier.classify(feat_lead, self.orthodox_context)
        self.assertEqual(dec_lead.status, DecisionStatus.CLASSIFIED)
        self.assertIsNotNone(dec_lead.candidate)
        self.assertEqual(dec_lead.candidate.technique, "front_kick")
        self.assertEqual(dec_lead.candidate.limb_role, "lead")
        self.assertEqual(dec_lead.validation_status, VALIDATION_STATUS_NOT_VALIDATED)

        # Rear front kick in orthodox (right leg)
        feat_rear = {
            "attacking_side": "right",
            "hip_rotation_angle": 20.0,
            "forward_trajectory_linearity": 0.85,
            "has_chamber_phase": True,
            "has_extension_phase": True,
        }
        dec_rear = self.classifier.classify(feat_rear, self.orthodox_context)
        self.assertEqual(dec_rear.candidate.technique, "front_kick")
        self.assertEqual(dec_rear.candidate.limb_role, "rear")

    def test_roundhouse_kick_classification(self):
        feat_round = {
            "attacking_side": "right",
            "hip_rotation_angle": 45.0,  # > 35 deg
            "forward_trajectory_linearity": 0.50,
            "arc_curvature": 0.35,
            "has_chamber_phase": True,
            "has_extension_phase": True,
        }
        dec = self.classifier.classify(feat_round, self.orthodox_context)
        self.assertEqual(dec.status, DecisionStatus.CLASSIFIED)
        self.assertEqual(dec.candidate.technique, "round_kick")
        self.assertEqual(dec.candidate.limb_role, "rear")

    def test_side_kick_classification(self):
        feat_side = {
            "attacking_side": "left",
            "hip_rotation_angle": 28.0,
            "forward_trajectory_linearity": 0.40,
            "lateral_displacement_ratio": 0.78,  # > 0.65
            "torso_lean_angle": 32.0,            # > 25.0
            "has_chamber_phase": True,
            "has_extension_phase": True,
        }
        dec = self.classifier.classify(feat_side, self.orthodox_context)
        self.assertEqual(dec.status, DecisionStatus.CLASSIFIED)
        self.assertEqual(dec.candidate.technique, "side_kick")
        self.assertEqual(dec.candidate.limb_role, "lead")

    def test_camera_view_unsuitable_abstains(self):
        feat = {
            "attacking_side": "left",
            "hip_rotation_angle": 15.0,
            "forward_trajectory_linearity": 0.88,
            "is_camera_view_unsuitable": True,
        }
        dec = self.classifier.classify(feat, self.orthodox_context)
        self.assertEqual(dec.status, DecisionStatus.ABSTAINED)
        self.assertIn("CAMERA_VIEW_UNSUITABLE_FOR_KICK_PLANE", dec.reason_codes)

    def test_ankle_occlusion_abstains(self):
        feat = {
            "attacking_side": "left",
            "hip_rotation_angle": 15.0,
            "forward_trajectory_linearity": 0.88,
            "is_ankle_occluded": True,
        }
        dec = self.classifier.classify(feat, self.orthodox_context)
        self.assertEqual(dec.status, DecisionStatus.ABSTAINED)
        self.assertIn("ANKLE_TRAJECTORY_OCCLUDED", dec.reason_codes)

    def test_missing_kick_phases_abstains(self):
        feat = {
            "attacking_side": "left",
            "hip_rotation_angle": 15.0,
            "forward_trajectory_linearity": 0.88,
            "has_chamber_phase": False,  # Missing chamber
            "has_extension_phase": True,
        }
        dec = self.classifier.classify(feat, self.orthodox_context)
        self.assertEqual(dec.status, DecisionStatus.ABSTAINED)
        self.assertIn("MISSING_KICK_PHASES", dec.reason_codes)

    def test_ambiguous_kick_trajectory_abstains(self):
        feat = {
            "attacking_side": "right",
            "hip_rotation_angle": 32.0,  # Between front (<=30) and round (>=35)
            "forward_trajectory_linearity": 0.60,  # Below front (0.75)
            "lateral_displacement_ratio": 0.30,   # Below side (0.65)
            "has_chamber_phase": True,
            "has_extension_phase": True,
        }
        dec = self.classifier.classify(feat, self.orthodox_context)
        self.assertEqual(dec.status, DecisionStatus.ABSTAINED)
        self.assertIn("AMBIGUOUS_KICK_TRAJECTORY", dec.reason_codes)

    def test_json_safe_dict(self):
        feat = {
            "attacking_side": "left",
            "hip_rotation_angle": 15.0,
            "forward_trajectory_linearity": 0.88,
            "has_chamber_phase": True,
            "has_extension_phase": True,
        }
        dec = self.classifier.classify(feat, self.orthodox_context)
        d = dec.to_dict()
        serialized = json.dumps(d)
        deserialized = json.loads(serialized)
        self.assertEqual(deserialized["candidate"]["technique"], "front_kick")
        self.assertEqual(deserialized["validationStatus"], VALIDATION_STATUS_NOT_VALIDATED)


if __name__ == "__main__":
    unittest.main()

