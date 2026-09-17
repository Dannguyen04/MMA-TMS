"""
test_shadow_punch_expansion.py — Unit & Boundary Tests for Task 15 Hook & Uppercut Shadow Classifier
"""

import json
import unittest

from pipeline.contracts import EvidenceLevel
from pipeline.shadow_classifier import DecisionStatus
from pipeline.shadow_punch_classifier import (
    ShadowMultiPunchClassifier,
    VALIDATION_STATUS_NOT_VALIDATED,
)
from pipeline.stance_context import resolve_stance_context


class TestShadowPunchExpansion(unittest.TestCase):

    def setUp(self):
        self.classifier = ShadowMultiPunchClassifier()
        self.orthodox_context = resolve_stance_context(coach_stance="orthodox")
        self.southpaw_context = resolve_stance_context(coach_stance="southpaw")

    def test_lead_hook_orthodox(self):
        features = {
            "attacking_side": "left",
            "max_elbow_angle": 105.0,
            "trajectory_directness": 0.68,
            "tangential_curvature": 0.35,
            "vertical_lift": 0.02,
            "wrist_shoulder_separation_ratio": 0.75,
        }
        dec = self.classifier.classify(features, self.orthodox_context)
        self.assertEqual(dec.status, DecisionStatus.CLASSIFIED)
        self.assertIsNotNone(dec.candidate)
        self.assertEqual(dec.candidate.technique, "hook")
        self.assertEqual(dec.candidate.attacking_side, "left")
        self.assertEqual(dec.candidate.limb_role, "lead")
        self.assertEqual(dec.candidate.stance, "orthodox")
        self.assertEqual(dec.validation_status, VALIDATION_STATUS_NOT_VALIDATED)

    def test_rear_hook_orthodox(self):
        features = {
            "attacking_side": "right",
            "max_elbow_angle": 110.0,
            "trajectory_directness": 0.65,
            "tangential_curvature": 0.32,
            "vertical_lift": 0.01,
            "wrist_shoulder_separation_ratio": 0.80,
        }
        dec = self.classifier.classify(features, self.orthodox_context)
        self.assertEqual(dec.status, DecisionStatus.CLASSIFIED)
        self.assertEqual(dec.candidate.technique, "hook")
        self.assertEqual(dec.candidate.attacking_side, "right")
        self.assertEqual(dec.candidate.limb_role, "rear")

    def test_uppercut_classification(self):
        features = {
            "attacking_side": "right",
            "max_elbow_angle": 88.0,
            "trajectory_directness": 0.72,
            "tangential_curvature": 0.18,
            "vertical_lift": 0.22,  # Strong upward displacement
            "wrist_shoulder_separation_ratio": 0.60,
        }
        dec = self.classifier.classify(features, self.orthodox_context)
        self.assertEqual(dec.status, DecisionStatus.CLASSIFIED)
        self.assertEqual(dec.candidate.technique, "uppercut")
        self.assertEqual(dec.candidate.limb_role, "rear")

    def test_straight_punches_jab_cross(self):
        # Lead straight in orthodox -> jab
        feat_lead = {
            "attacking_side": "left",
            "max_elbow_angle": 162.0,
            "trajectory_directness": 0.91,
            "tangential_curvature": 0.08,
            "wrist_shoulder_separation_ratio": 0.85,
        }
        dec_jab = self.classifier.classify(feat_lead, self.orthodox_context)
        self.assertEqual(dec_jab.candidate.technique, "jab")

        # Rear straight in orthodox -> cross
        feat_rear = {
            "attacking_side": "right",
            "max_elbow_angle": 165.0,
            "trajectory_directness": 0.88,
            "tangential_curvature": 0.10,
            "wrist_shoulder_separation_ratio": 0.90,
        }
        dec_cross = self.classifier.classify(feat_rear, self.orthodox_context)
        self.assertEqual(dec_cross.candidate.technique, "cross")

    def test_insufficient_separation_abstains(self):
        # Separation ratio very small (e.g. wrist and shoulder overlapping in head-on camera)
        features = {
            "attacking_side": "left",
            "max_elbow_angle": 105.0,
            "trajectory_directness": 0.68,
            "tangential_curvature": 0.35,
            "wrist_shoulder_separation_ratio": 0.10,  # Below 0.20
        }
        dec = self.classifier.classify(features, self.orthodox_context)
        self.assertEqual(dec.status, DecisionStatus.ABSTAINED)
        self.assertIn("INSUFFICIENT_SEPARATION_OR_VIEW", dec.reason_codes)

    def test_ambiguous_motion_abstains(self):
        # Motion that has low directness, low curvature, weird angle
        features = {
            "attacking_side": "left",
            "max_elbow_angle": 135.0,  # Too straight for hook/uppercut, too bent for straight punch
            "trajectory_directness": 0.50,
            "tangential_curvature": 0.15,
            "vertical_lift": 0.02,
            "wrist_shoulder_separation_ratio": 0.70,
        }
        dec = self.classifier.classify(features, self.orthodox_context)
        self.assertEqual(dec.status, DecisionStatus.ABSTAINED)
        self.assertIn("AMBIGUOUS_MOTION_TRAJECTORY", dec.reason_codes)

    def test_missing_evidence_abstains(self):
        features = {"is_evidence_missing": True}
        dec = self.classifier.classify(features, self.orthodox_context)
        self.assertEqual(dec.status, DecisionStatus.ABSTAINED)
        self.assertIn("INSUFFICIENT_EVIDENCE", dec.reason_codes)

    def test_json_safe_dict(self):
        features = {
            "attacking_side": "left",
            "max_elbow_angle": 105.0,
            "trajectory_directness": 0.68,
            "tangential_curvature": 0.35,
            "wrist_shoulder_separation_ratio": 0.75,
        }
        dec = self.classifier.classify(features, self.orthodox_context)
        d = dec.to_dict()
        serialized = json.dumps(d)
        deserialized = json.loads(serialized)
        self.assertEqual(deserialized["candidate"]["technique"], "hook")
        self.assertEqual(deserialized["validationStatus"], VALIDATION_STATUS_NOT_VALIDATED)


if __name__ == "__main__":
    unittest.main()
