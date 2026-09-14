import type { Permission } from "@/lib/domain/types";

/**
 * Permissions that open clinical records or decide on a fighter's fitness to train. Only the
 * sports doctor role may hold them; role management and Server Actions both enforce this.
 * Safe for Client Components (the role matrix disables these checkboxes for other roles).
 */
export const DOCTOR_ONLY_PERMISSIONS = ["medical:read", "medical:write", "clearance:manage", "ai_alerts:review"] as const satisfies readonly Permission[];

export type DoctorOnlyPermission = (typeof DOCTOR_ONLY_PERMISSIONS)[number];

export const DOCTOR_ONLY_PERMISSION_REASON = "Clinical permissions are limited to the sports doctor role";

export function isDoctorOnlyPermission(permission: Permission): permission is DoctorOnlyPermission {
    return (DOCTOR_ONLY_PERMISSIONS as readonly Permission[]).includes(permission);
}
