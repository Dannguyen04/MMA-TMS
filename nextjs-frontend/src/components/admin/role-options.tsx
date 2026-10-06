import { ShieldAlert } from "lucide-react";

import type { ChoiceOption } from "@/components/ui/choice-group";
import type { Role } from "@/lib/domain/types";

export interface RoleOption {
    role: Role;
    label: string;
    description: string;
    permissionCount: number;
    /** The role can read or write clinical data. */
    clinical: boolean;
}

export const ROLE_HINT = "Controls what they can see and do. You can change permissions per role later.";

/** Role cards for the account forms: what the role is for, how much it grants and whether it reaches clinical data. */
export function roleChoiceOptions(roles: RoleOption[]): ChoiceOption<Role>[] {
    return roles.map((option) => ({
        value: option.role,
        label: option.label,
        description: option.description,
        extra: (
            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-fg-subtle">{option.permissionCount} permissions</span>
                {option.clinical && (
                    <span className="inline-flex items-center gap-1 font-medium text-warning-fg">
                        <ShieldAlert aria-hidden className="size-3.5" />
                        Can access clinical data
                    </span>
                )}
            </span>
        ),
    }));
}
