import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { BoutsController } from './bouts.controller.js';
import { BoutsRepository } from './bouts.repo.js';
import { BoutsService } from './bouts.service.js';

/**
 * Deliberately does not import TrainingModule: T-007 will make training import
 * bouts, and the access queries are duplicated in BoutsRepository to avoid a cycle.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [BoutsController],
  providers: [BoutsRepository, BoutsService],
  exports: [BoutsRepository, BoutsService],
})
export class BoutsModule {}
