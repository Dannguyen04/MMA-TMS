import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DoctorAssignmentReminder } from './doctor-assignment-reminder.service.js';
import { MedicalAccessService } from './medical-access.service.js';
import { MedicalAssignmentController } from './medical-assignment.controller.js';
import { MedicalController } from './medical.controller.js';
import { MedicalRepository } from './medical.repo.js';
import { MedicalService } from './medical.service.js';

// Depends on no feature module: Fighters and Training import this module for
// clinical access policy and the training eligibility gate. Notifications and
// Authorization import only infrastructure, so the Doctor-assignment reminder
// adds no cycle; Admissions and Users use it after creating a Fighter.
@Module({
  imports: [DatabaseModule, NotificationsModule, AuthorizationModule],
  controllers: [MedicalController, MedicalAssignmentController],
  providers: [
    MedicalRepository,
    MedicalAccessService,
    MedicalService,
    DoctorAssignmentReminder,
  ],
  exports: [MedicalAccessService, MedicalService, DoctorAssignmentReminder],
})
export class MedicalModule {}
