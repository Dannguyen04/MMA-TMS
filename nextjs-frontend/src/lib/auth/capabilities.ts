import { PERMISSIONS, type Permission, type Role } from "@/lib/domain/types";
import { ROLE_DEFAULT_PERMISSIONS, isDoctorOnlyPermission } from "./permissions";

/** Every permission name the interface understands. */
const FRONTEND_PERMISSIONS: ReadonlySet<string> = new Set<Permission>(PERMISSIONS);

/** Backend medical capability names and the interface permissions they grant. */
const BACKEND_CAPABILITIES: Readonly<Record<string, readonly Permission[]>> = {
    "fighter.medical:read": ["medical:read_summary"],
    "fighter.medical:write": ["medical:write"],
    "fighter.medical_examination:create": ["medical:write"],
    "fighter.medical_clearance:issue": ["clearance:manage"],
    "fighter.medical_clearance:revoke": ["clearance:manage"],
    "fighter.medical_review_request:create": ["medical:request_review"],
};

/**
 * Interface permissions for a signed-in user. When the backend lists capabilities, known interface names are
 * kept and known backend medical names are translated; unknown names are ignored so a new backend capability
 * never breaks sign-in. When it lists none, the role's baseline applies. Clinical permissions always stay with
 * sports doctors. The backend authorizes every request regardless; this only decides what the interface offers.
 */
export function permissionsForRole(role: Role, capabilities: readonly string[] | undefined): Permission[] {
    const listed = capabilities ?? [];
    const granted = new Set<Permission>();
    for (const capability of listed) {
        if (FRONTEND_PERMISSIONS.has(capability)) granted.add(capability as Permission);
        for (const permission of BACKEND_CAPABILITIES[capability] ?? []) granted.add(permission);
        // Full clinical reads are a doctor's; other roles reading medical data get the summary only.
        if (capability === "fighter.medical:read" && role === "doctor") granted.add("medical:read");
    }
    const hasInterfaceNames = listed.some((capability) => FRONTEND_PERMISSIONS.has(capability));
    if (!hasInterfaceNames) for (const permission of ROLE_DEFAULT_PERMISSIONS[role]) granted.add(permission);
    return [...granted].filter((permission) => role === "doctor" || !isDoctorOnlyPermission(permission));
}
