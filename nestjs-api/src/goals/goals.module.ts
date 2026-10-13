import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { GoalsController } from './goals.controller.js';
import { GoalsRepository } from './goals.repo.js';
import { GoalsService } from './goals.service.js';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [GoalsController],
  providers: [GoalsRepository, GoalsService],
})
export class GoalsModule {}
