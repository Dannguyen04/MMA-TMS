import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AcademySettingsController } from './academy-settings.controller.js';
import { AcademySettingsRepository } from './academy-settings.repo.js';
import { AcademySettingsService } from './academy-settings.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AcademySettingsController],
  providers: [AcademySettingsRepository, AcademySettingsService],
  exports: [AcademySettingsRepository, AcademySettingsService],
})
export class AcademySettingsModule {}
