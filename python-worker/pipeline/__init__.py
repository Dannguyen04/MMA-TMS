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
    # Tasks 18-31 Advanced AI Modules
    "ValidationStatus",
    "CalibrationStatus",
    "SequenceCandidateType",
    "ShadowEventFamily",
    "ShadowGrapplingState",
    "ActiveLearningReason",
    "BaselineEligibilityStatus",
    "ComparisonStatus",
    "AlignmentStatus",
    "EvaluationMetricResult",
    "EvaluationManifest",
    "MetricGovernanceEngine",
    "AthleteGroupSplitManifest",
    "CalibratedPrediction",
    "TemperatureScalingCalibrator",
    "PlattScalingCalibrator",
    "CalibratorProvenance",
    "ActiveLearningCandidate",
    "ActiveLearningSelector",
    "TrustedConsentPolicy",
    "ModelArtifactManifest",
    "RunManifest",
    "DriftMonitor",
    "ActionSequence",
    "CombinationEngine",
    "ElbowKneeShadowEvent",
    "ElbowKneeShadowClassifier",
    "GrapplingShadowSegment",
    "GrapplingShadowSegmenter",
    "ObservableMovementEvidence",
    "MovementEvidenceEngine",
    "PersonalizedBaseline",
    "BaselineEngine",
    "SessionComparisonDelta",
    "SessionComparator",
    "ReferenceMotionManifest",
    "ReferenceNormalizer",
    "GhostDifferenceExplanation",
    "GhostAlignmentEngine",
    "AdvancedVerticalSliceResult",
    "ReleaseGateReport",
    "ReleaseGateInput",
    "TestSummaryArtifact",
    "ModuleGateArtifact",
    "TrustBoundaryArtifact",
    "REQUIRED_AI_GATE_TASK_IDS",
    "TASK_NAMES",
    "SUPPORTED_GATE_SCHEMA_VERSIONS",
    "ALLOWED_IMPLEMENTATION_STATUSES",
    "ALLOWED_VALIDATION_STATUSES",
    "AdvancedAIOrchestrator",
    "AdvancedAnalysisInput",
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

# Tasks 18-31 Imports
from pipeline.contracts import (
    ValidationStatus,
    CalibrationStatus,
    SequenceCandidateType,
    ShadowEventFamily,
    ShadowGrapplingState,
    ActiveLearningReason,
    BaselineEligibilityStatus,
    ComparisonStatus,
    AlignmentStatus,
)
from pipeline.evaluation_protocol import (
    EvaluationMetricResult,
    EvaluationManifest,
    MetricGovernanceEngine,
    AthleteGroupSplitManifest,
)
from pipeline.confidence_calibration import (
    CalibratedPrediction,
    TemperatureScalingCalibrator,
    PlattScalingCalibrator,
    CalibratorProvenance,
)
from pipeline.active_learning_queue import (
    ActiveLearningCandidate,
    ActiveLearningSelector,
    TrustedConsentPolicy,
)
from pipeline.model_registry import (
    ModelArtifactManifest,
    RunManifest,
    DriftMonitor,
)
from pipeline.combination_engine import (
    ActionSequence,
    CombinationEngine,
)
from pipeline.elbow_knee_shadow import (
    ElbowKneeShadowEvent,
    ElbowKneeShadowClassifier,
)
from pipeline.grappling_shadow import (
    GrapplingShadowSegment,
    GrapplingShadowSegmenter,
)
from pipeline.observable_movement import (
    ObservableMovementEvidence,
    MovementEvidenceEngine,
)
from pipeline.personalized_baseline import (
    PersonalizedBaseline,
    BaselineEngine,
)
from pipeline.session_comparison import (
    SessionComparisonDelta,
    SessionComparator,
)
from pipeline.reference_normalization import (
    ReferenceMotionManifest,
    ReferenceNormalizer,
)
from pipeline.ghost_alignment import (
    GhostDifferenceExplanation,
    GhostAlignmentEngine,
)
from pipeline.vertical_slice_integration import (
    AdvancedVerticalSliceResult,
    ReleaseGateReport,
    ReleaseGateInput,
    TestSummaryArtifact,
    ModuleGateArtifact,
    TrustBoundaryArtifact,
    REQUIRED_AI_GATE_TASK_IDS,
    TASK_NAMES,
    SUPPORTED_GATE_SCHEMA_VERSIONS,
    ALLOWED_IMPLEMENTATION_STATUSES,
    ALLOWED_VALIDATION_STATUSES,
    AdvancedAIOrchestrator,
    AdvancedAnalysisInput,
    is_valid_non_negative_finite_number,
)
from pipeline.mvp_technique_discovery import (
    MVPDiscoveryConfig,
    MVPTechniqueDiscoveryEngine,
)
