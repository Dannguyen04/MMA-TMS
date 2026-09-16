"""
pipeline package — MMA-TMS Video Analysis Pipeline Architecture (Task 2)
"""

from pipeline.contracts import (
    PoseObservation,
    ObservationKind,
    FrameContext,
    UpperBodyFrameFeatures,
    LowerBodyFrameFeatures,
    FrameAnalysisResult,
    LEGACY_ELBOW_DISPLAY_FALLBACK_DEG,
)
from pipeline.feature_extraction import (
    extract_lower_body_features,
    extract_upper_body_features,
)
from pipeline.action_pipeline import (
    ActionPipeline,
)
from pipeline.stance_context import (
    StanceType,
    StanceSource,
    VALID_STANCES,
    StanceContext,
    normalize_stance,
    normalize_attacking_side,
    resolve_limb_role,
    resolve_stance_context,
)
from pipeline.classification import (
    ClassifiedTechnique,
    classify_punch,
    classify_kick,
)
from pipeline.analysis_context import (
    MartialArt,
    TrainingMode,
    CameraView,
    TargetType,
    SkillLevel,
    AnalysisContext,
    normalize_martial_art,
    normalize_training_mode,
    normalize_camera_view,
    normalize_target_type,
    normalize_skill_level,
    normalize_expected_techniques,
    normalize_requested_rubric_version,
)
from rubric_primitives import parse_semver
from pipeline.rubric_registry import (
    RubricSelectionStatus,
    RubricSelectionResult,
    RubricRegistry,
    create_default_rubric_registry,
    get_default_rubric_registry,
)
from pipeline.contracts import (
    PoseObservation,
    ObservationKind,
    EvidenceLevel,
    FrameContext,
    UpperBodyFrameFeatures,
    LowerBodyFrameFeatures,
    FrameAnalysisResult,
    LEGACY_ELBOW_DISPLAY_FALLBACK_DEG,
)
from pipeline.assessment_engine import (
    AssessmentStatus,
    AssessmentMetricItem,
    AssessmentProvenance,
    AssessmentResult,
    AssessmentEngine,
    evaluate_action,
    get_default_assessment_engine,
)
from pipeline.temporal_phases import (
    PhaseEvidence,
    PhaseBoundary,
    TemporalPhaseSequence,
    TemporalPhaseConfig,
    PhaseValidityConfig,
    calculate_tolerance_ms,
    extract_temporal_phases,
    segment_from_action_result,
    segment_punch_phases,
    segment_kick_phases,
)
from pipeline.kinematic_features import (
    KinematicMetricContract,
    KinematicFeatureSet,
    extract_kinematic_features,
)
from pipeline.shadow_classifier import (
    DecisionStatus,
    TechniqueCandidate,
    ClassifierProvenance,
    ShadowClassifierConfig,
    ClassificationDecision,
    ShadowClassifier,
    classify_shadow_punch,
)

__all__ = [
    "PoseObservation",
    "ObservationKind",
    "EvidenceLevel",
    "FrameContext",
    "UpperBodyFrameFeatures",
    "LowerBodyFrameFeatures",
    "FrameAnalysisResult",
    "LEGACY_ELBOW_DISPLAY_FALLBACK_DEG",
    "extract_lower_body_features",
    "extract_upper_body_features",
    "ActionPipeline",
    "StanceType",
    "StanceSource",
    "VALID_STANCES",
    "StanceContext",
    "normalize_stance",
    "normalize_attacking_side",
    "resolve_limb_role",
    "resolve_stance_context",
    "ClassifiedTechnique",
    "classify_punch",
    "classify_kick",
    "MartialArt",
    "TrainingMode",
    "CameraView",
    "TargetType",
    "SkillLevel",
    "AnalysisContext",
    "normalize_martial_art",
    "normalize_training_mode",
    "normalize_camera_view",
    "normalize_target_type",
    "normalize_skill_level",
    "normalize_expected_techniques",
    "normalize_requested_rubric_version",
    "RubricSelectionStatus",
    "RubricSelectionResult",
    "RubricRegistry",
    "parse_semver",
    "create_default_rubric_registry",
    "get_default_rubric_registry",
    # Task 5 Assessment Engine
    "AssessmentStatus",
    "AssessmentMetricItem",
    "AssessmentProvenance",
    "AssessmentResult",
    "AssessmentEngine",
    "evaluate_action",
    "get_default_assessment_engine",
    # Task 6 Temporal Phases
    "PhaseEvidence",
    "PhaseBoundary",
    "TemporalPhaseSequence",
    "TemporalPhaseConfig",
    "PhaseValidityConfig",
    "calculate_tolerance_ms",
    "extract_temporal_phases",
    "segment_from_action_result",
    "segment_punch_phases",
    "segment_kick_phases",
    # Task 7 Kinematic Features
    "KinematicMetricContract",
    "KinematicFeatureSet",
    "extract_kinematic_features",
    # Task 8 Shadow Classifier
    "DecisionStatus",
    "TechniqueCandidate",
    "ClassifierProvenance",
    "ShadowClassifierConfig",
    "ClassificationDecision",
    "ShadowClassifier",
    "classify_shadow_punch",
]

