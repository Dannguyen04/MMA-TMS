import { createZodDto } from 'nestjs-zod';
import {
  activationResponseSchema,
  applicantApplicationListSchema,
  applicantApplicationSchema,
  applicationIdParamsSchema,
  assignCoachBodySchema,
  listApplicationsQuerySchema,
  listOwnApplicationsQuerySchema,
  recoveryEmailStatusSchema,
  staffApplicationListSchema,
  staffApplicationSchema,
  submitApplicationBodySchema,
  submitAssessmentBodySchema,
  submitDecisionBodySchema,
} from './fighter-admissions.model.js';

export class SubmitApplicationDto extends createZodDto(
  submitApplicationBodySchema,
) {}
export class ApplicationIdParamsDto extends createZodDto(
  applicationIdParamsSchema,
) {}
export class ListApplicationsQueryDto extends createZodDto(
  listApplicationsQuerySchema,
) {}
export class ListOwnApplicationsQueryDto extends createZodDto(
  listOwnApplicationsQuerySchema,
) {}
export class AssignCoachDto extends createZodDto(assignCoachBodySchema) {}
export class SubmitAssessmentDto extends createZodDto(
  submitAssessmentBodySchema,
) {}
export class SubmitDecisionDto extends createZodDto(submitDecisionBodySchema) {}

export class ApplicantApplicationDto extends createZodDto(
  applicantApplicationSchema,
) {}
export class ApplicantApplicationListDto extends createZodDto(
  applicantApplicationListSchema,
) {}
export class StaffApplicationDto extends createZodDto(staffApplicationSchema) {}
export class StaffApplicationListDto extends createZodDto(
  staffApplicationListSchema,
) {}
export class ActivationResponseDto extends createZodDto(
  activationResponseSchema,
) {}
export class RecoveryEmailStatusDto extends createZodDto(
  recoveryEmailStatusSchema,
) {}
