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
    # Task 9 Quality Gate
    "QualityStatus",
    "QualityReasonCode",
    "QualityMetricsSnapshot",
    "AnalysisQuality",
    "QualityGateConfig",
    "QualityGateEvaluator",
    "evaluate_video_quality",
    # Task 10 Finding Engine
    "FindingScope",
    "FindingSeverity",
    "FindingErrorCode",
    "EvidenceReference",
    "RubricProvenance",
    "StandardFinding",
    "FindingEngine",
    # Task 11 Session Aggregation
    "SessionCoverageSummary",
    "PriorityFindingSummary",
    "SessionInsights",
    "SessionAggregationEngine",
    # Task 12 Coaching Engine
    "CoachingDrill",
    "CoachingRecommendation",
    "SessionCoachingPlan",
    "CoachingEngine",
    "APPROVED_DRILL_CATALOG",
    # Task 13 Review Contract
    "ReviewAction",
    "TargetField",
    "ReviewerRole",
    "ReviewAuditRecord",
    "MaterializedActionView",
    "ReviewStateMachine",
    # Task 14 Dataset Export
    "DatasetSplit",
    "ExportApprovalPolicy",
    "AnonymizedSample",
    "DatasetManifest",
    "DatasetExportResult",
    "DatasetExportEngine",
    # Task 15 & 16 Shadow Classifiers
    "MultiPunchClassifierConfig",
    "ExtendedClassificationDecision",
    "ShadowMultiPunchClassifier",
    "ShadowKickClassifierConfig",
    "ShadowKickClassifier",
    "VALIDATION_STATUS_NOT_VALIDATED",
]

# Lazy imports for Task 9-16
from pipeline.quality_gate import (
    QualityStatus,
    QualityReasonCode,
    QualityMetricsSnapshot,
    AnalysisQuality,
    QualityGateConfig,
    QualityGateEvaluator,
    evaluate_video_quality,
)
from pipeline.finding_engine import (
    FindingScope,
    FindingSeverity,
    FindingErrorCode,
    EvidenceReference,
    RubricProvenance,
    StandardFinding,
    FindingEngine,
)
from pipeline.session_aggregation import (
    SessionCoverageSummary,
    PriorityFindingSummary,
    SessionInsights,
    SessionAggregationEngine,
)
from pipeline.coaching_engine import (
    CoachingDrill,
    CoachingRecommendation,
    SessionCoachingPlan,
    CoachingEngine,
    APPROVED_DRILL_CATALOG,
)
from pipeline.review_contract import (
    ReviewAction,
    TargetField,
    ReviewerRole,
    ReviewAuditRecord,
    MaterializedActionView,
    ReviewStateMachine,
)
from pipeline.dataset_export import (
    DatasetSplit,
    ExportApprovalPolicy,
    AnonymizedSample,
    DatasetManifest,
    DatasetExportResult,
    DatasetExportEngine,
)
from pipeline.shadow_punch_classifier import (
    MultiPunchClassifierConfig,
    ExtendedClassificationDecision,
    ShadowMultiPunchClassifier,
    VALIDATION_STATUS_NOT_VALIDATED,
)
from pipeline.shadow_kick_classifier import (
    ShadowKickClassifierConfig,
    ShadowKickClassifier,
)

