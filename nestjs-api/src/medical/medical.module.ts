import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { MedicalAccessService } from './medical-access.service.js';
import { MedicalAssignmentController } from './medical-assignment.controller.js';
import { MedicalController } from './medical.controller.js';
import { MedicalRepository } from './medical.repo.js';
import { MedicalService } from './medical.service.js';

// Depends on no feature module: Fighters and Training import this module for
// clinical access policy and the training eligibility gate.
@Module({
  imports: [DatabaseModule],
  controllers: [MedicalController, MedicalAssignmentController],
  providers: [MedicalRepository, MedicalAccessService, MedicalService],
  exports: [MedicalAccessService, MedicalService],
})
export class MedicalModule {}
