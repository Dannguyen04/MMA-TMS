import { createZodDto } from 'nestjs-zod';
import {
  assignCoachSchema,
  assignDoctorSchema,
  assignmentIdParamsSchema,
  coachAssignmentSchema,
  doctorAssignmentSchema,
  createMeasurementSchema,
  endCoachAssignmentSchema,
  fighterIdParamsSchema,
  fighterMeasurementSchema,
  fighterMedicalSummarySchema,
  listFightersQuerySchema,
  listFighterSessionsQuerySchema,
  listMeasurementsQuerySchema,
  measurementIdParamsSchema,
  publicFighterSchema,
  trainingSessionSummarySchema,
  updateFighterProfileSchema,
} from './fighters.model.js';

export class FighterIdParamsDto extends createZodDto(fighterIdParamsSchema) {}

export class AssignmentIdParamsDto extends createZodDto(
  assignmentIdParamsSchema,
) {}

export class MeasurementIdParamsDto extends createZodDto(
  measurementIdParamsSchema,
) {}

export class ListFightersQueryDto extends createZodDto(
  listFightersQuerySchema,
) {}

export class ListMeasurementsQueryDto extends createZodDto(
  listMeasurementsQuerySchema,
) {}

export class ListFighterSessionsQueryDto extends createZodDto(
  listFighterSessionsQuerySchema,
) {}

export class UpdateFighterProfileDto extends createZodDto(
  updateFighterProfileSchema,
) {}

export class CreateMeasurementDto extends createZodDto(
  createMeasurementSchema,
) {}

export class AssignCoachDto extends createZodDto(assignCoachSchema) {}

export class AssignDoctorDto extends createZodDto(assignDoctorSchema) {}

export class EndCoachAssignmentDto extends createZodDto(
  endCoachAssignmentSchema,
) {}

export class PublicFighterDto extends createZodDto(publicFighterSchema) {}

export class FighterMeasurementDto extends createZodDto(
  fighterMeasurementSchema,
) {}

export class CoachAssignmentDto extends createZodDto(coachAssignmentSchema) {}

export class DoctorAssignmentDto extends createZodDto(doctorAssignmentSchema) {}

export class TrainingSessionSummaryDto extends createZodDto(
  trainingSessionSummarySchema,
) {}

export class FighterMedicalSummaryDto extends createZodDto(
  fighterMedicalSummarySchema,
) {}
