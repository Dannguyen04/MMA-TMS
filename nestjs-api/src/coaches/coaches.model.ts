import { z } from 'zod';
import {
  fighterStances,
  weightClasses,
} from '../fighters/fighters.model.js';

// --- Params Schemas ---

export const coachIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

// --- Query Schemas ---
//
// Mirrors `listFightersQuerySchema` (same filters and semantics); only the
// assignment scope differs.
export const listCoachFightersQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  weightClass: z.enum(weightClasses).optional(),
  dominantStance: z.enum(fighterStances).optional(),
  gym: z.string().trim().max(200).optional(),
  search: z.string().trim().max(100).optional(),
});

// --- Type Inferences ---

export type CoachIdParams = z.infer<typeof coachIdParamsSchema>;
export type ListCoachFightersQuery = z.infer<
  typeof listCoachFightersQuerySchema
>;
