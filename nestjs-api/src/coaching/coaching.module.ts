import { Module } from '@nestjs/common';
import { CoachingController } from './coaching.controller.js';
import { CoachingService } from './coaching.service.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CoachingController],
  providers: [CoachingService],
  exports: [CoachingService],
})
export class CoachingModule {}

