import { Check, Minus } from "lucide-react";

import type { PermissionCatalogEntry } from "@/lib/services/admin";
import type { Permission } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { CLINICAL_PERMISSIONS, PERMISSION_GROUP_ORDER } from "./admin-format";
import { ClinicalDataBadge } from "./admin-badges";

export interface PermissionListProps {
    catalog: PermissionCatalogEntry[];
    granted: Permission[];
    className?: string;
}

/** Granted permissions grouped by area. Groups without access say so explicitly. */
export function PermissionList({ catalog, granted, className }: PermissionListProps) {
    return (
        <div className={cn("flex flex-col gap-4", className)}>
            {PERMISSION_GROUP_ORDER.map((group) => {
                const entries = catalog.filter((entry) => entry.group === group && granted.includes(entry.permission));
                const headingId = `permission-group-${group.toLowerCase().replace(/[^a-z]+/g, "-")}`;
                return (
                    <section key={group} aria-labelledby={headingId}>
                        <h3 id={headingId} className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                            {group}
                        </h3>
                        {entries.length === 0 ? (
                            <p className="mt-1.5 flex items-center gap-2 text-[13px] text-fg-muted">
                                <Minus aria-hidden className="size-3.5 text-fg-subtle" />
                                No access
                            </p>
                        ) : (
                            <ul className="mt-1.5 flex flex-col gap-1.5">
                                {entries.map((entry) => (
                                    <li key={entry.permission} className="flex items-start gap-2 text-[13px]">
                                        <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success-fg" />
                                        <span className="min-w-0">
                                            <span className="text-fg">{entry.label}</span>
                                            <code className="ml-1.5 font-mono text-[11px] text-fg-subtle">{entry.permission}</code>
                                            {CLINICAL_PERMISSIONS.includes(entry.permission) && <ClinicalDataBadge className="ml-1.5 align-middle" />}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
