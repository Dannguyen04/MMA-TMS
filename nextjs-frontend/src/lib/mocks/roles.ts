import { ROLE_DEFINITIONS } from "@/lib/auth/role-catalog";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/domain/system-settings";
import type { RoleDefinition, SystemSettings } from "@/lib/domain/types";
import { ORGANIZATION_NAME } from "./people";

/** The demo's editable role matrix starts from each role's baseline grants. */
export const mockRoleDefinitions: RoleDefinition[] = ROLE_DEFINITIONS.map((definition) => ({ ...definition, permissions: [...definition.permissions] }));

export const mockSystemSettings: SystemSettings = { ...DEFAULT_SYSTEM_SETTINGS, organizationName: ORGANIZATION_NAME };
