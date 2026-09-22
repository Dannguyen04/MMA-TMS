import { z } from 'zod';

/** Tên hàng đợi BullMQ dùng chung giữa API và Python worker. */
export const VIDEO_ANALYSIS_QUEUE = 'video-analysis';

const workerHealthAlertSchema = z.strictObject({
  joint: z.string().min(1),
  state: z.literal('CONFIRMED_IMPAIRMENT'),
  severity: z.enum(['medium', 'high', 'critical']),
  triggerTimeMs: z.number().nonnegative(),
  windowStartMs: z.number().nonnegative(),
  consecutiveLowRom: z.number().int().positive(),
  avgRomRatio: z.number().min(0).max(2),
  motionClass: z.enum([
    'TACTICAL_FEINT',
    'POWER_STRIKE',
    'PARTIAL_STRIKE',
    'UNKNOWN',
  ]),
  recommendation: z.string().min(1),
});

export const workerAnalysisResultSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    meta: z.record(z.string(), z.unknown()),
    frames: z.array(z.record(z.string(), z.unknown())),
    summary: z.record(z.string(), z.unknown()),
    kicks: z.array(z.record(z.string(), z.unknown())).optional(),
    punches: z.array(z.record(z.string(), z.unknown())).optional(),
    findings: z.array(z.record(z.string(), z.unknown())).optional(),
    healthAlerts: z.array(workerHealthAlertSchema).optional(),
  })
  .passthrough();

export type WorkerAnalysisResult = z.infer<typeof workerAnalysisResultSchema>;
