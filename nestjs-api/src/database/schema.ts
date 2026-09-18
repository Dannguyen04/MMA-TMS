import {
  pgTable,
  uuid,
  text,
  integer,
  pgEnum,
  timestamp,
  jsonb,
  boolean,
  primaryKey,
} from 'drizzle-orm/pg-core';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const jobStatusEnum = pgEnum('job_status', [
  'PENDING',
  'PROCESSING',
  'DONE',
  'FAILED',
]);

// ─── Health Alert Types (mirror của Python AlertPayload.to_dict()) ────────────

/** Severity của một cảnh báo chấn thương */
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
  joint: string;                  // Vd: "LEFT_SHOULDER"
  state: 'CONFIRMED_IMPAIRMENT';  // Luôn là CONFIRMED_IMPAIRMENT
  severity: AlertSeverity;
  triggerTimeMs: number;          // Thời điểm kích hoạt trong video (ms)
  windowStartMs: number;          // Bắt đầu cửa sổ quan sát (ms)
  consecutiveLowRom: number;      // Số đòn liên tiếp ROM thấp
  avgRomRatio: number;            // ROM trung bình trong cửa sổ (0–1)
  motionClass: MotionClass;
  recommendation: string;         // Lời khuyên coach/fighter
}

/** Snapshot trạng thái tất cả khớp tại cuối session */
export type JointStatesMap = Record<string, JointHealthState>;

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

export const analysisJobs = pgTable('analysis_jobs', {
  id:            uuid('id').primaryKey().defaultRandom(),
  userId:        text('user_id').notNull().default('anonymous'),
  videoUrl:      text('video_url').notNull(),
  status:        jobStatusEnum('status').notNull().default('PENDING'),
  resultUrl:     text('result_url'),
  score:         integer('score'),

  // ── Anomaly Detection fields (Migration 002) ──
  /** Mảng AlertPayload — chỉ chứa CONFIRMED_IMPAIRMENT alerts */
  healthAlerts:  jsonb('health_alerts')
                   .$type<HealthAlert[]>()
                   .notNull()
                   .default([]),
  /** Map JointName → JointHealthState tại cuối session */
  jointStates:   jsonb('joint_states')
                   .$type<JointStatesMap>()
                   .notNull()
                   .default({}),
  /** Cache số alert để sort/filter nhanh (tránh COUNT trên JSONB) */
  alertCount:    integer('alert_count').notNull().default(0),
  /** Flag nhanh cho dashboard — TRUE nếu có ≥1 CONFIRMED_IMPAIRMENT */
  hasImpairment: boolean('has_impairment').notNull().default(false),

  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
});

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
  issuedAt:           timestamp('issued_at', { withTimezone: true }).notNull(),
  expiresAt:          timestamp('expires_at', { withTimezone: true }).notNull(),
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

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type AnalysisJob    = typeof analysisJobs.$inferSelect;
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
