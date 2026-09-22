import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { GoalsController } from './goals.controller.js';
import { GoalsRepository } from './goals.repo.js';
import { GoalsService } from './goals.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [GoalsController],
  providers: [GoalsRepository, GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
