import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { PerformanceController } from './performance.controller.js';
import { PerformanceRepository } from './performance.repo.js';
import { PerformanceService } from './performance.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PerformanceController],
  providers: [PerformanceRepository, PerformanceService],
})
export class PerformanceModule {}
