import {
  pgTable,
  uuid,
  text,
  integer,
  pgEnum,
  timestamp,
  jsonb,
  boolean,
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

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type AnalysisJob    = typeof analysisJobs.$inferSelect;
export type InsertAnalysisJob = typeof analysisJobs.$inferInsert;
