import { createZodDto } from 'nestjs-zod';
import {
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
  notificationSchema,
  unreadCountSchema,
} from './notifications.model.js';

export class ListNotificationsQueryDto extends createZodDto(
  listNotificationsQuerySchema,
) {}

export class NotificationIdParamsDto extends createZodDto(
  notificationIdParamsSchema,
) {}

export class NotificationDto extends createZodDto(notificationSchema) {}

export class UnreadCountDto extends createZodDto(unreadCountSchema) {}
