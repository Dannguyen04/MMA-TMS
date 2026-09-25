import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { FightersModule } from '../fighters/fighters.module.js';
import { CoachesController } from './coaches.controller.js';
import { CoachesRepository } from './coaches.repo.js';
import { CoachesService } from './coaches.service.js';

@Module({
  imports: [DatabaseModule, FightersModule],
  controllers: [CoachesController],
  providers: [CoachesRepository, CoachesService],
})
export class CoachesModule {}
