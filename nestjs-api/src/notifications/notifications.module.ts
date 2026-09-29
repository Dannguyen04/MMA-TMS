import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module.js';
import { NOTIFICATION_PUBLISHER } from '../shared/contracts/notification.contract.js';
import { NotificationDistributionService } from './notification-distribution.service.js';
import { NotificationStreamService } from './notification-stream.service.js';
import { loadNotificationsConfig } from './notifications.config.js';
import {
  NOTIFICATIONS_CONFIG,
  NOTIFICATIONS_QUEUE,
} from './notifications.constant.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsProcessor } from './notifications.processor.js';
import { NotificationsRepository } from './notifications.repo.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Shared notification module. Business modules import it and inject
 * `NOTIFICATION_PUBLISHER`; they never depend on the queue, repository or
 * worker. The queue reuses the root BullMQ connection from AppModule.
 * This module imports no business module, so it cannot form a cycle.
 */
@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  controllers: [NotificationsController],
  providers: [
    {
      provide: NOTIFICATIONS_CONFIG,
      inject: [ConfigService],
      useFactory: loadNotificationsConfig,
    },
    NotificationsRepository,
    NotificationDistributionService,
    NotificationStreamService,
    NotificationsService,
    NotificationsProcessor,
    { provide: NOTIFICATION_PUBLISHER, useExisting: NotificationsService },
  ],
  exports: [NOTIFICATION_PUBLISHER],
})
export class NotificationsModule {}
