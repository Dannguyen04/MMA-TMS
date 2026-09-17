import { z } from 'zod';
import { userRoles } from '../shared/types/user.role.js';
import {
  isoDateTimeSchema,
  trimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';
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
export type UserPermissionResponse = z.infer<
  typeof userPermissionResponseSchema
>;
export type RolePermissionResponse = z.infer<
  typeof rolePermissionResponseSchema
>;
