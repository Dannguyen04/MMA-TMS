import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { SuspensionsModule } from '../suspensions/suspensions.module.js';
import { BoutsController } from './bouts.controller.js';
import { BoutsTodoController } from './bouts-todo.controller.js';
import { BoutsTodoService } from './bouts-todo.service.js';
import { BoutsRepository } from './bouts.repo.js';
import { BoutsService } from './bouts.service.js';

/**
 * Deliberately does not import TrainingModule: SuspensionsModule is the shared
 * lower layer imported by both TrainingModule and BoutsModule.
 */
@Module({
  imports: [DatabaseModule, SuspensionsModule],
  controllers: [BoutsController, BoutsTodoController],
  providers: [BoutsRepository, BoutsService, BoutsTodoService],
  exports: [BoutsRepository, BoutsService, BoutsTodoService],
})
export class BoutsModule {}
