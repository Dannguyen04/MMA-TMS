// SQL migrations are authoritative. This file maps public tables for Drizzle queries.
// RLS, grants, trigger functions and migration history are owned by 003, not drizzle-kit.
import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgSchema,
  pgEnum,
  uuid,
  text,
  integer,
  smallint,
  bigint,
  doublePrecision,
  numeric,
  boolean,
  jsonb,
  timestamp,
  date,
  inet,
  check,
  unique,
  primaryKey,
  foreignKey,
  index,
  uniqueIndex,
  type PgTableExtraConfigValue,
} from 'drizzle-orm/pg-core';

export type AlertSeverity = 'medium' | 'high' | 'critical';

/** Trạng thái khớp trong state machine */
export type JointHealthState =
  | 'HEALTHY'
  | 'SUSPECTED'
  | 'SUSPECTED_AVOIDANCE'
  | 'CONFIRMED_IMPAIRMENT';

/** Loại kỹ thuật phân loại chuyển động */
export type MotionClass =
  | 'TACTICAL_FEINT'
  | 'POWER_STRIKE'
  | 'PARTIAL_STRIKE'
  | 'UNKNOWN';

/**
 * AlertPayload — mirror của Python AlertPayload.to_dict()
 * Chỉ xuất hiện khi khớp đạt trạng thái CONFIRMED_IMPAIRMENT.
 */
export interface HealthAlert {
  joint: string; // Vd: "LEFT_SHOULDER"
  state: 'CONFIRMED_IMPAIRMENT'; // Luôn là CONFIRMED_IMPAIRMENT
  severity: AlertSeverity;
  triggerTimeMs: number; // Thời điểm kích hoạt trong video (ms)
  windowStartMs: number; // Bắt đầu cửa sổ quan sát (ms)
  consecutiveLowRom: number; // Số đòn liên tiếp ROM thấp
  avgRomRatio: number; // ROM trung bình trong cửa sổ (0–1)
  motionClass: MotionClass;
  recommendation: string; // Lời khuyên coach/fighter
}

/** Snapshot trạng thái tất cả khớp tại cuối session */
export type JointStatesMap = Record<string, JointHealthState>;

<<<<<<< HEAD
export const jobStatusEnum = pgEnum('job_status', [
  'PENDING',
  'PROCESSING',
  'DONE',
  'FAILED',
]);
export const userRoleEnum = pgEnum('user_role', [
  'FIGHTER',
  'COACH',
  'DOCTOR',
  'ADMIN',
]);
export const weightClassEnum = pgEnum('weight_class', [
  'STRAWWEIGHT',
  'FLYWEIGHT',
  'BANTAMWEIGHT',
  'FEATHERWEIGHT',
  'LIGHTWEIGHT',
  'WELTERWEIGHT',
  'MIDDLEWEIGHT',
  'LIGHT_HEAVYWEIGHT',
  'HEAVYWEIGHT',
]);
export const fighterStanceEnum = pgEnum('fighter_stance', [
  'ORTHODOX',
  'SOUTHPAW',
  'SWITCH',
]);
export const medicalStatusEnum = pgEnum('medical_status', [
  'HEALTHY',
  'MONITORING',
  'RECOVERY',
  'INJURED',
  'NOT_CLEARED',
]);
export const trainingPlanStatusEnum = pgEnum('training_plan_status', [
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]);
export const sessionStatusEnum = pgEnum('session_status', [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
  'CANCELLED',
  'ABANDONED',
]);
export const sessionTypeEnum = pgEnum('session_type', [
  'SHADOW_BOXING',
  'PAD_WORK',
  'HEAVY_BAG',
  'SPARRING',
  'GRAPPLING',
  'STRENGTH_CONDITIONING',
  'RECOVERY',
  'PHYSICAL_THERAPY',
]);
export const exerciseCategoryEnum = pgEnum('exercise_category', [
  'STRIKING',
  'GRAPPLING',
  'STRENGTH_CONDITIONING',
  'RECOVERY',
]);
export const videoStatusEnum = pgEnum('video_status', [
  'PENDING_UPLOAD',
  'UPLOAD_COMPLETE',
  'PROCESSING',
  'PROCESSED',
  'REJECTED',
  'FAILED',
]);
export const cameraAngleEnum = pgEnum('camera_angle', [
  'FRONT',
  'SIDE',
  'CORNER',
  'OVERHEAD',
  'UNKNOWN',
]);
export const aiAnalysisStatusEnum = pgEnum('ai_analysis_status', [
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REJECTED',
]);
export const anomalyLevelEnum = pgEnum('anomaly_level', [
  'LOW',
  'MEDIUM',
  'HIGH',
]);
export const bodyJointEnum = pgEnum('body_joint', [
  'LEFT_SHOULDER',
  'RIGHT_SHOULDER',
  'LEFT_ELBOW',
  'RIGHT_ELBOW',
  'LEFT_WRIST',
  'RIGHT_WRIST',
  'LEFT_HIP',
  'RIGHT_HIP',
  'LEFT_KNEE',
  'RIGHT_KNEE',
  'LEFT_ANKLE',
  'RIGHT_ANKLE',
  'SPINE_CORE',
]);
export const jointHealthStateEnum = pgEnum('joint_health_state', [
  'HEALTHY',
  'SUSPECTED',
  'SUSPECTED_AVOIDANCE',
  'CONFIRMED_IMPAIRMENT',
]);
export const techniqueTypeEnum = pgEnum('technique_type', [
  'JAB',
  'CROSS',
  'LEAD_HOOK',
  'REAR_HOOK',
  'LEAD_UPPERCUT',
  'REAR_UPPERCUT',
  'LEAD_LOW_KICK',
  'REAR_LOW_KICK',
  'LEAD_MIDDLE_KICK',
  'REAR_MIDDLE_KICK',
  'LEAD_HIGH_KICK',
  'REAR_HIGH_KICK',
  'FRONT_TEEP',
  'SPINNING_BACK_FIST',
]);
export const limbSideEnum = pgEnum('limb_side', [
  'LEFT_ARM',
  'RIGHT_ARM',
  'LEFT_LEG',
  'RIGHT_LEG',
  'BILATERAL',
]);
export const motionClassEnum = pgEnum('motion_class', [
  'TACTICAL_FEINT',
  'POWER_STRIKE',
  'PARTIAL_STRIKE',
  'UNKNOWN',
]);
export const alertSeverityEnum = pgEnum('alert_severity', [
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);
export const alertReviewDecisionEnum = pgEnum('alert_review_decision', [
  'PENDING',
  'CONFIRMED',
  'DISMISSED',
  'ESCALATED',
]);
export const clearanceTypeEnum = pgEnum('clearance_type', [
  'TRAINING',
  'COMPETITION',
  'RETURN_FROM_INJURY',
]);
export const clearanceStatusEnum = pgEnum('clearance_status', [
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
]);
export const injurySeverityEnum = pgEnum('injury_severity', [
  'MINOR',
  'MODERATE',
  'SEVERE',
  'CRITICAL',
]);
export const injuryStatusEnum = pgEnum('injury_status', [
  'ACTIVE',
  'RECOVERING',
  'RESOLVED',
]);
export const recoveryPlanStatusEnum = pgEnum('recovery_plan_status', [
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]);
export const notificationTypeEnum = pgEnum('notification_type', [
  'ANOMALY_HIGH',
  'ANOMALY_MEDIUM',
  'SESSION_REMINDER',
  'MEDICAL_CLEARANCE_EXPIRY',
  'VIDEO_PROCESSED',
  'SYSTEM',
  'JOINT_IMPAIRMENT_CONFIRMED',
]);

// ─── Task 14 Enums ────────────────────────────────────────────────────────────

export const attestationStatusEnum = pgEnum('attestation_status', [
  'ACTIVE',
  'REVOKED',
  'EXPIRED',
  'SUPERSEDED',
]);

export const attestationDecisionEnum = pgEnum('attestation_decision', [
  'GOLD_READY',
  'NOT_GOLD_READY',
]);

export const auditEventTypeEnum = pgEnum('audit_event_type', [
  'requested',
  'issued',
  'rejected',
  'revoked',
  'key_rotated',
]);

// ─── Table Definition ─────────────────────────────────────────────────────────

// External Supabase-owned table: FK metadata only; never exported or migrated here.
const authUsers = pgSchema('auth').table('users', {
  id: uuid('id').primaryKey(),
});

<<<<<<< HEAD
export const aiAnalyses = pgTable(
  'ai_analyses',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    videoId: uuid('video_id').notNull(),
    algorithmConfigId: uuid('algorithm_config_id').notNull(),
    status: aiAnalysisStatusEnum('status')
      .notNull()
      .default(sql.raw("'QUEUED'::ai_analysis_status")),
    confidenceScore: doublePrecision('confidence_score'),
    requiresReview: boolean('requires_review')
      .notNull()
      .default(sql.raw('false')),
    anomalyLevel: anomalyLevelEnum('anomaly_level'),
    footworkScore: doublePrecision('footwork_score'),
    guardScore: doublePrecision('guard_score'),
    headMovementScore: doublePrecision('head_movement_score'),
    styleProfile: jsonb('style_profile'),
    clipUrls: text('clip_urls')
      .array()
      .notNull()
      .default(sql.raw("'{}'::text[]")),
    processingStartedAt: timestamp('processing_started_at', {
      withTimezone: true,
    }),
    processingCompletedAt: timestamp('processing_completed_at', {
      withTimezone: true,
    }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    jobId: uuid('job_id').notNull(),
    fighterId: uuid('fighter_id').notNull(),
    sessionId: uuid('session_id'),
    resultSchemaVersion: text('result_schema_version'),
    resultStorageKey: text('result_storage_key'),
  },
  (t): PgTableExtraConfigValue[] => [
    primaryKey({ name: 'ai_analyses_pkey', columns: [t.id] }),
    unique('ai_analyses_job_id_key').on(t.jobId),
    unique('uq_analysis_video').on(t.videoId),
    unique('uq_analysis_fighter').on(t.id, t.fighterId),
    unique('uq_analysis_context').on(t.id, t.fighterId, t.algorithmConfigId),
    unique('uq_analysis_session').on(t.id, t.sessionId),
    unique('uq_analysis_video_context').on(t.id, t.videoId),
    foreignKey({
      name: 'ai_analyses_video_id_fkey',
      columns: [t.videoId],
      foreignColumns: [videos.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'ai_analyses_algorithm_config_id_fkey',
      columns: [t.algorithmConfigId],
      foreignColumns: [algorithmConfigs.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'ai_analyses_confidence_score_check',
      sql.raw(
        '((confidence_score >= (0.0)::double precision) AND (confidence_score <= (1.0)::double precision))',
      ),
    ),
    check(
      'ai_analyses_footwork_score_check',
      sql.raw(
        '((footwork_score >= (0)::double precision) AND (footwork_score <= (100)::double precision))',
      ),
    ),
    check(
      'ai_analyses_guard_score_check',
      sql.raw(
        '((guard_score >= (0)::double precision) AND (guard_score <= (100)::double precision))',
      ),
    ),
    check(
      'ai_analyses_head_movement_score_check',
      sql.raw(
        '((head_movement_score >= (0)::double precision) AND (head_movement_score <= (100)::double precision))',
      ),
    ),
    check(
      'ck_analysis_processing_time',
      sql.raw(
        '((processing_completed_at IS NULL) OR ((processing_started_at IS NOT NULL) AND (processing_completed_at >= processing_started_at)))',
      ),
    ),
    foreignKey({
      name: 'ai_analyses_job_id_fkey',
      columns: [t.jobId],
      foreignColumns: [analysisJobs.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'ai_analyses_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'ai_analyses_session_id_fkey',
      columns: [t.sessionId],
      foreignColumns: [trainingSessions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_analysis_video_fighter',
      columns: [t.videoId, t.fighterId],
      foreignColumns: [videos.id, videos.subjectFighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_analysis_video_session',
      columns: [t.videoId, t.sessionId],
      foreignColumns: [videos.id, videos.sessionId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_analysis_job_video',
      columns: [t.jobId, t.videoId],
      foreignColumns: [analysisJobs.id, analysisJobs.videoId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'ck_ai_analyses_finite',
      sql.raw(
        "(((confidence_score IS NULL) OR ((confidence_score > '-Infinity'::double precision) AND (confidence_score < 'Infinity'::double precision))) AND ((footwork_score IS NULL) OR ((footwork_score > '-Infinity'::double precision) AND (footwork_score < 'Infinity'::double precision))) AND ((guard_score IS NULL) OR ((guard_score > '-Infinity'::double precision) AND (guard_score < 'Infinity'::double precision))) AND ((head_movement_score IS NULL) OR ((head_movement_score > '-Infinity'::double precision) AND (head_movement_score < 'Infinity'::double precision))))",
      ),
    ),
    index('idx_analysis_fighter_created').using(
      'btree',
      t.fighterId,
      t.createdAt,
    ),
  ],
).enableRLS();
// ─── Task 14 Trust Boundary Tables ──────────────────────────────────────────

export const datasetExportCandidates = pgTable('dataset_export_candidates', {
  exportId:              text('export_id').primaryKey(),
  datasetHash:           text('dataset_hash').notNull(),
  manifestDigest:        text('manifest_digest').notNull(),
  reviewEvidenceDigest:  text('review_evidence_digest').notNull(),
  qualityEvidenceDigest: text('quality_evidence_digest').notNull(),
  policyVersion:         text('policy_version').notNull(),
  sourceSchemaVersion:   text('source_schema_version').notNull(),
  sampleCount:           integer('sample_count').notNull(),
  coveredActionIdsHash:  text('covered_action_ids_hash').notNull(),
  candidateStatus:       text('candidate_status').notNull(),
  readinessGaps:         jsonb('readiness_gaps').$type<string[]>().notNull().default([]),
  sourceJobId:           text('source_job_id'),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const datasetReviews = pgTable('dataset_reviews', {
  id:           uuid('id').primaryKey().defaultRandom(),
  exportId:     text('export_id').notNull(),
  reviewerId:   text('reviewer_id').notNull(),
  reviewerRole: text('reviewer_role').notNull(),
  reviewStatus: text('review_status').notNull().default('approved'),
  comments:     text('comments'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const datasetQualityReports = pgTable('dataset_quality_reports', {
  id:            uuid('id').primaryKey().defaultRandom(),
  exportId:      text('export_id').notNull().unique(),
  qualityStatus: text('quality_status').notNull(),
  policyVersion: text('policy_version').notNull(),
  metrics:       jsonb('metrics').$type<Record<string, any>>().notNull().default({}),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const datasetAttestations = pgTable('dataset_attestations', {
  attestationId:      text('attestation_id').primaryKey(),
  exportId:           text('export_id').notNull().references(() => datasetExportCandidates.exportId),
  issuer:             text('issuer').notNull(),
  audience:           text('audience').notNull(),
  purpose:            text('purpose').notNull(),
  keyId:              text('key_id').notNull(),
  algorithm:          text('algorithm').notNull().default('Ed25519'),
  decision:           attestationDecisionEnum('decision').notNull(),
  claims:             jsonb('claims').$type<Record<string, any>>().notNull(),
  signature:          text('signature').notNull(),
  status:             attestationStatusEnum('status').notNull().default('ACTIVE'),
  issuedAt:           timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt:          timestamp('expires_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt:          timestamp('revoked_at', { withTimezone: true }),
  revokedReason:      text('revoked_reason'),
  actorId:            text('actor_id').notNull(),
  auditCorrelationId: text('audit_correlation_id').notNull(),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const attestationNonces = pgTable('attestation_nonces', {
  issuer:        text('issuer').notNull(),
  nonce:         text('nonce').notNull(),
  expiresAt:     timestamp('expires_at', { withTimezone: true }).notNull(),
  attestationId: text('attestation_id'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.issuer, table.nonce] })
]);

export const datasetAttestationAudit = pgTable('dataset_attestation_audit', {
  id:            uuid('id').primaryKey().defaultRandom(),
  eventType:     auditEventTypeEnum('event_type').notNull(),
  exportId:      text('export_id').notNull(),
  attestationId: text('attestation_id'),
  actorId:       text('actor_id').notNull(),
  reasonCode:    text('reason_code'),
  requestDigest: text('request_digest'),
  details:       jsonb('details').$type<Record<string, any>>().notNull().default({}),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const datasetIdempotencyKeys = pgTable('dataset_idempotency_keys', {
  idempotencyKey:  text('idempotency_key').primaryKey(),
  operation:       text('operation').notNull(),
  actorId:         text('actor_id').notNull(),
  requestDigest:   text('request_digest').notNull(),
  responsePayload: jsonb('response_payload').$type<Record<string, any>>().notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const algorithmConfigs = pgTable(
  'algorithm_configs',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    versionTag: text('version_tag').notNull(),
    yoloModelName: text('yolo_model_name').notNull(),
    confThreshold: doublePrecision('conf_threshold').notNull(),
    emaAlpha: doublePrecision('ema_alpha').notNull(),
    jerkSmoothThreshold: doublePrecision('jerk_smooth_threshold').notNull(),
    jerkSmoothWindow: integer('jerk_smooth_window')
      .notNull()
      .default(sql.raw('3')),
    minFeintVelocityRatio: doublePrecision('min_feint_velocity_ratio')
      .notNull()
      .default(sql.raw('0.20')),
    romLowThreshold: doublePrecision('rom_low_threshold').notNull(),
    romRecoveryThreshold: doublePrecision('rom_recovery_threshold').notNull(),
    consecutiveLowRomLimit: integer('consecutive_low_rom_limit').notNull(),
    windowSecMin: doublePrecision('window_sec_min').notNull(),
    windowSecMax: doublePrecision('window_sec_max').notNull(),
    disuseSecTrigger: doublePrecision('disuse_sec_trigger').notNull(),
    tauMahalanobis: doublePrecision('tau_mahalanobis').default(sql.raw('3.0')),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(sql.raw('false')),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    deprecatedAt: timestamp('deprecated_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'algorithm_configs_conf_threshold_check',
      sql.raw(
        '((conf_threshold >= (0.0)::double precision) AND (conf_threshold <= (1.0)::double precision))',
      ),
    ),
    check(
      'algorithm_configs_ema_alpha_check',
      sql.raw(
        '((ema_alpha >= (0.0)::double precision) AND (ema_alpha <= (1.0)::double precision))',
      ),
    ),
    check(
      'algorithm_configs_jerk_smooth_threshold_check',
      sql.raw('(jerk_smooth_threshold > (0)::double precision)'),
    ),
    check(
      'algorithm_configs_jerk_smooth_window_check',
      sql.raw('(jerk_smooth_window > 0)'),
    ),
    check(
      'algorithm_configs_rom_low_threshold_check',
      sql.raw('(rom_low_threshold > (0)::double precision)'),
    ),
    check(
      'algorithm_configs_check',
      sql.raw('(rom_recovery_threshold > rom_low_threshold)'),
    ),
    check(
      'algorithm_configs_consecutive_low_rom_limit_check',
      sql.raw('(consecutive_low_rom_limit > 0)'),
    ),
    check(
      'algorithm_configs_window_sec_min_check',
      sql.raw('(window_sec_min > (0)::double precision)'),
    ),
    check(
      'algorithm_configs_check1',
      sql.raw('(window_sec_max > window_sec_min)'),
    ),
    check(
      'algorithm_configs_disuse_sec_trigger_check',
      sql.raw('(disuse_sec_trigger > (0)::double precision)'),
    ),
    check(
      'algorithm_configs_tau_mahalanobis_check',
      sql.raw('(tau_mahalanobis > (0)::double precision)'),
    ),
    check(
      'ck_config_lifecycle',
      sql.raw(
        '(((NOT is_active) OR ((activated_at IS NOT NULL) AND (deprecated_at IS NULL))) AND ((deprecated_at IS NULL) OR ((activated_at IS NOT NULL) AND (deprecated_at >= activated_at))))',
      ),
    ),
    check(
      'ck_config_feint_ratio',
      sql.raw('(min_feint_velocity_ratio >= (0)::double precision)'),
    ),
    primaryKey({ name: 'algorithm_configs_pkey', columns: [t.id] }),
    unique('algorithm_configs_version_tag_key').on(t.versionTag),
    foreignKey({
      name: 'algorithm_configs_created_by_fkey',
      columns: [t.createdBy],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'ck_algorithm_configs_finite',
      sql.raw(
        "(((conf_threshold IS NULL) OR ((conf_threshold > '-Infinity'::double precision) AND (conf_threshold < 'Infinity'::double precision))) AND ((ema_alpha IS NULL) OR ((ema_alpha > '-Infinity'::double precision) AND (ema_alpha < 'Infinity'::double precision))) AND ((jerk_smooth_threshold IS NULL) OR ((jerk_smooth_threshold > '-Infinity'::double precision) AND (jerk_smooth_threshold < 'Infinity'::double precision))) AND ((min_feint_velocity_ratio IS NULL) OR ((min_feint_velocity_ratio > '-Infinity'::double precision) AND (min_feint_velocity_ratio < 'Infinity'::double precision))) AND ((rom_low_threshold IS NULL) OR ((rom_low_threshold > '-Infinity'::double precision) AND (rom_low_threshold < 'Infinity'::double precision))) AND ((rom_recovery_threshold IS NULL) OR ((rom_recovery_threshold > '-Infinity'::double precision) AND (rom_recovery_threshold < 'Infinity'::double precision))) AND ((window_sec_min IS NULL) OR ((window_sec_min > '-Infinity'::double precision) AND (window_sec_min < 'Infinity'::double precision))) AND ((window_sec_max IS NULL) OR ((window_sec_max > '-Infinity'::double precision) AND (window_sec_max < 'Infinity'::double precision))) AND ((disuse_sec_trigger IS NULL) OR ((disuse_sec_trigger > '-Infinity'::double precision) AND (disuse_sec_trigger < 'Infinity'::double precision))) AND ((tau_mahalanobis IS NULL) OR ((tau_mahalanobis > '-Infinity'::double precision) AND (tau_mahalanobis < 'Infinity'::double precision))))",
      ),
    ),
    uniqueIndex('uidx_algorithm_configs_single_active')
      .using('btree', t.isActive)
      .where(sql.raw('(is_active = true)')),
  ],
).enableRLS();

export const analysisJobs = pgTable(
  'analysis_jobs',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    userId: text('user_id').notNull().default(sql.raw("'anonymous'::text")),
    videoUrl: text('video_url').notNull(),
    status: jobStatusEnum('status')
      .notNull()
      .default(sql.raw("'PENDING'::job_status")),
    resultUrl: text('result_url'),
    score: integer('score'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    healthAlerts: jsonb('health_alerts')
      .$type<HealthAlert[]>()
      .notNull()
      .default(sql.raw("'[]'::jsonb")),
    jointStates: jsonb('joint_states')
      .$type<JointStatesMap>()
      .notNull()
      .default(sql.raw("'{}'::jsonb")),
    alertCount: integer('alert_count').notNull().default(sql.raw('0')),
    hasImpairment: boolean('has_impairment')
      .notNull()
      .default(sql.raw('false')),
    fighterId: uuid('fighter_id'),
    sessionId: uuid('session_id'),
    videoId: uuid('video_id'),
    algorithmConfigId: uuid('algorithm_config_id'),
    createdById: uuid('created_by_id'),
  },
  (t): PgTableExtraConfigValue[] => [
    primaryKey({ name: 'analysis_jobs_pkey', columns: [t.id] }),
    unique('uq_job_video').on(t.videoId),
    unique('uq_job_id_video').on(t.id, t.videoId),
    foreignKey({
      name: 'analysis_jobs_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'analysis_jobs_session_id_fkey',
      columns: [t.sessionId],
      foreignColumns: [trainingSessions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'analysis_jobs_video_id_fkey',
      columns: [t.videoId],
      foreignColumns: [videos.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'analysis_jobs_algorithm_config_id_fkey',
      columns: [t.algorithmConfigId],
      foreignColumns: [algorithmConfigs.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'analysis_jobs_created_by_id_fkey',
      columns: [t.createdById],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_job_session_fighter',
      columns: [t.sessionId, t.fighterId],
      foreignColumns: [trainingSessions.id, trainingSessions.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_job_video_fighter',
      columns: [t.videoId, t.fighterId],
      foreignColumns: [videos.id, videos.subjectFighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_job_video_session',
      columns: [t.videoId, t.sessionId],
      foreignColumns: [videos.id, videos.sessionId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('idx_analysis_jobs_status').using('btree', t.status),
    index('idx_analysis_jobs_health_alerts').using('gin', t.healthAlerts),
    index('idx_job_fighter_created')
      .using('btree', t.fighterId, t.createdAt)
      .where(sql.raw('(fighter_id IS NOT NULL)')),
    index('idx_analysis_jobs_user_id').using('btree', t.userId),
    index('idx_analysis_jobs_has_impairment')
      .using('btree', t.hasImpairment)
      .where(sql.raw('(has_impairment = true)')),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    actorUserId: uuid('actor_user_id'),
    actorType: text('actor_type').notNull(),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id'),
    requestId: text('request_id'),
    details: jsonb('details').notNull().default(sql.raw("'{}'::jsonb")),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'audit_logs_actor_type_check',
      sql.raw("(actor_type = ANY (ARRAY['USER'::text, 'SYSTEM'::text]))"),
    ),
    check(
      'audit_logs_details_check',
      sql.raw("(jsonb_typeof(details) = 'object'::text)"),
    ),
    check(
      'ck_audit_actor',
      sql.raw("((actor_type = 'USER'::text) = (actor_user_id IS NOT NULL))"),
    ),
    primaryKey({ name: 'audit_logs_pkey', columns: [t.id] }),
    foreignKey({
      name: 'audit_logs_actor_user_id_fkey',
      columns: [t.actorUserId],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('idx_audit_resource_time').using(
      'btree',
      t.resourceType,
      t.resourceId,
      t.createdAt,
    ),
    index('idx_audit_actor_time').using('btree', t.actorUserId, t.createdAt),
  ],
).enableRLS();

export const coachFighters = pgTable(
  'coach_fighters',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    coachId: uuid('coach_id').notNull(),
    fighterId: uuid('fighter_id').notNull(),
    assignedById: uuid('assigned_by_id').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    endedById: uuid('ended_by_id'),
    endReason: text('end_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'ck_coach_fighters_period',
      sql.raw('((ends_at IS NULL) OR (ends_at > starts_at))'),
    ),
    check(
      'ck_coach_fighters_closure',
      sql.raw(
        "(((ends_at IS NULL) AND (ended_by_id IS NULL) AND (end_reason IS NULL)) OR ((ends_at IS NOT NULL) AND (ended_by_id IS NOT NULL) AND (NULLIF(btrim(end_reason), ''::text) IS NOT NULL)))",
      ),
    ),
    primaryKey({ name: 'coach_fighters_pkey', columns: [t.id] }),
    foreignKey({
      name: 'coach_fighters_coach_id_fkey',
      columns: [t.coachId],
      foreignColumns: [coaches.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'coach_fighters_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'coach_fighters_assigned_by_id_fkey',
      columns: [t.assignedById],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'coach_fighters_ended_by_id_fkey',
      columns: [t.endedById],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('idx_coach_fighter_history').using('btree', t.fighterId, t.startsAt),
    uniqueIndex('uq_coach_fighter_open')
      .using('btree', t.coachId, t.fighterId)
      .where(sql.raw('(ends_at IS NULL)')),
  ],
).enableRLS();

export const coachReviews = pgTable(
  'coach_reviews',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    analysisId: uuid('analysis_id').notNull(),
    coachId: uuid('coach_id').notNull(),
    reviewText: text('review_text').notNull(),
    techniqueRating: smallint('technique_rating'),
    correctedStrikeCounts: jsonb('corrected_strike_counts'),
    overridesAi: boolean('overrides_ai').notNull().default(sql.raw('false')),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    revision: integer('revision').notNull().default(sql.raw('1')),
    supersedesId: uuid('supersedes_id'),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'coach_reviews_technique_rating_check',
      sql.raw('((technique_rating >= 1) AND (technique_rating <= 10))'),
    ),
    check('coach_reviews_revision_check', sql.raw('(revision > 0)')),
    check(
      'ck_review_revision',
      sql.raw(
        '(((revision = 1) = (supersedes_id IS NULL)) AND (supersedes_id IS DISTINCT FROM id))',
      ),
    ),
    check(
      'ck_review_counts',
      sql.raw(
        "((corrected_strike_counts IS NULL) OR (jsonb_typeof(corrected_strike_counts) = 'object'::text))",
      ),
    ),
    primaryKey({ name: 'coach_reviews_pkey', columns: [t.id] }),
    unique('uq_review_revision').on(t.analysisId, t.coachId, t.revision),
    unique('uq_review_chain').on(t.id, t.analysisId, t.coachId),
    unique('uq_review_successor').on(t.supersedesId),
    foreignKey({
      name: 'coach_reviews_analysis_id_fkey',
      columns: [t.analysisId],
      foreignColumns: [aiAnalyses.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'coach_reviews_coach_id_fkey',
      columns: [t.coachId],
      foreignColumns: [coaches.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'coach_reviews_supersedes_id_fkey',
      columns: [t.supersedesId],
      foreignColumns: [coachReviews.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_review_predecessor',
      columns: [t.supersedesId, t.analysisId, t.coachId],
      foreignColumns: [
        coachReviews.id,
        coachReviews.analysisId,
        coachReviews.coachId,
      ],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
  ],
).enableRLS();

export const coaches = pgTable(
  'coaches',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    userId: uuid('user_id').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    isHeadCoach: boolean('is_head_coach').notNull().default(sql.raw('false')),
    specialization: text('specialization'),
    profileImageUrl: text('profile_image_url'),
    isActive: boolean('is_active').notNull().default(sql.raw('true')),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    profileRole: userRoleEnum('profile_role')
      .notNull()
      .default(sql.raw("'COACH'::user_role")),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'coaches_profile_role_check',
      sql.raw("(profile_role = 'COACH'::user_role)"),
    ),
    primaryKey({ name: 'coaches_pkey', columns: [t.id] }),
    unique('coaches_user_id_key').on(t.userId),
    foreignKey({
      name: 'coaches_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_coaches_role',
      columns: [t.userId, t.profileRole],
      foreignColumns: [users.id, users.role],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
  ],
).enableRLS();

export const doctorFighters = pgTable(
  'doctor_fighters',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    doctorId: uuid('doctor_id').notNull(),
    fighterId: uuid('fighter_id').notNull(),
    assignedById: uuid('assigned_by_id').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    endedById: uuid('ended_by_id'),
    endReason: text('end_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'ck_doctor_fighters_closure',
      sql.raw(
        "(((ends_at IS NULL) AND (ended_by_id IS NULL) AND (end_reason IS NULL)) OR ((ends_at IS NOT NULL) AND (ended_by_id IS NOT NULL) AND (NULLIF(btrim(end_reason), ''::text) IS NOT NULL)))",
      ),
    ),
    check(
      'ck_doctor_fighters_period',
      sql.raw('((ends_at IS NULL) OR (ends_at > starts_at))'),
    ),
    primaryKey({ name: 'doctor_fighters_pkey', columns: [t.id] }),
    foreignKey({
      name: 'doctor_fighters_doctor_id_fkey',
      columns: [t.doctorId],
      foreignColumns: [sportsDoctors.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'doctor_fighters_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'doctor_fighters_assigned_by_id_fkey',
      columns: [t.assignedById],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'doctor_fighters_ended_by_id_fkey',
      columns: [t.endedById],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    uniqueIndex('uq_doctor_fighter_open')
      .using('btree', t.doctorId, t.fighterId)
      .where(sql.raw('(ends_at IS NULL)')),
    index('idx_doctor_fighter_history').using('btree', t.fighterId, t.startsAt),
  ],
).enableRLS();

export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    name: text('name').notNull(),
    description: text('description'),
    category: exerciseCategoryEnum('category').notNull(),
    targetMuscleGroups: text('target_muscle_groups')
      .array()
      .notNull()
      .default(sql.raw("'{}'::text[]")),
    videoUrl: text('video_url'),
    thumbnailUrl: text('thumbnail_url'),
    isActive: boolean('is_active').notNull().default(sql.raw('true')),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t): PgTableExtraConfigValue[] => [
    primaryKey({ name: 'exercises_pkey', columns: [t.id] }),
  ],
).enableRLS();

export const fighterBaselines = pgTable(
  'fighter_baselines',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    fighterId: uuid('fighter_id').notNull(),
    algorithmConfigId: uuid('algorithm_config_id').notNull(),
    techniqueType: techniqueTypeEnum('technique_type').notNull(),
    limbSide: limbSideEnum('limb_side').notNull(),
    romBaselineDeg: doublePrecision('rom_baseline_deg').notNull(),
    velocityBaseline: doublePrecision('velocity_baseline').notNull(),
    jerkThreshold: doublePrecision('jerk_threshold').notNull(),
    covarianceMatrix: jsonb('covariance_matrix')
      .notNull()
      .default(sql.raw("'[]'::jsonb")),
    sampleCount: integer('sample_count').notNull().default(sql.raw('0')),
    sampleSessions: integer('sample_sessions').notNull().default(sql.raw('0')),
    stdDevRom: doublePrecision('std_dev_rom'),
    isActive: boolean('is_active').notNull().default(sql.raw('true')),
    isLocked: boolean('is_locked').notNull().default(sql.raw('false')),
    calculatedAt: timestamp('calculated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    sourceDescription: text('source_description').notNull(),
    approvedById: uuid('approved_by_id'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'fighter_baselines_rom_baseline_deg_check',
      sql.raw(
        '((rom_baseline_deg >= (0)::double precision) AND (rom_baseline_deg <= (180)::double precision))',
      ),
    ),
    check(
      'fighter_baselines_velocity_baseline_check',
      sql.raw('(velocity_baseline > (0)::double precision)'),
    ),
    check(
      'fighter_baselines_jerk_threshold_check',
      sql.raw('(jerk_threshold > (0)::double precision)'),
    ),
    check(
      'fighter_baselines_sample_count_check',
      sql.raw('(sample_count >= 0)'),
    ),
    check(
      'ck_baseline_approval',
      sql.raw(
        '((is_locked = (approved_at IS NOT NULL)) AND ((approved_at IS NULL) = (approved_by_id IS NULL)))',
      ),
    ),
    check(
      'ck_baseline_expiry',
      sql.raw('((expires_at IS NULL) OR (expires_at > calculated_at))'),
    ),
    check(
      'ck_baseline_samples',
      sql.raw(
        '((sample_sessions >= 0) AND (std_dev_rom >= (0)::double precision))',
      ),
    ),
    check(
      'ck_baseline_covariance',
      sql.raw("(jsonb_typeof(covariance_matrix) = 'array'::text)"),
    ),
    primaryKey({ name: 'fighter_baselines_pkey', columns: [t.id] }),
    unique('uq_baseline_context').on(t.id, t.fighterId, t.algorithmConfigId),
    foreignKey({
      name: 'fighter_baselines_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fighter_baselines_algorithm_config_id_fkey',
      columns: [t.algorithmConfigId],
      foreignColumns: [algorithmConfigs.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fighter_baselines_approved_by_id_fkey',
      columns: [t.approvedById],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'ck_fighter_baselines_finite',
      sql.raw(
        "(((rom_baseline_deg IS NULL) OR ((rom_baseline_deg > '-Infinity'::double precision) AND (rom_baseline_deg < 'Infinity'::double precision))) AND ((velocity_baseline IS NULL) OR ((velocity_baseline > '-Infinity'::double precision) AND (velocity_baseline < 'Infinity'::double precision))) AND ((jerk_threshold IS NULL) OR ((jerk_threshold > '-Infinity'::double precision) AND (jerk_threshold < 'Infinity'::double precision))) AND ((std_dev_rom IS NULL) OR ((std_dev_rom > '-Infinity'::double precision) AND (std_dev_rom < 'Infinity'::double precision))))",
      ),
    ),
    uniqueIndex('uidx_fighter_baselines_active')
      .using(
        'btree',
        t.fighterId,
        t.techniqueType,
        t.limbSide,
        t.algorithmConfigId,
      )
      .where(sql.raw('(is_active = true)')),
  ],
).enableRLS();

export const fighterJointStates = pgTable(
  'fighter_joint_states',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    fighterId: uuid('fighter_id').notNull(),
    joint: bodyJointEnum('joint').notNull(),
    currentState: jointHealthStateEnum('current_state')
      .notNull()
      .default(sql.raw("'HEALTHY'::joint_health_state")),
    stateUpdatedAt: timestamp('state_updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    consecutiveSuspectedCount: integer('consecutive_suspected_count')
      .notNull()
      .default(sql.raw('0')),
    lastTriggerEventId: uuid('last_trigger_event_id'),
    lastTriggerAlertId: uuid('last_trigger_alert_id'),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true }),
    notes: text('notes'),
    sourceAnalysisId: uuid('source_analysis_id'),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'fighter_joint_states_consecutive_suspected_count_check',
      sql.raw('(consecutive_suspected_count >= 0)'),
    ),
    primaryKey({ name: 'fighter_joint_states_pkey', columns: [t.id] }),
    unique('uq_fighter_joint').on(t.fighterId, t.joint),
    foreignKey({
      name: 'fighter_joint_states_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fighter_joint_states_last_trigger_event_id_fkey',
      columns: [t.lastTriggerEventId],
      foreignColumns: [techniqueEvents.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fighter_joint_states_source_analysis_id_fkey',
      columns: [t.sourceAnalysisId],
      foreignColumns: [aiAnalyses.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_state_event_fighter',
      columns: [t.lastTriggerEventId, t.fighterId],
      foreignColumns: [techniqueEvents.id, techniqueEvents.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_state_alert_fighter',
      columns: [t.lastTriggerAlertId, t.fighterId],
      foreignColumns: [healthAlerts.id, healthAlerts.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_state_analysis_fighter',
      columns: [t.sourceAnalysisId, t.fighterId],
      foreignColumns: [aiAnalyses.id, aiAnalyses.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
  ],
).enableRLS();

export const fighterMeasurements = pgTable(
  'fighter_measurements',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    fighterId: uuid('fighter_id').notNull(),
    recordedById: uuid('recorded_by_id').notNull(),
    measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
    measurementContext: text('measurement_context').notNull(),
    weightKg: numeric('weight_kg', { precision: 6, scale: 2 }).notNull(),
    heightCm: numeric('height_cm', { precision: 5, scale: 2 }),
    reachCm: numeric('reach_cm', { precision: 5, scale: 2 }),
    notes: text('notes'),
    supersedesId: uuid('supersedes_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'fighter_measurements_measurement_context_check',
      sql.raw(
        "(measurement_context = ANY (ARRAY['TRAINING'::text, 'CHECKUP'::text, 'WEIGH_IN'::text, 'SELF_REPORTED'::text]))",
      ),
    ),
    check(
      'fighter_measurements_weight_kg_check',
      sql.raw("((weight_kg > (0)::numeric) AND (weight_kg <> 'NaN'::numeric))"),
    ),
    check(
      'fighter_measurements_height_cm_check',
      sql.raw("((height_cm > (0)::numeric) AND (height_cm <> 'NaN'::numeric))"),
    ),
    check(
      'fighter_measurements_reach_cm_check',
      sql.raw("((reach_cm > (0)::numeric) AND (reach_cm <> 'NaN'::numeric))"),
    ),
    check(
      'ck_measurement_correction',
      sql.raw('(supersedes_id IS DISTINCT FROM id)'),
    ),
    primaryKey({ name: 'fighter_measurements_pkey', columns: [t.id] }),
    unique('uq_measurement_fighter').on(t.id, t.fighterId),
    unique('uq_measurement_successor').on(t.supersedesId),
    foreignKey({
      name: 'fighter_measurements_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fighter_measurements_recorded_by_id_fkey',
      columns: [t.recordedById],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fighter_measurements_supersedes_id_fkey',
      columns: [t.supersedesId],
      foreignColumns: [fighterMeasurements.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_measurement_correction',
      columns: [t.supersedesId, t.fighterId],
      foreignColumns: [fighterMeasurements.id, fighterMeasurements.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('idx_measurement_fighter_time').using(
      'btree',
      t.fighterId,
      t.measuredAt,
      t.createdAt,
    ),
  ],
).enableRLS();

export const fighters = pgTable(
  'fighters',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    userId: uuid('user_id').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    dateOfBirth: date('date_of_birth').notNull(),
    nationality: text('nationality'),
    weightClass: weightClassEnum('weight_class').notNull(),
    heightCm: doublePrecision('height_cm'),
    reachCm: doublePrecision('reach_cm'),
    dominantStance: fighterStanceEnum('dominant_stance'),
    leftArmCm: doublePrecision('left_arm_cm'),
    rightArmCm: doublePrecision('right_arm_cm'),
    leftLegCm: doublePrecision('left_leg_cm'),
    rightLegCm: doublePrecision('right_leg_cm'),
    gym: text('gym'),
    currentMedicalStatus: medicalStatusEnum('current_medical_status')
      .notNull()
      .default(sql.raw("'NOT_CLEARED'::medical_status")),
    bio: text('bio'),
    profileImageUrl: text('profile_image_url'),
    isActive: boolean('is_active').notNull().default(sql.raw('true')),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    profileRole: userRoleEnum('profile_role')
      .notNull()
      .default(sql.raw("'FIGHTER'::user_role")),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'fighters_height_cm_check',
      sql.raw(
        '((height_cm > (0)::double precision) AND (height_cm < (300)::double precision))',
      ),
    ),
    check(
      'fighters_reach_cm_check',
      sql.raw(
        '((reach_cm > (0)::double precision) AND (reach_cm < (300)::double precision))',
      ),
    ),
    check(
      'fighters_left_arm_cm_check',
      sql.raw(
        '((left_arm_cm > (0)::double precision) AND (left_arm_cm < (150)::double precision))',
      ),
    ),
    check(
      'fighters_right_arm_cm_check',
      sql.raw(
        '((right_arm_cm > (0)::double precision) AND (right_arm_cm < (150)::double precision))',
      ),
    ),
    check(
      'fighters_left_leg_cm_check',
      sql.raw(
        '((left_leg_cm > (0)::double precision) AND (left_leg_cm < (150)::double precision))',
      ),
    ),
    check(
      'fighters_right_leg_cm_check',
      sql.raw(
        '((right_leg_cm > (0)::double precision) AND (right_leg_cm < (150)::double precision))',
      ),
    ),
    check(
      'fighters_profile_role_check',
      sql.raw("(profile_role = 'FIGHTER'::user_role)"),
    ),
    primaryKey({ name: 'fighters_pkey', columns: [t.id] }),
    unique('fighters_user_id_key').on(t.userId),
    foreignKey({
      name: 'fighters_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_fighters_role',
      columns: [t.userId, t.profileRole],
      foreignColumns: [users.id, users.role],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'ck_fighters_finite',
      sql.raw(
        "(((height_cm IS NULL) OR ((height_cm > '-Infinity'::double precision) AND (height_cm < 'Infinity'::double precision))) AND ((reach_cm IS NULL) OR ((reach_cm > '-Infinity'::double precision) AND (reach_cm < 'Infinity'::double precision))) AND ((left_arm_cm IS NULL) OR ((left_arm_cm > '-Infinity'::double precision) AND (left_arm_cm < 'Infinity'::double precision))) AND ((right_arm_cm IS NULL) OR ((right_arm_cm > '-Infinity'::double precision) AND (right_arm_cm < 'Infinity'::double precision))) AND ((left_leg_cm IS NULL) OR ((left_leg_cm > '-Infinity'::double precision) AND (left_leg_cm < 'Infinity'::double precision))) AND ((right_leg_cm IS NULL) OR ((right_leg_cm > '-Infinity'::double precision) AND (right_leg_cm < 'Infinity'::double precision))))",
      ),
    ),
  ],
).enableRLS();

export const healthAlerts = pgTable(
  'health_alerts',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    analysisId: uuid('analysis_id').notNull(),
    fighterId: uuid('fighter_id').notNull(),
    sessionId: uuid('session_id'),
    roundId: uuid('round_id'),
    joint: bodyJointEnum('joint').notNull(),
    state: jointHealthStateEnum('state')
      .notNull()
      .default(sql.raw("'CONFIRMED_IMPAIRMENT'::joint_health_state")),
    severity: alertSeverityEnum('severity').notNull(),
    triggerTimeMs: doublePrecision('trigger_time_ms').notNull(),
    windowStartMs: doublePrecision('window_start_ms').notNull(),
    consecutiveLowRom: integer('consecutive_low_rom').notNull(),
    avgRomRatio: doublePrecision('avg_rom_ratio').notNull(),
    motionClass: motionClassEnum('motion_class').notNull(),
    recommendation: text('recommendation').notNull(),
    techniqueType: techniqueTypeEnum('technique_type'),
    techniqueEventId: uuid('technique_event_id'),
    compensatoryPatternDetected: text('compensatory_pattern_detected'),
    affectedAdjacentJoints: bodyJointEnum('affected_adjacent_joints').array(),
    algorithmConfigId: uuid('algorithm_config_id').notNull(),
    baselineId: uuid('baseline_id'),
    reviewDecision: alertReviewDecisionEnum('review_decision')
      .notNull()
      .default(sql.raw("'PENDING'::alert_review_decision")),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNotes: text('review_notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'health_alerts_trigger_time_ms_check',
      sql.raw('(trigger_time_ms >= (0)::double precision)'),
    ),
    check(
      'health_alerts_window_start_ms_check',
      sql.raw('(window_start_ms >= (0)::double precision)'),
    ),
    check(
      'health_alerts_consecutive_low_rom_check',
      sql.raw('(consecutive_low_rom > 0)'),
    ),
    check(
      'health_alerts_avg_rom_ratio_check',
      sql.raw(
        '((avg_rom_ratio >= (0.0)::double precision) AND (avg_rom_ratio <= (2.0)::double precision))',
      ),
    ),
    check('ck_alert_time', sql.raw('(trigger_time_ms >= window_start_ms)')),
    check(
      'ck_alert_review',
      sql.raw(
        "(((review_decision = 'PENDING'::alert_review_decision) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL)) OR ((review_decision <> 'PENDING'::alert_review_decision) AND (reviewed_by IS NOT NULL) AND (reviewed_at IS NOT NULL)))",
      ),
    ),
    check(
      'ck_health_alerts_round_context',
      sql.raw('((round_id IS NULL) OR (session_id IS NOT NULL))'),
    ),
    primaryKey({ name: 'health_alerts_pkey', columns: [t.id] }),
    unique('uq_alert_fighter').on(t.id, t.fighterId),
    foreignKey({
      name: 'health_alerts_analysis_id_fkey',
      columns: [t.analysisId],
      foreignColumns: [aiAnalyses.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'health_alerts_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'health_alerts_session_id_fkey',
      columns: [t.sessionId],
      foreignColumns: [trainingSessions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'health_alerts_round_id_fkey',
      columns: [t.roundId],
      foreignColumns: [sessionRounds.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'health_alerts_technique_event_id_fkey',
      columns: [t.techniqueEventId],
      foreignColumns: [techniqueEvents.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'health_alerts_algorithm_config_id_fkey',
      columns: [t.algorithmConfigId],
      foreignColumns: [algorithmConfigs.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'health_alerts_baseline_id_fkey',
      columns: [t.baselineId],
      foreignColumns: [fighterBaselines.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'health_alerts_reviewed_by_fkey',
      columns: [t.reviewedBy],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_alert_event',
      columns: [t.techniqueEventId, t.analysisId, t.fighterId],
      foreignColumns: [
        techniqueEvents.id,
        techniqueEvents.analysisId,
        techniqueEvents.fighterId,
      ],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_health_alerts_analysis',
      columns: [t.analysisId, t.fighterId, t.algorithmConfigId],
      foreignColumns: [
        aiAnalyses.id,
        aiAnalyses.fighterId,
        aiAnalyses.algorithmConfigId,
      ],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_health_alerts_session',
      columns: [t.sessionId, t.fighterId],
      foreignColumns: [trainingSessions.id, trainingSessions.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_health_alerts_analysis_session',
      columns: [t.analysisId, t.sessionId],
      foreignColumns: [aiAnalyses.id, aiAnalyses.sessionId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_health_alerts_baseline',
      columns: [t.baselineId, t.fighterId, t.algorithmConfigId],
      foreignColumns: [
        fighterBaselines.id,
        fighterBaselines.fighterId,
        fighterBaselines.algorithmConfigId,
      ],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_health_alerts_round',
      columns: [t.roundId, t.sessionId],
      foreignColumns: [sessionRounds.id, sessionRounds.sessionId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'ck_health_alerts_finite',
      sql.raw(
        "(((trigger_time_ms IS NULL) OR ((trigger_time_ms > '-Infinity'::double precision) AND (trigger_time_ms < 'Infinity'::double precision))) AND ((window_start_ms IS NULL) OR ((window_start_ms > '-Infinity'::double precision) AND (window_start_ms < 'Infinity'::double precision))) AND ((avg_rom_ratio IS NULL) OR ((avg_rom_ratio > '-Infinity'::double precision) AND (avg_rom_ratio < 'Infinity'::double precision))))",
      ),
    ),
    index('idx_alert_fighter_review').using(
      'btree',
      t.fighterId,
      t.reviewDecision,
      t.createdAt,
    ),
  ],
).enableRLS();

export const injuryRecords = pgTable(
  'injury_records',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    fighterId: uuid('fighter_id').notNull(),
    reportedById: uuid('reported_by_id').notNull(),
    affectedJoint: bodyJointEnum('affected_joint').notNull(),
    injuryType: text('injury_type').notNull(),
    severity: injurySeverityEnum('severity').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    description: text('description'),
    triggerVideoId: uuid('trigger_video_id'),
    triggerTimeMs: doublePrecision('trigger_time_ms'),
    sourceAlertId: uuid('source_alert_id'),
    status: injuryStatusEnum('status')
      .notNull()
      .default(sql.raw("'ACTIVE'::injury_status")),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(sql.raw('true')),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'injury_records_trigger_time_ms_check',
      sql.raw('(trigger_time_ms >= (0)::double precision)'),
    ),
    check(
      'ck_injury_resolved',
      sql.raw(
        "(((status = 'RESOLVED'::injury_status) = (resolved_at IS NOT NULL)) AND ((resolved_at IS NULL) OR (resolved_at >= occurred_at)))",
      ),
    ),
    check(
      'ck_injury_video_time',
      sql.raw('((trigger_time_ms IS NULL) OR (trigger_video_id IS NOT NULL))'),
    ),
    primaryKey({ name: 'injury_records_pkey', columns: [t.id] }),
    unique('uq_injury_fighter').on(t.id, t.fighterId),
    foreignKey({
      name: 'injury_records_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'injury_records_reported_by_id_fkey',
      columns: [t.reportedById],
      foreignColumns: [sportsDoctors.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'injury_records_trigger_video_id_fkey',
      columns: [t.triggerVideoId],
      foreignColumns: [videos.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'injury_records_source_alert_id_fkey',
      columns: [t.sourceAlertId],
      foreignColumns: [healthAlerts.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_injury_video_fighter',
      columns: [t.triggerVideoId, t.fighterId],
      foreignColumns: [videos.id, videos.subjectFighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_injury_alert_fighter',
      columns: [t.sourceAlertId, t.fighterId],
      foreignColumns: [healthAlerts.id, healthAlerts.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'ck_injury_records_finite',
      sql.raw(
        "((trigger_time_ms IS NULL) OR ((trigger_time_ms > '-Infinity'::double precision) AND (trigger_time_ms < 'Infinity'::double precision)))",
      ),
    ),
    index('idx_injury_source_alert')
      .using('btree', t.sourceAlertId)
      .where(sql.raw('(source_alert_id IS NOT NULL)')),
    index('idx_injury_fighter_status').using(
      'btree',
      t.fighterId,
      t.status,
      t.occurredAt,
    ),
  ],
).enableRLS();

export const jointHealthHistory = pgTable(
  'joint_health_history',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    fighterId: uuid('fighter_id').notNull(),
    sessionId: uuid('session_id'),
    analysisId: uuid('analysis_id'),
    joint: bodyJointEnum('joint').notNull(),
    state: jointHealthStateEnum('state').notNull(),
    romRatio: doublePrecision('rom_ratio'),
    algorithmConfigId: uuid('algorithm_config_id').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'joint_health_history_rom_ratio_check',
      sql.raw('(rom_ratio >= (0)::double precision)'),
    ),
    primaryKey({ name: 'joint_health_history_pkey', columns: [t.id] }),
    foreignKey({
      name: 'joint_health_history_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'joint_health_history_session_id_fkey',
      columns: [t.sessionId],
      foreignColumns: [trainingSessions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'joint_health_history_analysis_id_fkey',
      columns: [t.analysisId],
      foreignColumns: [aiAnalyses.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'joint_health_history_algorithm_config_id_fkey',
      columns: [t.algorithmConfigId],
      foreignColumns: [algorithmConfigs.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_joint_health_history_analysis',
      columns: [t.analysisId, t.fighterId, t.algorithmConfigId],
      foreignColumns: [
        aiAnalyses.id,
        aiAnalyses.fighterId,
        aiAnalyses.algorithmConfigId,
      ],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_joint_health_history_session',
      columns: [t.sessionId, t.fighterId],
      foreignColumns: [trainingSessions.id, trainingSessions.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_joint_health_history_analysis_session',
      columns: [t.analysisId, t.sessionId],
      foreignColumns: [aiAnalyses.id, aiAnalyses.sessionId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'ck_joint_health_history_finite',
      sql.raw(
        "((rom_ratio IS NULL) OR ((rom_ratio > '-Infinity'::double precision) AND (rom_ratio < 'Infinity'::double precision)))",
      ),
    ),
    index('idx_history_fighter_joint_time').using(
      'btree',
      t.fighterId,
      t.joint,
      t.recordedAt,
    ),
  ],
).enableRLS();

export const medicalClearances = pgTable(
  'medical_clearances',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    fighterId: uuid('fighter_id').notNull(),
    issuedById: uuid('issued_by_id').notNull(),
    clearanceType: clearanceTypeEnum('clearance_type').notNull(),
    status: clearanceStatusEnum('status')
      .notNull()
      .default(sql.raw("'ACTIVE'::clearance_status")),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    notes: text('notes'),
    allowedSessionTypes: sessionTypeEnum('allowed_session_types').array(),
    allowedTechniqueTypes: techniqueTypeEnum('allowed_technique_types').array(),
    excludedJoints: bodyJointEnum('excluded_joints').array(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedById: uuid('revoked_by_id'),
    revokedReason: text('revoked_reason'),
    isActive: boolean('is_active').notNull().default(sql.raw('true')),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'medical_clearances_check',
      sql.raw('((valid_until IS NULL) OR (valid_until > valid_from))'),
    ),
    check(
      'ck_clearance_revocation',
      sql.raw(
        "(((status = 'REVOKED'::clearance_status) AND (revoked_at IS NOT NULL) AND (revoked_by_id IS NOT NULL) AND (NULLIF(btrim(revoked_reason), ''::text) IS NOT NULL)) OR ((status <> 'REVOKED'::clearance_status) AND (revoked_at IS NULL) AND (revoked_by_id IS NULL) AND (revoked_reason IS NULL)))",
      ),
    ),
    primaryKey({ name: 'medical_clearances_pkey', columns: [t.id] }),
    foreignKey({
      name: 'medical_clearances_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'medical_clearances_issued_by_id_fkey',
      columns: [t.issuedById],
      foreignColumns: [sportsDoctors.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'medical_clearances_revoked_by_id_fkey',
      columns: [t.revokedById],
      foreignColumns: [sportsDoctors.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('idx_clearance_fighter_valid').using(
      'btree',
      t.fighterId,
      t.validFrom,
    ),
  ],
).enableRLS();

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    userId: uuid('user_id').notNull(),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    payload: jsonb('payload').notNull().default(sql.raw("'{}'::jsonb")),
    isRead: boolean('is_read').notNull().default(sql.raw('false')),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'ck_notification_read',
      sql.raw(
        '((is_read = (read_at IS NOT NULL)) AND ((read_at IS NULL) OR (read_at >= created_at)))',
      ),
    ),
    check(
      'ck_notification_payload',
      sql.raw("(jsonb_typeof(payload) = 'object'::text)"),
    ),
    primaryKey({ name: 'notifications_pkey', columns: [t.id] }),
    foreignKey({
      name: 'notifications_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('idx_notifications_user_unread')
      .using('btree', t.userId, t.createdAt)
      .where(sql.raw('(is_read = false)')),
  ],
).enableRLS();

export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    code: text('code').notNull(),
    name: text('name').notNull(),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    primaryKey({ name: 'permissions_pkey', columns: [t.id] }),
    unique('permissions_code_key').on(t.code),
  ],
).enableRLS();

export const recoveryPlans = pgTable(
  'recovery_plans',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    fighterId: uuid('fighter_id').notNull(),
    injuryId: uuid('injury_id').notNull(),
    doctorId: uuid('doctor_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    startDate: date('start_date').notNull(),
    estimatedEndDate: date('estimated_end_date'),
    actualEndDate: date('actual_end_date'),
    status: recoveryPlanStatusEnum('status')
      .notNull()
      .default(sql.raw("'ACTIVE'::recovery_plan_status")),
    milestones: jsonb('milestones').notNull().default(sql.raw("'[]'::jsonb")),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'ck_recovery_dates',
      sql.raw(
        '(((estimated_end_date IS NULL) OR (estimated_end_date >= start_date)) AND ((actual_end_date IS NULL) OR (actual_end_date >= start_date)))',
      ),
    ),
    check(
      'ck_recovery_completion',
      sql.raw(
        "((status = 'COMPLETED'::recovery_plan_status) = (actual_end_date IS NOT NULL))",
      ),
    ),
    check(
      'ck_recovery_milestones',
      sql.raw("(jsonb_typeof(milestones) = 'array'::text)"),
    ),
    primaryKey({ name: 'recovery_plans_pkey', columns: [t.id] }),
    foreignKey({
      name: 'recovery_plans_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'recovery_plans_injury_id_fkey',
      columns: [t.injuryId],
      foreignColumns: [injuryRecords.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'recovery_plans_doctor_id_fkey',
      columns: [t.doctorId],
      foreignColumns: [sportsDoctors.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_recovery_injury_fighter',
      columns: [t.injuryId, t.fighterId],
      foreignColumns: [injuryRecords.id, injuryRecords.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('idx_recovery_fighter').using('btree', t.fighterId, t.startDate),
  ],
).enableRLS();

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    role: userRoleEnum('role').notNull(),
    permissionId: uuid('permission_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    primaryKey({ name: 'role_permissions_pkey', columns: [t.id] }),
    unique('uq_role_permission').on(t.role, t.permissionId),
    foreignKey({
      name: 'role_permissions_permission_id_fkey',
      columns: [t.permissionId],
      foreignColumns: [permissions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
  ],
).enableRLS();

export const roundSummaries = pgTable(
  'round_summaries',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    roundId: uuid('round_id').notNull(),
    sessionId: uuid('session_id').notNull(),
    fighterId: uuid('fighter_id').notNull(),
    analysisId: uuid('analysis_id').notNull(),
    totalStrikes: integer('total_strikes').notNull().default(sql.raw('0')),
    totalPunches: integer('total_punches').notNull().default(sql.raw('0')),
    totalKicks: integer('total_kicks').notNull().default(sql.raw('0')),
    totalFeints: integer('total_feints').notNull().default(sql.raw('0')),
    avgStrikeScore: doublePrecision('avg_strike_score'),
    bestStrikeScore: smallint('best_strike_score'),
    perfectCount: integer('perfect_count').notNull().default(sql.raw('0')),
    goodCount: integer('good_count').notNull().default(sql.raw('0')),
    fairCount: integer('fair_count').notNull().default(sql.raw('0')),
    needsWorkCount: integer('needs_work_count').notNull().default(sql.raw('0')),
    avgRomRatio: doublePrecision('avg_rom_ratio'),
    avgPeakSpeedNorm: doublePrecision('avg_peak_speed_norm'),
    avgElbowAngleDeg: doublePrecision('avg_elbow_angle_deg'),
    guardDropCount: integer('guard_drop_count').notNull().default(sql.raw('0')),
    guardRetentionRate: doublePrecision('guard_retention_rate'),
    healthAlertCount: integer('health_alert_count')
      .notNull()
      .default(sql.raw('0')),
    suspectedJointCount: integer('suspected_joint_count')
      .notNull()
      .default(sql.raw('0')),
    dominantMotionClass: motionClassEnum('dominant_motion_class'),
    powerStrikeRatio: doublePrecision('power_strike_ratio'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    algorithmConfigId: uuid('algorithm_config_id').notNull(),
  },
  (t): PgTableExtraConfigValue[] => [
    unique('uq_summary_analysis_round').on(t.analysisId, t.roundId),
    foreignKey({
      name: 'round_summaries_round_id_fkey',
      columns: [t.roundId],
      foreignColumns: [sessionRounds.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'round_summaries_total_strikes_check',
      sql.raw('(total_strikes >= 0)'),
    ),
    check(
      'round_summaries_total_punches_check',
      sql.raw('(total_punches >= 0)'),
    ),
    check('round_summaries_total_kicks_check', sql.raw('(total_kicks >= 0)')),
    check('round_summaries_total_feints_check', sql.raw('(total_feints >= 0)')),
    check(
      'round_summaries_avg_strike_score_check',
      sql.raw(
        '((avg_strike_score >= (0)::double precision) AND (avg_strike_score <= (100)::double precision))',
      ),
    ),
    check(
      'round_summaries_best_strike_score_check',
      sql.raw('((best_strike_score >= 0) AND (best_strike_score <= 100))'),
    ),
    check(
      'round_summaries_perfect_count_check',
      sql.raw('(perfect_count >= 0)'),
    ),
    check('round_summaries_good_count_check', sql.raw('(good_count >= 0)')),
    check('round_summaries_fair_count_check', sql.raw('(fair_count >= 0)')),
    check(
      'round_summaries_needs_work_count_check',
      sql.raw('(needs_work_count >= 0)'),
    ),
    check(
      'round_summaries_avg_rom_ratio_check',
      sql.raw('(avg_rom_ratio >= (0)::double precision)'),
    ),
    check(
      'round_summaries_avg_peak_speed_norm_check',
      sql.raw('(avg_peak_speed_norm >= (0)::double precision)'),
    ),
    primaryKey({ name: 'round_summaries_pkey', columns: [t.id] }),
    check(
      'round_summaries_avg_elbow_angle_deg_check',
      sql.raw(
        '((avg_elbow_angle_deg >= (0)::double precision) AND (avg_elbow_angle_deg <= (180)::double precision))',
      ),
    ),
    check(
      'round_summaries_guard_drop_count_check',
      sql.raw('(guard_drop_count >= 0)'),
    ),
    check(
      'round_summaries_guard_retention_rate_check',
      sql.raw(
        '((guard_retention_rate >= (0)::double precision) AND (guard_retention_rate <= (100)::double precision))',
      ),
    ),
    check(
      'round_summaries_health_alert_count_check',
      sql.raw('(health_alert_count >= 0)'),
    ),
    check(
      'round_summaries_suspected_joint_count_check',
      sql.raw('(suspected_joint_count >= 0)'),
    ),
    check(
      'round_summaries_power_strike_ratio_check',
      sql.raw(
        '((power_strike_ratio >= (0.0)::double precision) AND (power_strike_ratio <= (1.0)::double precision))',
      ),
    ),
    foreignKey({
      name: 'round_summaries_session_id_fkey',
      columns: [t.sessionId],
      foreignColumns: [trainingSessions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'round_summaries_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'round_summaries_analysis_id_fkey',
      columns: [t.analysisId],
      foreignColumns: [aiAnalyses.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'round_summaries_algorithm_config_id_fkey',
      columns: [t.algorithmConfigId],
      foreignColumns: [algorithmConfigs.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_round_summaries_analysis',
      columns: [t.analysisId, t.fighterId, t.algorithmConfigId],
      foreignColumns: [
        aiAnalyses.id,
        aiAnalyses.fighterId,
        aiAnalyses.algorithmConfigId,
      ],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_round_summaries_session',
      columns: [t.sessionId, t.fighterId],
      foreignColumns: [trainingSessions.id, trainingSessions.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_round_summaries_analysis_session',
      columns: [t.analysisId, t.sessionId],
      foreignColumns: [aiAnalyses.id, aiAnalyses.sessionId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_summary_round_session',
      columns: [t.roundId, t.sessionId],
      foreignColumns: [sessionRounds.id, sessionRounds.sessionId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'ck_round_summaries_finite',
      sql.raw(
        "(((avg_strike_score IS NULL) OR ((avg_strike_score > '-Infinity'::double precision) AND (avg_strike_score < 'Infinity'::double precision))) AND ((avg_rom_ratio IS NULL) OR ((avg_rom_ratio > '-Infinity'::double precision) AND (avg_rom_ratio < 'Infinity'::double precision))) AND ((avg_peak_speed_norm IS NULL) OR ((avg_peak_speed_norm > '-Infinity'::double precision) AND (avg_peak_speed_norm < 'Infinity'::double precision))) AND ((avg_elbow_angle_deg IS NULL) OR ((avg_elbow_angle_deg > '-Infinity'::double precision) AND (avg_elbow_angle_deg < 'Infinity'::double precision))) AND ((guard_retention_rate IS NULL) OR ((guard_retention_rate > '-Infinity'::double precision) AND (guard_retention_rate < 'Infinity'::double precision))) AND ((power_strike_ratio IS NULL) OR ((power_strike_ratio > '-Infinity'::double precision) AND (power_strike_ratio < 'Infinity'::double precision))))",
      ),
    ),
  ],
).enableRLS();

export const sessionExercises = pgTable(
  'session_exercises',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    sessionId: uuid('session_id').notNull(),
    exerciseId: uuid('exercise_id').notNull(),
    orderIndex: integer('order_index').notNull(),
    sets: integer('sets'),
    reps: integer('reps'),
    durationSeconds: integer('duration_seconds'),
    targetRpe: smallint('target_rpe'),
    coachNotes: text('coach_notes'),
    exerciseNameSnapshot: text('exercise_name_snapshot').notNull(),
    exerciseInstructionsSnapshot: text('exercise_instructions_snapshot'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    check('session_exercises_reps_check', sql.raw('(reps > 0)')),
    check('session_exercises_order_index_check', sql.raw('(order_index >= 0)')),
    check('session_exercises_sets_check', sql.raw('(sets > 0)')),
    check(
      'session_exercises_duration_seconds_check',
      sql.raw('(duration_seconds > 0)'),
    ),
    check(
      'session_exercises_target_rpe_check',
      sql.raw('((target_rpe >= 1) AND (target_rpe <= 10))'),
    ),
    primaryKey({ name: 'session_exercises_pkey', columns: [t.id] }),
    unique('uq_session_exercise_order').on(t.sessionId, t.orderIndex),
    foreignKey({
      name: 'session_exercises_session_id_fkey',
      columns: [t.sessionId],
      foreignColumns: [trainingSessions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'session_exercises_exercise_id_fkey',
      columns: [t.exerciseId],
      foreignColumns: [exercises.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
  ],
).enableRLS();

export const sessionRounds = pgTable(
  'session_rounds',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    sessionId: uuid('session_id').notNull(),
    roundNumber: smallint('round_number').notNull(),
    plannedDurationSec: integer('planned_duration_sec'),
    targetRpe: smallint('target_rpe'),
    actualRpe: smallint('actual_rpe'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'session_rounds_round_number_check',
      sql.raw('((round_number >= 1) AND (round_number <= 30))'),
    ),
    check(
      'session_rounds_planned_duration_sec_check',
      sql.raw('(planned_duration_sec > 0)'),
    ),
    check(
      'session_rounds_target_rpe_check',
      sql.raw('((target_rpe >= 1) AND (target_rpe <= 10))'),
    ),
    check(
      'session_rounds_actual_rpe_check',
      sql.raw('((actual_rpe >= 1) AND (actual_rpe <= 10))'),
    ),
    primaryKey({ name: 'session_rounds_pkey', columns: [t.id] }),
    unique('uq_session_round_number').on(t.sessionId, t.roundNumber),
    unique('uq_round_session').on(t.id, t.sessionId),
    foreignKey({
      name: 'session_rounds_session_id_fkey',
      columns: [t.sessionId],
      foreignColumns: [trainingSessions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
  ],
).enableRLS();

export const sessionSummaries = pgTable(
  'session_summaries',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    sessionId: uuid('session_id').notNull(),
    fighterId: uuid('fighter_id').notNull(),
    analysisId: uuid('analysis_id').notNull(),
    algorithmConfigId: uuid('algorithm_config_id').notNull(),
    totalRounds: smallint('total_rounds').notNull().default(sql.raw('0')),
    totalStrikes: integer('total_strikes').notNull().default(sql.raw('0')),
    totalPunches: integer('total_punches').notNull().default(sql.raw('0')),
    totalKicks: integer('total_kicks').notNull().default(sql.raw('0')),
    avgSessionScore: doublePrecision('avg_session_score'),
    bestStrikeScore: smallint('best_strike_score'),
    avgRomRatio: doublePrecision('avg_rom_ratio'),
    avgPeakSpeedNorm: doublePrecision('avg_peak_speed_norm'),
    impairmentDetected: boolean('impairment_detected')
      .notNull()
      .default(sql.raw('false')),
    confirmedAlertCount: integer('confirmed_alert_count')
      .notNull()
      .default(sql.raw('0')),
    jointStates: jsonb('joint_states')
      .notNull()
      .default(sql.raw("'{}'::jsonb")),
    scoreDelta: doublePrecision('score_delta'),
    romDelta: doublePrecision('rom_delta'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'session_summaries_total_rounds_check',
      sql.raw('(total_rounds >= 0)'),
    ),
    check(
      'session_summaries_total_strikes_check',
      sql.raw('(total_strikes >= 0)'),
    ),
    check(
      'session_summaries_total_punches_check',
      sql.raw('(total_punches >= 0)'),
    ),
    check('session_summaries_total_kicks_check', sql.raw('(total_kicks >= 0)')),
    check(
      'session_summaries_avg_session_score_check',
      sql.raw(
        '((avg_session_score >= (0)::double precision) AND (avg_session_score <= (100)::double precision))',
      ),
    ),
    check(
      'session_summaries_best_strike_score_check',
      sql.raw('((best_strike_score >= 0) AND (best_strike_score <= 100))'),
    ),
    check(
      'session_summaries_avg_rom_ratio_check',
      sql.raw('(avg_rom_ratio >= (0)::double precision)'),
    ),
    check(
      'session_summaries_confirmed_alert_count_check',
      sql.raw('(confirmed_alert_count >= 0)'),
    ),
    check(
      'ck_summary_states',
      sql.raw("(jsonb_typeof(joint_states) = 'object'::text)"),
    ),
    primaryKey({ name: 'session_summaries_pkey', columns: [t.id] }),
    unique('uq_summary_analysis').on(t.analysisId),
    foreignKey({
      name: 'session_summaries_session_id_fkey',
      columns: [t.sessionId],
      foreignColumns: [trainingSessions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'session_summaries_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'session_summaries_analysis_id_fkey',
      columns: [t.analysisId],
      foreignColumns: [aiAnalyses.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'session_summaries_algorithm_config_id_fkey',
      columns: [t.algorithmConfigId],
      foreignColumns: [algorithmConfigs.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_session_summaries_analysis',
      columns: [t.analysisId, t.fighterId, t.algorithmConfigId],
      foreignColumns: [
        aiAnalyses.id,
        aiAnalyses.fighterId,
        aiAnalyses.algorithmConfigId,
      ],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_session_summaries_session',
      columns: [t.sessionId, t.fighterId],
      foreignColumns: [trainingSessions.id, trainingSessions.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_session_summaries_analysis_session',
      columns: [t.analysisId, t.sessionId],
      foreignColumns: [aiAnalyses.id, aiAnalyses.sessionId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'ck_session_summaries_finite',
      sql.raw(
        "(((avg_session_score IS NULL) OR ((avg_session_score > '-Infinity'::double precision) AND (avg_session_score < 'Infinity'::double precision))) AND ((avg_rom_ratio IS NULL) OR ((avg_rom_ratio > '-Infinity'::double precision) AND (avg_rom_ratio < 'Infinity'::double precision))) AND ((avg_peak_speed_norm IS NULL) OR ((avg_peak_speed_norm > '-Infinity'::double precision) AND (avg_peak_speed_norm < 'Infinity'::double precision))) AND ((score_delta IS NULL) OR ((score_delta > '-Infinity'::double precision) AND (score_delta < 'Infinity'::double precision))) AND ((rom_delta IS NULL) OR ((rom_delta > '-Infinity'::double precision) AND (rom_delta < 'Infinity'::double precision))))",
      ),
    ),
    index('idx_summary_fighter_session').using(
      'btree',
      t.fighterId,
      t.sessionId,
    ),
  ],
).enableRLS();

export const sportsDoctors = pgTable(
  'sports_doctors',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    userId: uuid('user_id').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    licenseNumber: text('license_number').notNull(),
    specialization: text('specialization'),
    profileImageUrl: text('profile_image_url'),
    isActive: boolean('is_active').notNull().default(sql.raw('true')),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    profileRole: userRoleEnum('profile_role')
      .notNull()
      .default(sql.raw("'DOCTOR'::user_role")),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'sports_doctors_profile_role_check',
      sql.raw("(profile_role = 'DOCTOR'::user_role)"),
    ),
    primaryKey({ name: 'sports_doctors_pkey', columns: [t.id] }),
    unique('sports_doctors_user_id_key').on(t.userId),
    unique('sports_doctors_license_number_key').on(t.licenseNumber),
    foreignKey({
      name: 'sports_doctors_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_sports_doctors_role',
      columns: [t.userId, t.profileRole],
      foreignColumns: [users.id, users.role],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
  ],
).enableRLS();

export const techniqueEvents = pgTable(
  'technique_events',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    analysisId: uuid('analysis_id').notNull(),
    fighterId: uuid('fighter_id').notNull(),
    sessionId: uuid('session_id'),
    roundId: uuid('round_id'),
    videoId: uuid('video_id'),
    algorithmConfigId: uuid('algorithm_config_id').notNull(),
    techniqueType: techniqueTypeEnum('technique_type').notNull(),
    limbSide: limbSideEnum('limb_side').notNull(),
    startTimeMs: doublePrecision('start_time_ms').notNull(),
    impactTimeMs: doublePrecision('impact_time_ms').notNull(),
    endTimeMs: doublePrecision('end_time_ms').notNull(),
    startFrame: integer('start_frame'),
    impactFrame: integer('impact_frame'),
    endFrame: integer('end_frame'),
    score: smallint('score'),
    grade: text('grade'),
    maxElbowAngleDeg: doublePrecision('max_elbow_angle_deg'),
    minChamberAngleDeg: doublePrecision('min_chamber_angle_deg'),
    maxExtensionAngleDeg: doublePrecision('max_extension_angle_deg'),
    peakSpeedNorm: doublePrecision('peak_speed_norm'),
    guardPreserved: boolean('guard_preserved')
      .notNull()
      .default(sql.raw('true')),
    isFeint: boolean('is_feint').notNull().default(sql.raw('false')),
    motionClass: motionClassEnum('motion_class')
      .notNull()
      .default(sql.raw("'UNKNOWN'::motion_class")),
    mahalanobisDist: doublePrecision('mahalanobis_dist'),
    reconstructionError: doublePrecision('reconstruction_error'),
    romRatio: doublePrecision('rom_ratio'),
    baselineId: uuid('baseline_id'),
    eventAt: timestamp('event_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    speedUnit: text('speed_unit'),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'technique_events_start_time_ms_check',
      sql.raw('(start_time_ms >= (0)::double precision)'),
    ),
    check(
      'technique_events_check',
      sql.raw('(impact_time_ms >= start_time_ms)'),
    ),
    check(
      'technique_events_check1',
      sql.raw('(end_time_ms >= impact_time_ms)'),
    ),
    check('technique_events_start_frame_check', sql.raw('(start_frame >= 0)')),
    check('technique_events_check2', sql.raw('(impact_frame >= start_frame)')),
    check('technique_events_check3', sql.raw('(end_frame >= impact_frame)')),
    check(
      'technique_events_score_check',
      sql.raw('((score >= 0) AND (score <= 100))'),
    ),
    check(
      'technique_events_grade_check',
      sql.raw(
        "(grade = ANY (ARRAY['PERFECT'::text, 'GOOD'::text, 'FAIR'::text, 'NEEDS_WORK'::text]))",
      ),
    ),
    check(
      'technique_events_max_elbow_angle_deg_check',
      sql.raw(
        '((max_elbow_angle_deg >= (0)::double precision) AND (max_elbow_angle_deg <= (180)::double precision))',
      ),
    ),
    check(
      'technique_events_min_chamber_angle_deg_check',
      sql.raw(
        '((min_chamber_angle_deg >= (0)::double precision) AND (min_chamber_angle_deg <= (180)::double precision))',
      ),
    ),
    check(
      'technique_events_max_extension_angle_deg_check',
      sql.raw(
        '((max_extension_angle_deg >= (0)::double precision) AND (max_extension_angle_deg <= (180)::double precision))',
      ),
    ),
    check(
      'technique_events_peak_speed_norm_check',
      sql.raw('(peak_speed_norm >= (0)::double precision)'),
    ),
    check(
      'technique_events_mahalanobis_dist_check',
      sql.raw('(mahalanobis_dist >= (0)::double precision)'),
    ),
    check(
      'technique_events_reconstruction_error_check',
      sql.raw('(reconstruction_error >= (0)::double precision)'),
    ),
    check(
      'technique_events_rom_ratio_check',
      sql.raw('(rom_ratio >= (0)::double precision)'),
    ),
    check(
      'ck_event_frames',
      sql.raw(
        '(((start_frame IS NULL) AND (impact_frame IS NULL) AND (end_frame IS NULL)) OR ((start_frame IS NOT NULL) AND (impact_frame IS NOT NULL) AND (end_frame IS NOT NULL)))',
      ),
    ),
    check(
      'ck_event_speed_unit',
      sql.raw('((peak_speed_norm IS NULL) = (speed_unit IS NULL))'),
    ),
    check(
      'ck_technique_events_round_context',
      sql.raw('((round_id IS NULL) OR (session_id IS NOT NULL))'),
    ),
    primaryKey({ name: 'technique_events_pkey', columns: [t.id] }),
    unique('uq_event_context').on(t.id, t.analysisId, t.fighterId),
    unique('uq_event_fighter').on(t.id, t.fighterId),
    foreignKey({
      name: 'technique_events_analysis_id_fkey',
      columns: [t.analysisId],
      foreignColumns: [aiAnalyses.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'technique_events_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'technique_events_session_id_fkey',
      columns: [t.sessionId],
      foreignColumns: [trainingSessions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'technique_events_round_id_fkey',
      columns: [t.roundId],
      foreignColumns: [sessionRounds.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'technique_events_video_id_fkey',
      columns: [t.videoId],
      foreignColumns: [videos.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'technique_events_algorithm_config_id_fkey',
      columns: [t.algorithmConfigId],
      foreignColumns: [algorithmConfigs.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'technique_events_baseline_id_fkey',
      columns: [t.baselineId],
      foreignColumns: [fighterBaselines.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_technique_events_analysis',
      columns: [t.analysisId, t.fighterId, t.algorithmConfigId],
      foreignColumns: [
        aiAnalyses.id,
        aiAnalyses.fighterId,
        aiAnalyses.algorithmConfigId,
      ],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_technique_events_session',
      columns: [t.sessionId, t.fighterId],
      foreignColumns: [trainingSessions.id, trainingSessions.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_technique_events_analysis_session',
      columns: [t.analysisId, t.sessionId],
      foreignColumns: [aiAnalyses.id, aiAnalyses.sessionId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_technique_events_baseline',
      columns: [t.baselineId, t.fighterId, t.algorithmConfigId],
      foreignColumns: [
        fighterBaselines.id,
        fighterBaselines.fighterId,
        fighterBaselines.algorithmConfigId,
      ],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_technique_events_round',
      columns: [t.roundId, t.sessionId],
      foreignColumns: [sessionRounds.id, sessionRounds.sessionId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_event_video',
      columns: [t.analysisId, t.videoId],
      foreignColumns: [aiAnalyses.id, aiAnalyses.videoId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'ck_technique_events_finite',
      sql.raw(
        "(((start_time_ms IS NULL) OR ((start_time_ms > '-Infinity'::double precision) AND (start_time_ms < 'Infinity'::double precision))) AND ((impact_time_ms IS NULL) OR ((impact_time_ms > '-Infinity'::double precision) AND (impact_time_ms < 'Infinity'::double precision))) AND ((end_time_ms IS NULL) OR ((end_time_ms > '-Infinity'::double precision) AND (end_time_ms < 'Infinity'::double precision))) AND ((max_elbow_angle_deg IS NULL) OR ((max_elbow_angle_deg > '-Infinity'::double precision) AND (max_elbow_angle_deg < 'Infinity'::double precision))) AND ((min_chamber_angle_deg IS NULL) OR ((min_chamber_angle_deg > '-Infinity'::double precision) AND (min_chamber_angle_deg < 'Infinity'::double precision))) AND ((max_extension_angle_deg IS NULL) OR ((max_extension_angle_deg > '-Infinity'::double precision) AND (max_extension_angle_deg < 'Infinity'::double precision))) AND ((peak_speed_norm IS NULL) OR ((peak_speed_norm > '-Infinity'::double precision) AND (peak_speed_norm < 'Infinity'::double precision))) AND ((mahalanobis_dist IS NULL) OR ((mahalanobis_dist > '-Infinity'::double precision) AND (mahalanobis_dist < 'Infinity'::double precision))) AND ((reconstruction_error IS NULL) OR ((reconstruction_error > '-Infinity'::double precision) AND (reconstruction_error < 'Infinity'::double precision))) AND ((rom_ratio IS NULL) OR ((rom_ratio > '-Infinity'::double precision) AND (rom_ratio < 'Infinity'::double precision))))",
      ),
    ),
    index('idx_events_analysis_time').using(
      'btree',
      t.analysisId,
      t.startTimeMs,
    ),
  ],
).enableRLS();

export const trainingPlanExercises = pgTable(
  'training_plan_exercises',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    planId: uuid('plan_id').notNull(),
    exerciseId: uuid('exercise_id').notNull(),
    orderIndex: integer('order_index').notNull(),
    sets: integer('sets'),
    reps: integer('reps'),
    durationSeconds: integer('duration_seconds'),
    targetRpe: smallint('target_rpe'),
    coachNotes: text('coach_notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'training_plan_exercises_order_index_check',
      sql.raw('(order_index >= 0)'),
    ),
    check('training_plan_exercises_sets_check', sql.raw('(sets > 0)')),
    check('training_plan_exercises_reps_check', sql.raw('(reps > 0)')),
    check(
      'training_plan_exercises_duration_seconds_check',
      sql.raw('(duration_seconds > 0)'),
    ),
    check(
      'training_plan_exercises_target_rpe_check',
      sql.raw('((target_rpe >= 1) AND (target_rpe <= 10))'),
    ),
    primaryKey({ name: 'training_plan_exercises_pkey', columns: [t.id] }),
    unique('uq_plan_exercise_order').on(t.planId, t.orderIndex),
    foreignKey({
      name: 'training_plan_exercises_plan_id_fkey',
      columns: [t.planId],
      foreignColumns: [trainingPlans.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'training_plan_exercises_exercise_id_fkey',
      columns: [t.exerciseId],
      foreignColumns: [exercises.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
  ],
).enableRLS();

export const trainingPlans = pgTable(
  'training_plans',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    fighterId: uuid('fighter_id').notNull(),
    coachId: uuid('coach_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    status: trainingPlanStatusEnum('status')
      .notNull()
      .default(sql.raw("'DRAFT'::training_plan_status")),
    goals: text('goals'),
    isActive: boolean('is_active').notNull().default(sql.raw('true')),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'training_plans_check',
      sql.raw('((end_date IS NULL) OR (end_date >= start_date))'),
    ),
    primaryKey({ name: 'training_plans_pkey', columns: [t.id] }),
    unique('uq_plan_fighter').on(t.id, t.fighterId),
    foreignKey({
      name: 'training_plans_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'training_plans_coach_id_fkey',
      columns: [t.coachId],
      foreignColumns: [coaches.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('idx_plan_fighter').using('btree', t.fighterId, t.startDate),
  ],
).enableRLS();

export const trainingSessions = pgTable(
  'training_sessions',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    fighterId: uuid('fighter_id').notNull(),
    coachId: uuid('coach_id'),
    planId: uuid('plan_id'),
    title: text('title').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    plannedDurationSec: integer('planned_duration_sec'),
    actualDurationSec: integer('actual_duration_sec'),
    roundCount: smallint('round_count').notNull().default(sql.raw('0')),
    location: text('location'),
    sessionType: sessionTypeEnum('session_type').notNull(),
    status: sessionStatusEnum('status')
      .notNull()
      .default(sql.raw("'SCHEDULED'::session_status")),
    coachNotes: text('coach_notes'),
    cancellationReason: text('cancellation_reason'),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    abandonedAt: timestamp('abandoned_at', { withTimezone: true }),
    skippedAt: timestamp('skipped_at', { withTimezone: true }),
    reportedRpe: smallint('reported_rpe'),
    isActive: boolean('is_active').notNull().default(sql.raw('true')),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'training_sessions_planned_duration_sec_check',
      sql.raw('(planned_duration_sec > 0)'),
    ),
    check(
      'training_sessions_actual_duration_sec_check',
      sql.raw('(actual_duration_sec > 0)'),
    ),
    check('training_sessions_round_count_check', sql.raw('(round_count >= 0)')),
    check(
      'training_sessions_reported_rpe_check',
      sql.raw('((reported_rpe >= 1) AND (reported_rpe <= 10))'),
    ),
    check(
      'ck_session_lifecycle',
      sql.raw(
        "(((status = 'COMPLETED'::session_status) = (completed_at IS NOT NULL)) AND ((status = 'ABANDONED'::session_status) = (abandoned_at IS NOT NULL)) AND ((status = 'SKIPPED'::session_status) = (skipped_at IS NOT NULL)) AND ((status = 'CANCELLED'::session_status) = (cancelled_at IS NOT NULL)) AND ((status <> 'IN_PROGRESS'::session_status) OR (checked_in_at IS NOT NULL)))",
      ),
    ),
    check(
      'ck_session_time_order',
      sql.raw(
        '(COALESCE(completed_at, abandoned_at, cancelled_at, skipped_at) >= checked_in_at)',
      ),
    ),
    primaryKey({ name: 'training_sessions_pkey', columns: [t.id] }),
    unique('uq_session_fighter').on(t.id, t.fighterId),
    foreignKey({
      name: 'training_sessions_fighter_id_fkey',
      columns: [t.fighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'training_sessions_coach_id_fkey',
      columns: [t.coachId],
      foreignColumns: [coaches.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'training_sessions_plan_id_fkey',
      columns: [t.planId],
      foreignColumns: [trainingPlans.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_session_plan_fighter',
      columns: [t.planId, t.fighterId],
      foreignColumns: [trainingPlans.id, trainingPlans.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('idx_session_coach_schedule').using(
      'btree',
      t.coachId,
      t.scheduledAt,
    ),
    index('idx_session_fighter_schedule').using(
      'btree',
      t.fighterId,
      t.scheduledAt,
    ),
  ],
).enableRLS();

export const treatments = pgTable(
  'treatments',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    injuryId: uuid('injury_id').notNull(),
    doctorId: uuid('doctor_id').notNull(),
    treatmentDate: timestamp('treatment_date', {
      withTimezone: true,
    }).notNull(),
    treatmentType: text('treatment_type').notNull(),
    description: text('description'),
    outcomeNotes: text('outcome_notes'),
    nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    primaryKey({ name: 'treatments_pkey', columns: [t.id] }),
    foreignKey({
      name: 'treatments_injury_id_fkey',
      columns: [t.injuryId],
      foreignColumns: [injuryRecords.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'treatments_doctor_id_fkey',
      columns: [t.doctorId],
      foreignColumns: [sportsDoctors.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'ck_treatment_followup',
      sql.raw(
        '((next_review_at IS NULL) OR (next_review_at >= treatment_date))',
      ),
    ),
    index('idx_treatment_injury_date').using(
      'btree',
      t.injuryId,
      t.treatmentDate,
    ),
  ],
).enableRLS();

export const userPermissions = pgTable(
  'user_permissions',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    userId: uuid('user_id').notNull(),
    permissionId: uuid('permission_id').notNull(),
    isGranted: boolean('is_granted').notNull().default(sql.raw('true')),
    grantedBy: uuid('granted_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    primaryKey({ name: 'user_permissions_pkey', columns: [t.id] }),
    unique('uq_user_permission').on(t.userId, t.permissionId),
    foreignKey({
      name: 'user_permissions_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'user_permissions_permission_id_fkey',
      columns: [t.permissionId],
      foreignColumns: [permissions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'user_permissions_granted_by_fkey',
      columns: [t.grantedBy],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
  ],
).enableRLS();

export const users = pgTable(
  'users',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    email: text('email').notNull(),
    authUserId: uuid('auth_user_id').notNull(),
    role: userRoleEnum('role').notNull(),
    isActive: boolean('is_active').notNull().default(sql.raw('true')),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'users_email_check',
      sql.raw('((email = lower(btrim(email))) AND (length(email) > 3))'),
    ),
    primaryKey({ name: 'users_pkey', columns: [t.id] }),
    unique('users_auth_user_id_key').on(t.authUserId),
    unique('uq_users_email').on(t.email),
    unique('uq_users_id_role').on(t.id, t.role),
    foreignKey({
      name: 'users_auth_user_id_fkey',
      columns: [t.authUserId],
      foreignColumns: [authUsers.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
  ],
).enableRLS();

export const videoRoundSegments = pgTable(
  'video_round_segments',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    videoId: uuid('video_id').notNull(),
    roundId: uuid('round_id').notNull(),
    sessionId: uuid('session_id').notNull(),
    startTimeMs: integer('start_time_ms').notNull(),
    endTimeMs: integer('end_time_ms').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
  },
  (t): PgTableExtraConfigValue[] => [
    check(
      'video_round_segments_start_time_ms_check',
      sql.raw('(start_time_ms >= 0)'),
    ),
    check(
      'video_round_segments_check',
      sql.raw('(end_time_ms > start_time_ms)'),
    ),
    primaryKey({ name: 'video_round_segments_pkey', columns: [t.id] }),
    unique('uq_video_round').on(t.videoId, t.roundId),
    foreignKey({
      name: 'video_round_segments_video_id_fkey',
      columns: [t.videoId],
      foreignColumns: [videos.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'video_round_segments_round_id_fkey',
      columns: [t.roundId],
      foreignColumns: [sessionRounds.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'video_round_segments_session_id_fkey',
      columns: [t.sessionId],
      foreignColumns: [trainingSessions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_segment_video_session',
      columns: [t.videoId, t.sessionId],
      foreignColumns: [videos.id, videos.sessionId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_segment_round_session',
      columns: [t.roundId, t.sessionId],
      foreignColumns: [sessionRounds.id, sessionRounds.sessionId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
  ],
).enableRLS();

export const videos = pgTable(
  'videos',
  {
    id: uuid('id').notNull().default(sql.raw('gen_random_uuid()')),
    subjectFighterId: uuid('subject_fighter_id').notNull(),
    uploadedById: uuid('uploaded_by_id').notNull(),
    sessionId: uuid('session_id'),
    title: text('title').notNull(),
    description: text('description'),
    storageKey: text('storage_key').notNull(),
    storageBucket: text('storage_bucket').notNull(),
    storageProvider: text('storage_provider').notNull(),
    originalFilename: text('original_filename'),
    codec: text('codec'),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'bigint' }).notNull(),
    mimeType: text('mime_type').notNull(),
    durationMs: integer('duration_ms'),
    fps: doublePrecision('fps'),
    resolutionWidth: integer('resolution_width'),
    resolutionHeight: integer('resolution_height'),
    cameraAngle: cameraAngleEnum('camera_angle')
      .notNull()
      .default(sql.raw("'UNKNOWN'::camera_angle")),
    status: videoStatusEnum('status')
      .notNull()
      .default(sql.raw("'PENDING_UPLOAD'::video_status")),
    rejectionReason: text('rejection_reason'),
    thumbnailUrl: text('thumbnail_url'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(sql.raw('true')),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql.raw('now()')),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t): PgTableExtraConfigValue[] => [
    check('videos_file_size_bytes_check', sql.raw('(file_size_bytes > 0)')),
    check('videos_mime_type_check', sql.raw("(mime_type ~~ 'video/%'::text)")),
    check('videos_duration_ms_check', sql.raw('(duration_ms > 0)')),
    check(
      'videos_fps_check',
      sql.raw(
        '((fps > (0)::double precision) AND (fps <= (240)::double precision))',
      ),
    ),
    check('videos_resolution_width_check', sql.raw('(resolution_width > 0)')),
    check('videos_resolution_height_check', sql.raw('(resolution_height > 0)')),
    check(
      'ck_video_storage',
      sql.raw(
        '((length(btrim(storage_provider)) > 0) AND (length(btrim(storage_bucket)) > 0) AND (length(btrim(storage_key)) > 0))',
      ),
    ),
    primaryKey({ name: 'videos_pkey', columns: [t.id] }),
    unique('uq_video_storage').on(
      t.storageProvider,
      t.storageBucket,
      t.storageKey,
    ),
    unique('uq_video_fighter').on(t.id, t.subjectFighterId),
    unique('uq_video_session').on(t.id, t.sessionId),
    foreignKey({
      name: 'videos_subject_fighter_id_fkey',
      columns: [t.subjectFighterId],
      foreignColumns: [fighters.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'videos_uploaded_by_id_fkey',
      columns: [t.uploadedById],
      foreignColumns: [users.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'videos_session_id_fkey',
      columns: [t.sessionId],
      foreignColumns: [trainingSessions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'fk_video_session_fighter',
      columns: [t.sessionId, t.subjectFighterId],
      foreignColumns: [trainingSessions.id, trainingSessions.fighterId],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check(
      'ck_videos_finite',
      sql.raw(
        "((fps IS NULL) OR ((fps > '-Infinity'::double precision) AND (fps < 'Infinity'::double precision)))",
      ),
    ),
    index('idx_video_session').using('btree', t.sessionId),
    index('idx_video_fighter_created').using(
      'btree',
      t.subjectFighterId,
      t.createdAt,
    ),
  ],
).enableRLS();

export type AnalysisJob = typeof analysisJobs.$inferSelect;
export type InsertAnalysisJob = typeof analysisJobs.$inferInsert;

export type DatasetExportCandidate = typeof datasetExportCandidates.$inferSelect;
export type InsertDatasetExportCandidate = typeof datasetExportCandidates.$inferInsert;

export type DatasetReview = typeof datasetReviews.$inferSelect;
export type InsertDatasetReview = typeof datasetReviews.$inferInsert;

export type DatasetQualityReport = typeof datasetQualityReports.$inferSelect;
export type InsertDatasetQualityReport = typeof datasetQualityReports.$inferInsert;

export type DatasetAttestation = typeof datasetAttestations.$inferSelect;
export type InsertDatasetAttestation = typeof datasetAttestations.$inferInsert;

export type AttestationNonce = typeof attestationNonces.$inferSelect;
export type InsertAttestationNonce = typeof attestationNonces.$inferInsert;

export type DatasetAttestationAudit = typeof datasetAttestationAudit.$inferSelect;
export type InsertDatasetAttestationAudit = typeof datasetAttestationAudit.$inferInsert;

export type DatasetIdempotencyKey = typeof datasetIdempotencyKeys.$inferSelect;
export type InsertDatasetIdempotencyKey = typeof datasetIdempotencyKeys.$inferInsert;
