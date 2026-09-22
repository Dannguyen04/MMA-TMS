import { z } from 'zod';
import { isoDateTimeSchema } from '../shared/utils/zod-schema.util.js';

export const videoTrainingTypes = [
  'SHADOW_BOXING',
  'PAD_WORK',
  'HEAVY_BAG',
  'SPARRING',
] as const;
export const videoCameraAngles = [
  'FRONT',
  'SIDE',
  'DIAGONAL',
  'CORNER',
  'OVERHEAD',
  'UNKNOWN',
] as const;
export const videoStatuses = [
  'PENDING_UPLOAD',
  'UPLOAD_COMPLETE',
  'PROCESSING',
  'PROCESSED',
  'REJECTED',
  'FAILED',
] as const;

export const uploadVideoQuerySchema = z.strictObject({
  fighterId: z.uuid(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2_000).nullable().optional(),
  trainingType: z.enum(videoTrainingTypes),
  cameraAngle: z.enum(videoCameraAngles),
  sessionId: z.uuid().nullable().optional(),
  durationMs: z.coerce
    .number()
    .int()
    .positive()
    .max(24 * 60 * 60 * 1_000),
  originalFilename: z.string().trim().min(1).max(255),
});

export const videoIdParamsSchema = z.strictObject({ id: z.uuid() });

export const listVideosQuerySchema = z.strictObject({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  fighterId: z.uuid().optional(),
  status: z.enum(videoStatuses).optional(),
  trainingType: z.enum(videoTrainingTypes).optional(),
  search: z.string().trim().max(100).optional(),
});

export const publicVideoSchema = z.strictObject({
  id: z.uuid(),
  fighterId: z.uuid(),
  uploadedById: z.uuid(),
  sessionId: z.uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  trainingType: z.enum(videoTrainingTypes),
  cameraAngle: z.enum(videoCameraAngles),
  status: z.enum(videoStatuses),
  originalFilename: z.string().nullable(),
  fileSizeBytes: z.number().int().positive(),
  mimeType: z.string(),
  durationMs: z.number().int().positive().nullable(),
  sourceUrl: z.string(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const videoPageSchema = z.strictObject({
  items: z.array(publicVideoSchema),
  pageInfo: z.strictObject({
    hasNextPage: z.boolean(),
    endCursor: z.uuid().nullable(),
  }),
  total: z.number().int().nonnegative(),
});

export type UploadVideoInput = z.infer<typeof uploadVideoQuerySchema> & {
  mimeType: string;
  fileSizeBytes: number;
};
export type PublicVideo = z.infer<typeof publicVideoSchema>;
export type ListVideosQuery = z.infer<typeof listVideosQuerySchema>;
