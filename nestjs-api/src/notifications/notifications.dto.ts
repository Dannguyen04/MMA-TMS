import { createZodDto } from 'nestjs-zod';
import {
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
  notificationMutationCountSchema,
  notificationPageSchema,
  notificationSummaryQuerySchema,
  notificationSummarySchema,
  publicNotificationSchema,
} from './notifications.model.js';

export class ListNotificationsQueryDto extends createZodDto(
  listNotificationsQuerySchema,
) {}
export class NotificationIdParamsDto extends createZodDto(
  notificationIdParamsSchema,
) {}
export class PublicNotificationDto extends createZodDto(
  publicNotificationSchema,
) {}
export class NotificationPageDto extends createZodDto(notificationPageSchema) {}
export class NotificationSummaryQueryDto extends createZodDto(
  notificationSummaryQuerySchema,
) {}
export class NotificationSummaryDto extends createZodDto(
  notificationSummarySchema,
) {}
export class NotificationMutationCountDto extends createZodDto(
  notificationMutationCountSchema,
) {}
