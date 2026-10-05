import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const movementReviewSchema = z.object({
  requestId: z.string().uuid(), windowId: z.string().min(1).max(100),
  expectedRevision: z.number().int().min(0),
  decision: z.enum(['confirmed', 'corrected', 'rejected']),
  notes: z.string().trim().min(1).max(2000),
  startMs: z.number().finite().nonnegative().optional(),
  endMs: z.number().finite().nonnegative().optional(),
}).strict().superRefine((value, ctx) => {
  const corrected = value.decision === 'corrected';
  if (corrected ? value.startMs == null || value.endMs == null || value.endMs <= value.startMs
    : value.startMs != null || value.endMs != null) {
    ctx.addIssue({ code: 'custom', message: 'Only a corrected review requires a valid time interval.' });
  }
});
export class MovementReviewDto extends createZodDto(movementReviewSchema) {}
export class MovementJobParamsDto extends createZodDto(z.object({ jobId: z.string().uuid() })) {}
export class MovementSessionParamsDto extends createZodDto(z.object({ sessionId: z.string().uuid() })) {}
