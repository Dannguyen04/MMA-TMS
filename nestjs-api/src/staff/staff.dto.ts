import { createZodDto } from 'nestjs-zod';
import {
  coachDirectorySchema,
  doctorDirectorySchema,
  listStaffQuerySchema,
  staffIdParamsSchema,
} from './staff.model.js';

export class ListStaffQueryDto extends createZodDto(listStaffQuerySchema) {}
export class StaffIdParamsDto extends createZodDto(staffIdParamsSchema) {}
export class CoachDirectoryResponseDto extends createZodDto(
  coachDirectorySchema,
) {}
export class DoctorDirectoryResponseDto extends createZodDto(
  doctorDirectorySchema,
) {}
