import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { SuspensionGate } from './suspension.gate.js';
import { SuspensionsController } from './suspensions.controller.js';
import { SuspensionsRepository } from './suspensions.repo.js';
import { SuspensionsService } from './suspensions.service.js';

export { SuspensionGate };

/**
 * Deliberately imports only DatabaseModule (never BoutsModule or TrainingModule)
 * because later T-007 rounds make both BoutsModule and TrainingModule import
 * SuspensionsModule.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [SuspensionsController],
  providers: [SuspensionsRepository, SuspensionsService, SuspensionGate],
  exports: [SuspensionsRepository, SuspensionsService, SuspensionGate],
})
export class SuspensionsModule {}
