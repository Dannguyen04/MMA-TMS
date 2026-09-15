import unittest
from unittest.mock import patch, mock_open
from pathlib import Path

from strike_benchmark import AnnotationError, Event, evaluate_events, evaluate_files, load_ground_truth, load_predictions, parse_ground_truth


def event(event_id, kind, frame, side="right", technique="unknown", scope="in_scope"):
    return Event(event_id, kind, technique, side, frame, None, scope)


class TestStrikeBenchmark(unittest.TestCase):
    def test_minimum_error_one_to_one_matching(self):
        gt = [event("g1", "kick", 10), event("g2", "kick", 20)]
        pred = [event("p1", "kick", 19), event("p2", "kick", 11)]
        result = evaluate_events(gt, pred, fps=10, tolerance_ms=250)
        self.assertEqual((result["tp"], result["fp"], result["fn"]), (2, 0, 0))
        self.assertEqual(result["f1"], 1.0)

    def test_duplicate_prediction_becomes_false_positive(self):
        result = evaluate_events(
            [event("g1", "punch", 10)],
            [event("p1", "punch", 10), event("p2", "punch", 11)],
            fps=10,
            tolerance_ms=150,
        )
        self.assertEqual((result["tp"], result["fp"], result["fn"]), (1, 1, 0))

    def test_kind_and_known_side_must_match(self):
        gt = [event("g1", "kick", 10, "left")]
        pred = [event("p1", "punch", 10, "left"), event("p2", "kick", 10, "right")]
        result = evaluate_events(gt, pred, fps=30)
        self.assertEqual((result["tp"], result["fp"], result["fn"]), (0, 2, 1))

    def test_unknown_side_does_not_block_match(self):
        result = evaluate_events([event("g1", "kick", 10, "unknown")], [event("p1", "kick", 10, "left")], fps=30)
        self.assertEqual(result["tp"], 1)

    def test_out_of_scope_ground_truth_is_not_a_false_negative(self):
        result = evaluate_events([event("g1", "kick", 10, scope="out_of_scope")], [], fps=30)
        self.assertEqual((result["tp"], result["fp"], result["fn"]), (0, 0, 0))
        self.assertEqual(result["f1"], 1.0)

    def test_schema_rejects_duplicate_ids(self):
        document = {"video": {"video_id": "v", "fps": 30}, "events": [
            {"event_id": "e", "strike_kind": "kick", "side": "left", "impact_frame": 1},
            {"event_id": "e", "strike_kind": "kick", "side": "right", "impact_frame": 2},
        ]}
        with self.assertRaises(AnnotationError):
            parse_ground_truth(document)

    def test_repository_positive_kick_annotation_is_valid(self):
        _, events = load_ground_truth(Path(__file__).parent / "ground_truth/gt_kick_005_mixed_heavybag.json")
        self.assertEqual(len(events), 5)
        self.assertTrue(all(item.strike_kind == "kick" for item in events))

    def test_closest_pair_must_not_reduce_match_count(self):
        result = evaluate_events(
            [event("g1", "kick", 10), event("g2", "kick", 14)],
            [event("p1", "kick", 11), event("p2", "kick", 8)],
            fps=10, tolerance_ms=300)
        self.assertEqual((result["tp"], result["fp"], result["fn"]), (2, 0, 0))

    def test_invalid_frame_rejected(self):
        for frame in [-1, 1.5, float("nan")]:
            with self.assertRaises(AnnotationError):
                parse_ground_truth({"video": {"video_id": "v"}, "events": [
                    {"strike_kind": "kick", "impact_frame": frame}]})

    def test_kick_only_annotation_does_not_mark_unannotated_punch_as_false_positive(self):
        document = {"video": {"video_id": "v", "fps": 25}, "evaluated_kinds": ["kick"]}
        with patch("strike_benchmark.load_ground_truth", return_value=(document, [event("g", "kick", 25)])), \
             patch("strike_benchmark.load_predictions", return_value=({}, [event("p1", "punch", 25), event("p2", "kick", 25)])):
            result = evaluate_files("gt.json", "pred.json")
            self.assertEqual((result["tp"], result["fp"], result["fn"]), (1, 0, 0))

    def test_matching_minimizes_total_error_for_equal_cardinality(self):
        result = evaluate_events([event("g1", "kick", 10), event("g2", "kick", 20)],
                                 [event("p1", "kick", 11), event("p2", "kick", 18)],
                                 fps=10, tolerance_ms=2000)
        self.assertEqual(sum(m["impact_error_ms"] for m in result["matches"]), 300)

    def test_unrelated_invalid_legacy_kick_does_not_break_punch_evaluation(self):
        payload = '{"punches":[{"punchType":"Jab","impactFrame":25}],"kicks":[{"activeLeg":"none","impactFrame":25}]}'
        with patch("builtins.open", mock_open(read_data=payload)):
            _, events = load_predictions("legacy.json", kinds={"punch"})
        self.assertEqual([event.strike_kind for event in events], ["punch"])


if __name__ == "__main__":
    unittest.main()
