import { createZodDto } from 'nestjs-zod';
import {
  assignDoctorSchema,
  clearanceSchema,
  createExaminationSchema,
  createInjurySchema,
  createRecoveryPlanSchema,
  createReviewRequestSchema,
  createTreatmentSchema,
  doctorAssignmentSchema,
  doctorIdParamsSchema,
  endDoctorAssignmentSchema,
  examinationSchema,
  injurySchema,
  issueClearanceSchema,
  listDoctorAssignmentsQuerySchema,
  listExaminationsQuerySchema,
  listMedicalHistoryQuerySchema,
  listReviewRequestsQuerySchema,
  medicalDossierSchema,
  medicalHistoryEntrySchema,
  medicalRecordIdParamsSchema,
  recoveryPlanSchema,
  reviewRequestSchema,
  revokeClearanceSchema,
  treatmentSchema,
  updateInjurySchema,
  updateRecoveryPlanSchema,
} from './medical.model.js';

export class MedicalRecordIdParamsDto extends createZodDto(
  medicalRecordIdParamsSchema,
) {}
export class DoctorIdParamsDto extends createZodDto(doctorIdParamsSchema) {}

export class ListDoctorAssignmentsQueryDto extends createZodDto(
  listDoctorAssignmentsQuerySchema,
) {}
export class ListReviewRequestsQueryDto extends createZodDto(
  listReviewRequestsQuerySchema,
) {}
export class ListExaminationsQueryDto extends createZodDto(
  listExaminationsQuerySchema,
) {}
export class ListMedicalHistoryQueryDto extends createZodDto(
  listMedicalHistoryQuerySchema,
) {}

export class AssignDoctorDto extends createZodDto(assignDoctorSchema) {}
export class EndDoctorAssignmentDto extends createZodDto(
  endDoctorAssignmentSchema,
) {}
export class CreateReviewRequestDto extends createZodDto(
  createReviewRequestSchema,
) {}
export class CreateInjuryDto extends createZodDto(createInjurySchema) {}
export class UpdateInjuryDto extends createZodDto(updateInjurySchema) {}
export class CreateTreatmentDto extends createZodDto(createTreatmentSchema) {}
export class CreateRecoveryPlanDto extends createZodDto(
  createRecoveryPlanSchema,
) {}
export class UpdateRecoveryPlanDto extends createZodDto(
  updateRecoveryPlanSchema,
) {}
export class CreateExaminationDto extends createZodDto(
  createExaminationSchema,
) {}
export class IssueClearanceDto extends createZodDto(issueClearanceSchema) {}
export class RevokeClearanceDto extends createZodDto(revokeClearanceSchema) {}

export class DoctorAssignmentDto extends createZodDto(doctorAssignmentSchema) {}
export class ReviewRequestDto extends createZodDto(reviewRequestSchema) {}
export class InjuryDto extends createZodDto(injurySchema) {}
export class TreatmentDto extends createZodDto(treatmentSchema) {}
export class RecoveryPlanDto extends createZodDto(recoveryPlanSchema) {}
export class ExaminationDto extends createZodDto(examinationSchema) {}
export class ClearanceDto extends createZodDto(clearanceSchema) {}
export class MedicalDossierDto extends createZodDto(medicalDossierSchema) {}
export class MedicalHistoryEntryDto extends createZodDto(
  medicalHistoryEntrySchema,
) {}
