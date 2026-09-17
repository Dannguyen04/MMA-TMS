import { z } from 'zod';
import { userRoles } from '../shared/types/user.role.js';
import {
  isoDateTimeSchema,
  trimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';
// Re-export authoritative permission code constants from owning modules.
// Never redeclare raw permission code strings here.
import { USER_PERMISSIONS } from '../users/users.model.js';
import { FIGHTER_PERMISSIONS } from '../fighters/fighters.model.js';
import { TRAINING_PERMISSIONS } from '../training/training.model.js';

// ---------------------------------------------------------------------------
// Path param schemas — combined, used directly by the controller
// ---------------------------------------------------------------------------

export const userPermissionParamsSchema = z.strictObject({
  userId: z.uuid(),
  permissionCode: trimmedTextSchema(200),
});

export const rolePermissionParamsSchema = z.strictObject({
  role: z.enum(userRoles),
  permissionCode: trimmedTextSchema(200),
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const userPermissionResponseSchema = z.strictObject({
  id: z.uuid(),
  userId: z.uuid(),
  permissionCode: z.string(),
  isGranted: z.boolean(),
  grantedBy: z.uuid().nullable(),
  createdAt: isoDateTimeSchema,
});

export const rolePermissionResponseSchema = z.strictObject({
  id: z.uuid(),
  role: z.enum(userRoles),
  permissionCode: z.string(),
  createdAt: isoDateTimeSchema,
});

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type UserPermissionParams = z.infer<typeof userPermissionParamsSchema>;
export type RolePermissionParams = z.infer<typeof rolePermissionParamsSchema>;
export type UserPermissionResponse = z.infer<typeof userPermissionResponseSchema>;
export type RolePermissionResponse = z.infer<typeof rolePermissionResponseSchema>;

// ---------------------------------------------------------------------------
// Default permissions granted to every new FIGHTER at registration.
// Uses authoritative constants from owning modules — not raw strings.
// If a permission code changes in its owning module, this array updates
// automatically. The SQL migration catalogue remains the independent source.
// ---------------------------------------------------------------------------

export const FIGHTER_DEFAULT_PERMISSION_CODES = [
  USER_PERMISSIONS.PROFILE_READ,          // 'users.profile.read'
  FIGHTER_PERMISSIONS.READ,               // 'fighter:read'
  FIGHTER_PERMISSIONS.MEASUREMENTS_READ,  // 'fighter.measurement:read'
  FIGHTER_PERMISSIONS.COACHES_READ,       // 'fighter.coach:read'
  FIGHTER_PERMISSIONS.SESSIONS_READ,      // 'fighter.session:read'
  TRAINING_PERMISSIONS.PLAN_GET_ALL,      // 'training.plan:get_all'
  TRAINING_PERMISSIONS.PLAN_READ,         // 'training.plan:read'
  TRAINING_PERMISSIONS.SESSION_GET_ALL,   // 'training.session:get_all'
  TRAINING_PERMISSIONS.SESSION_READ,      // 'training.session:read'
  TRAINING_PERMISSIONS.EXERCISE_GET_ALL,  // 'training.exercise:get_all'
  TRAINING_PERMISSIONS.EXERCISE_READ,     // 'training.exercise:read'
] as const satisfies readonly string[];

