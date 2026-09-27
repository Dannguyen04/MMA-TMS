import type { Permission, Role } from "@/lib/domain/types";

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

/**
 * Baseline permissions per role, matching the backend's default grants. The session uses them when the backend
 * doesn't list a user's capabilities; the demo seeds its editable role matrix from them. The backend still
 * authorizes every request, so these only decide what the interface offers.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<Role, readonly Permission[]> = {
    // Scoped to their own profile, matching the backend FIGHTER baseline (fighter:read).
    fighter: ["fighters:read", "training:read", "videos:upload", "ai_analysis:read", "medical:read_summary", "medical:request_review"],
    coach: [
        "fighters:read",
        "training:read",
        "training:write",
        "goals:write",
        "videos:upload",
        "ai_analysis:read",
        "ai_findings:review",
        "medical:read_summary",
        "medical:request_review",
    ],
    doctor: [
        "fighters:read",
        "training:read",
        "ai_analysis:read",
        "ai_alerts:review",
        "medical:read_summary",
        "medical:read",
        "medical:write",
        "medical:request_review",
        "clearance:manage",
    ],
    admin: ["fighters:read", "videos:manage", "ai_jobs:manage", "ai_models:manage", "users:manage", "roles:manage", "audit_logs:read", "notifications:manage", "settings:manage"],
};
