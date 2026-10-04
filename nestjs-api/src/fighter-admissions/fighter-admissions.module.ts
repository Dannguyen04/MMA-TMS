import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { MedicalModule } from '../medical/medical.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ADMISSION_ACTIVATION_PORT } from '../shared/contracts/admission-activation.contract.js';
import { UsersModule } from '../users/users.module.js';
import {
  FighterAdmissionsAdminController,
  FighterAdmissionsApplicantController,
  FighterAdmissionsAssignedController,
} from './fighter-admissions.controller.js';
import { FighterAdmissionsRepository } from './fighter-admissions.repo.js';
import { FighterAdmissionsService } from './fighter-admissions.service.js';

/**
 * Admissions consumes the Auth recovery-mail contract while Auth consumes the
 * admission activation port, so both modules resolve each other through
 * forwardRef and depend only on the shared contract interfaces.
 */
@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    NotificationsModule,
    // A6 recipient lookup; imports only DatabaseModule, so no cycle.
    AuthorizationModule,
    // M1 Doctor-assignment reminder; Medical imports no feature module.
    MedicalModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [
    FighterAdmissionsApplicantController,
    FighterAdmissionsAdminController,
    FighterAdmissionsAssignedController,
  ],
  providers: [
    FighterAdmissionsRepository,
    FighterAdmissionsService,
    { provide: ADMISSION_ACTIVATION_PORT, useExisting: FighterAdmissionsService },
  ],
  exports: [ADMISSION_ACTIVATION_PORT],
})
export class FighterAdmissionsModule {}
