import { z } from 'zod';
import { isoDateTimeSchema, trimmedTextSchema } from '../shared/utils/zod-schema.util.js';

export const medicalSupervisionValues = ['DOCTOR', 'NONE'] as const;
export type MedicalSupervisionValue = (typeof medicalSupervisionValues)[number];

export const academySettingsResponseSchema = z.strictObject({
  medicalSupervision: z.enum(medicalSupervisionValues),
  changeReason: z.string().nullable(),
  updatedAt: isoDateTimeSchema,
});

export type AcademySettingsResponse = z.infer<typeof academySettingsResponseSchema>;

export const updateAcademySettingsSchema = z.strictObject({
  medicalSupervision: z.enum(medicalSupervisionValues),
  changeReason: trimmedTextSchema(500, 3),
});

export type UpdateAcademySettingsInput = z.infer<typeof updateAcademySettingsSchema>;
