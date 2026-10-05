import { z } from 'zod';

export const movementReviewInputSchema = z.object({
    requestId: z.string().uuid(), windowId: z.string().min(1).max(100),
    expectedRevision: z.number().int().nonnegative(),
    decision: z.enum(['confirmed', 'corrected', 'rejected']),
    notes: z.string().trim().min(1).max(2000),
    startMs: z.number().finite().nonnegative().optional(), endMs: z.number().finite().nonnegative().optional(),
}).strict().superRefine((v, ctx) => {
    if (v.decision === 'corrected' ? v.startMs == null || v.endMs == null || v.endMs <= v.startMs : v.startMs != null || v.endMs != null)
        ctx.addIssue({ code: 'custom', message: 'Only a corrected review requires a valid time interval.' });
});
export const movementReviewStateSchema = z.object({
    jobId: z.string().uuid(), reviewerId: z.string().uuid(), canReview: z.boolean(),
    context: z.object({ exerciseName: z.string().nullable(), sessionExerciseId: z.string().uuid().nullable() }).passthrough().nullable(),
    reviews: z.array(z.object({
        id: z.string().uuid(), jobId: z.string().uuid(), windowId: z.string(),
        reviewerId: z.string().uuid(), reviewerRole: z.enum(['COACH', 'DOCTOR']),
        revision: z.number().int().positive(), requestId: z.string().uuid(), evidenceHash: z.string(),
        decision: z.enum(['confirmed', 'corrected', 'rejected']), notes: z.string(),
        startMs: z.number().nullable(), endMs: z.number().nullable(), createdAt: z.string(),
    })),
});
export const movementReviewSavedSchema = z.object({ id: z.string().uuid(), revision: z.number().int().positive(), replayed: z.boolean() });
export const assignedExercisesSchema = z.array(z.object({ id: z.string().uuid(), exerciseId: z.string().uuid(), name: z.string() }));
export type MovementReviewState = z.infer<typeof movementReviewStateSchema>;
