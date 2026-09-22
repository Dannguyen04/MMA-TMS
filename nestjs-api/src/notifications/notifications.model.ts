import { z } from 'zod';
import { isoDateTimeSchema } from '../shared/utils/zod-schema.util.js';

export const notificationCategories = [
  'TRAINING',
  'AI_ANALYSIS',
  'AI_ALERT',
  'FEEDBACK',
  'MEDICAL',
  'CLEARANCE',
  'GOAL',
  'SYSTEM',
] as const;

export const notificationSeverities = [
  'INFO',
  'SUCCESS',
  'WARNING',
  'DANGER',
] as const;

const queryBooleanSchema = z.preprocess(
  (value) => (value === 'true' ? true : value === 'false' ? false : value),
  z.boolean(),
);

export const listNotificationsQuerySchema = z.strictObject({
  category: z.enum(notificationCategories).optional(),
  unreadOnly: queryBooleanSchema.optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const notificationIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const publicNotificationSchema = z.strictObject({
  id: z.uuid(),
  userId: z.uuid(),
  category: z.enum(notificationCategories),
  severity: z.enum(notificationSeverities),
  title: z.string(),
  body: z.string(),
  href: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  readAt: isoDateTimeSchema.nullable(),
});

export const notificationPageSchema = z.strictObject({
  items: z.array(publicNotificationSchema),
  pageInfo: z.strictObject({
    hasNextPage: z.boolean(),
    endCursor: z.uuid().nullable(),
  }),
  total: z.number().int().nonnegative(),
});

export const notificationSummarySchema = z.strictObject({
  unread: z.number().int().nonnegative(),
  latest: z.array(publicNotificationSchema),
});

export const notificationSummaryQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(20).default(6),
});

export const notificationMutationCountSchema = z.strictObject({
  count: z.number().int().nonnegative(),
});

export type NotificationCategory = (typeof notificationCategories)[number];
export type NotificationSeverity = (typeof notificationSeverities)[number];
export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;
export type PublicNotification = z.infer<typeof publicNotificationSchema>;
export type NotificationPage = z.infer<typeof notificationPageSchema>;
export type NotificationSummary = z.infer<typeof notificationSummarySchema>;
