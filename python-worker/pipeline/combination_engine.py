"""
combination_engine.py — Combination & Action-Sequence Engine (Task 23)

Provides:
- Deterministic temporal grouping of canonical ActionResult detections into martial arts strike sequences.
- Classification into SequenceCandidateType:
  * SINGLE
  * REPEATED_STRIKE
  * TWO_ACTION_COMBINATION
  * MULTI_ACTION_COMBINATION
  * UNKNOWN
- Invariants:
  * Pure function; never mutates original action inputs.
  * Consumes canonical ActionResult contracts (supporting camelCase phase/confidence dictionaries).
  * Rejects missing or malformed phases; never defaults frame indices to zero or confidence to 0.8.
  * Emits ValidationStatus.NOT_VALIDATED (Implementation-Tested, awaiting ground-truth benchmark).
  * Preserves full provenance and gap durations with camelCase public serialization.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import (
    SequenceCandidateType,
    ValidationStatus,
    deep_freeze,
    to_json_safe,
)


@dataclass(frozen=True)
class SequenceActionRef:
    action_id: str
    technique: str
    start_frame: int
    end_frame: int
    confidence: Optional[float]

    def to_dict(self) -> dict[str, Any]:
        return {
            "actionId": self.action_id,
            "technique": self.technique,
            "startFrame": self.start_frame,
            "endFrame": self.end_frame,
            "confidence": round(self.confidence, 4) if self.confidence is not None else None,
        }


@dataclass(frozen=True)
class ActionSequence:
    sequence_id: str
    candidate_type: SequenceCandidateType
    actions: tuple[SequenceActionRef, ...]
    gap_durations_sec: tuple[float, ...]
    total_duration_sec: float
    confidence: Optional[float]
    validation_status: ValidationStatus = ValidationStatus.NOT_VALIDATED

    def to_dict(self) -> dict[str, Any]:
        return {
            "sequenceId": self.sequence_id,
            "candidateType": self.candidate_type.value,
            "actions": [a.to_dict() for a in self.actions],
            "gapDurationsSec": [round(g, 4) for g in self.gap_durations_sec],
            "totalDurationSec": round(self.total_duration_sec, 4),
            "confidence": round(self.confidence, 4) if self.confidence is not None else None,
            "validationStatus": self.validation_status.value,
        }


def _extract_action_phases(act: Mapping[str, Any]) -> tuple[Optional[int], Optional[int]]:
    """Extracts start_frame and end_frame robustly from camelCase or snake_case ActionResult dicts."""
    phases = act.get("phases")
    if isinstance(phases, dict):
        s = phases.get("startFrame") if phases.get("startFrame") is not None else phases.get("start_frame")
        e = phases.get("endFrame") if phases.get("endFrame") is not None else phases.get("end_frame")
        if isinstance(s, int) and isinstance(e, int) and s <= e:
            return (s, e)

    # Fallback to top-level
    s = act.get("startFrame") if act.get("startFrame") is not None else act.get("start_frame")
    e = act.get("endFrame") if act.get("endFrame") is not None else act.get("end_frame")
    if isinstance(s, int) and isinstance(e, int) and s <= e:
        return (s, e)

    return (None, None)


def _extract_action_confidence(act: Mapping[str, Any]) -> Optional[float]:
    """Extracts confidence score from 3D confidence dict or numeric field without inventing defaults."""
    conf_obj = act.get("confidence")
    if isinstance(conf_obj, dict):
        val = conf_obj.get("assessment")
        if val is None:
            val = conf_obj.get("detection")
        if val is None:
            val = conf_obj.get("classification")
        if isinstance(val, (int, float)):
            return float(val)
        return None
    if isinstance(conf_obj, (int, float)):
        return float(conf_obj)
    return None


class CombinationEngine:
    """Groups ordered canonical action detections into coherent martial arts combinations."""

    def __init__(self, max_gap_sec: float = 0.65, fps: float = 30.0):
        self.max_gap_sec = float(max_gap_sec)
        self.fps = float(fps) if fps > 0 else 30.0

    def extract_sequences(
        self,
        actions: Sequence[Mapping[str, Any]],
    ) -> list[ActionSequence]:
        if not actions:
            return []

        # Parse and filter valid actions with valid phases
        valid_parsed_actions = []
        for i, act in enumerate(actions):
            s_frame, e_frame = _extract_action_phases(act)
            if s_frame is None or e_frame is None:
                continue  # Reject actions with missing/malformed phases

            act_id = str(act.get("id") or act.get("actionId") or f"act_{i}")
            tech = str(act.get("technique") or "unknown")
            conf_val = _extract_action_confidence(act)

            valid_parsed_actions.append(
                {
                    "action_id": act_id,
                    "technique": tech,
                    "start_frame": s_frame,
                    "end_frame": e_frame,
                    "confidence": conf_val,
                }
            )

        if not valid_parsed_actions:
            return []

        # Sort actions strictly by start_frame, then end_frame, then action_id (deterministic tie-breaker)
        sorted_actions = sorted(
            valid_parsed_actions,
            key=lambda a: (a["start_frame"], a["end_frame"], a["action_id"]),
        )

        groups: list[list[dict[str, Any]]] = []
        current_group: list[dict[str, Any]] = []

        for act in sorted_actions:
            if not current_group:
                current_group.append(act)
                continue

            prev_act = current_group[-1]
            prev_end = prev_act["end_frame"]
            curr_start = act["start_frame"]

            # Compute gap
            gap_frames = curr_start - prev_end
            gap_sec = gap_frames / self.fps

            # If gap is negative (significant overlap conflict) or exceeds max_gap_sec: split
            if 0.0 <= gap_sec <= self.max_gap_sec and act["technique"] != "unknown" and prev_act["technique"] != "unknown":
                current_group.append(act)
            else:
                groups.append(current_group)
                current_group = [act]

        if current_group:
            groups.append(current_group)

        # Build ActionSequence objects
        sequences: list[ActionSequence] = []
        for grp in groups:
            action_refs: list[SequenceActionRef] = []
            gaps: list[float] = []

            for i, act in enumerate(grp):
                action_refs.append(
                    SequenceActionRef(
                        action_id=act["action_id"],
                        technique=act["technique"],
                        start_frame=act["start_frame"],
                        end_frame=act["end_frame"],
                        confidence=act["confidence"],
                    )
                )

                if i > 0:
                    prev_e = action_refs[i - 1].end_frame
                    gaps.append(max(0.0, (act["start_frame"] - prev_e) / self.fps))

            # Determine candidate type
            n_acts = len(action_refs)
            has_unknown = any(a.technique == "unknown" for a in action_refs)
            if has_unknown:
                cand_type = SequenceCandidateType.UNKNOWN
            elif n_acts == 1:
                cand_type = SequenceCandidateType.SINGLE
            elif n_acts == 2:
                if action_refs[0].technique == action_refs[1].technique:
                    cand_type = SequenceCandidateType.REPEATED_STRIKE
                else:
                    cand_type = SequenceCandidateType.TWO_ACTION_COMBINATION
            else:
                techniques = {a.technique for a in action_refs}
                if len(techniques) == 1:
                    cand_type = SequenceCandidateType.REPEATED_STRIKE
                else:
                    cand_type = SequenceCandidateType.MULTI_ACTION_COMBINATION

            start_t = action_refs[0].start_frame / self.fps
            end_t = action_refs[-1].end_frame / self.fps
            total_duration = max(0.0, end_t - start_t)

            valid_confs = [a.confidence for a in action_refs if a.confidence is not None]
            mean_conf = sum(valid_confs) / len(valid_confs) if valid_confs else None

            token = ":".join(a.action_id for a in action_refs)
            seq_id = f"seq_{hashlib.sha256(token.encode('utf-8')).hexdigest()[:16]}"

            sequences.append(
                ActionSequence(
                    sequence_id=seq_id,
                    candidate_type=cand_type,
                    actions=tuple(action_refs),
                    gap_durations_sec=tuple(gaps),
                    total_duration_sec=total_duration,
                    confidence=mean_conf,
                    validation_status=ValidationStatus.NOT_VALIDATED,
                )
            )

        return sequences
