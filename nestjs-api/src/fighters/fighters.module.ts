import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { MedicalModule } from '../medical/medical.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { FightersController } from './fighters.controller.js';
import { FightersRepository } from './fighters.repo.js';
import { FightersService } from './fighters.service.js';

@Module({
  imports: [DatabaseModule, MedicalModule, NotificationsModule],
  controllers: [FightersController],
  providers: [FightersRepository, FightersService],
  exports: [FightersRepository, FightersService],
})
export class FightersModule {}

