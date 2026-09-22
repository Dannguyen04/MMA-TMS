import { z } from 'zod';
import {
  nullableTrimmedTextSchema,
  trimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';

export const listStaffQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: trimmedTextSchema(100).optional(),
});
export type ListStaffQuery = z.infer<typeof listStaffQuerySchema>;

export const coachDirectorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  firstName: trimmedTextSchema(255),
  lastName: trimmedTextSchema(255),
  specialization: nullableTrimmedTextSchema(255),
  certifications: z.array(z.string()),
  yearsExperience: z.number().int().min(0).max(100),
  fighterIds: z.array(z.string().uuid()),
});
export type CoachDirectoryEntry = z.infer<typeof coachDirectorySchema>;

export const doctorDirectorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  firstName: trimmedTextSchema(255),
  lastName: trimmedTextSchema(255),
  specialization: nullableTrimmedTextSchema(255),
  licenseNumber: trimmedTextSchema(255),
  fighterIds: z.array(z.string().uuid()),
});
export type DoctorDirectoryEntry = z.infer<typeof doctorDirectorySchema>;

export const staffIdParamsSchema = z.strictObject({ id: z.string().uuid() });

export const STAFF_PERMISSIONS = {
  COACH_GET_ALL: 'staff.coach:get_all',
  COACH_READ: 'staff.coach:read',
  DOCTOR_GET_ALL: 'staff.doctor:get_all',
  DOCTOR_READ: 'staff.doctor:read',
} as const;
