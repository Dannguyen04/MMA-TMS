import { z } from 'zod';
import {
  notificationTargetTypes,
  notificationTypes,
} from '../shared/contracts/notification.contract.js';
import { isoDateTimeSchema } from '../shared/utils/zod-schema.util.js';
import {
  NOTIFICATION_CORRELATION_ID_MAX,
  NOTIFICATION_DELIVERY_DEDUPE_KEY_MAX,
  NOTIFICATION_LIMITS,
  NOTIFICATION_PAGE_SIZE_DEFAULT,
  NOTIFICATION_PAGE_SIZE_MAX,
  NOTIFICATION_PAYLOAD_VERSION,
  NOTIFICATION_SIGNAL_KIND,
} from './notifications.constant.js';

const dataValueSchema = z.union([
  z.string().max(NOTIFICATION_LIMITS.DATA_STRING_MAX),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const dataSchema = z
  .record(
    z
      .string()
      .min(1)
      .max(NOTIFICATION_LIMITS.DATA_KEY_MAX)
      .regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    dataValueSchema,
  )
  .refine(
    (data) => Object.keys(data).length <= NOTIFICATION_LIMITS.DATA_MAX_KEYS,
    `At most ${NOTIFICATION_LIMITS.DATA_MAX_KEYS} data keys`,
  );

const targetSchema = z.strictObject({
  type: z.enum(notificationTargetTypes),
  id: z.uuid(),
});

export const notificationPayloadSchema = z
  .strictObject({
    v: z.literal(NOTIFICATION_PAYLOAD_VERSION),
    target: targetSchema.optional(),
    data: dataSchema.optional(),
  })
  .refine(
    (payload) =>
      Buffer.byteLength(JSON.stringify(payload), 'utf8') <=
      NOTIFICATION_LIMITS.PAYLOAD_MAX_BYTES,
    `Payload exceeds ${NOTIFICATION_LIMITS.PAYLOAD_MAX_BYTES} bytes`,
  );

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

/** Never carries an access token, request object or clinical record. */
export const deliveryJobSchema = z.strictObject({
  recipientUserIds: z
    .array(z.uuid())
    .min(1)
    .max(NOTIFICATION_LIMITS.RECIPIENTS_MAX),
  type: z.enum(notificationTypes),
  title: z.string().trim().min(1).max(NOTIFICATION_LIMITS.TITLE_MAX),
  message: z.string().trim().min(1).max(NOTIFICATION_LIMITS.MESSAGE_MAX),
  payload: notificationPayloadSchema,
  /** `<type>:<caller dedupe key>`. */
  dedupeKey: z.string().min(1).max(NOTIFICATION_DELIVERY_DEDUPE_KEY_MAX),
  correlationId: z.string().max(NOTIFICATION_CORRELATION_ID_MAX).optional(),
});

export type DeliveryJob = z.infer<typeof deliveryJobSchema>;

/** Names committed rows only; clients re-read content through REST. */
export const notificationSignalSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal(NOTIFICATION_SIGNAL_KIND.CREATED),
    deliveries: z
      .array(z.strictObject({ userId: z.uuid(), notificationId: z.uuid() }))
      .min(1)
      .max(NOTIFICATION_LIMITS.RECIPIENTS_MAX),
  }),
  z.strictObject({
    kind: z.literal(NOTIFICATION_SIGNAL_KIND.READ),
    userId: z.uuid(),
    notificationId: z.uuid(),
  }),
]);

export type NotificationSignal = z.infer<typeof notificationSignalSchema>;

export const callerDedupeKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(NOTIFICATION_LIMITS.DEDUPE_KEY_MAX);

export const listNotificationsQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(NOTIFICATION_PAGE_SIZE_MAX)
    .default(NOTIFICATION_PAGE_SIZE_DEFAULT),
  unreadOnly: z
    .preprocess(
      (value) => (value === 'true' ? true : value === 'false' ? false : value),
      z.boolean(),
    )
    .optional(),
});

export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;

export const notificationIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const notificationSchema = z.strictObject({
  id: z.uuid(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  payload: z.record(z.string(), z.unknown()),
  isRead: z.boolean(),
  readAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export type NotificationView = z.infer<typeof notificationSchema>;

export const unreadCountSchema = z.strictObject({
  count: z.number().int().nonnegative(),
});

export type UnreadCount = z.infer<typeof unreadCountSchema>;

/** Inner pagination inside the envelope's `data` (FE §12.1). */
export const notificationPageSchema = z.strictObject({
  data: z.array(notificationSchema),
  total: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
});

export type NotificationPage = z.infer<typeof notificationPageSchema>;
