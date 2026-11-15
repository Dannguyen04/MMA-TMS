import { Check, Minus } from "lucide-react";

import type { Permission, PermissionCatalogEntry } from "@/lib/domain/types";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { CLINICAL_PERMISSIONS, PERMISSION_GROUP_ORDER, permissionGroupLabel, permissionLabel } from "./admin-format";
import { ClinicalDataBadge } from "./admin-badges";

export interface PermissionListProps {
    catalog: PermissionCatalogEntry[];
    granted: Permission[];
    /** The viewer's language. */
    locale: Locale;
    className?: string;
}

/** Granted permissions grouped by area. Groups without access say so explicitly. */
export function PermissionList({ catalog, granted, locale, className }: PermissionListProps) {
    const t = createTranslator(locale);
    return (
        <div className={cn("flex flex-col gap-4", className)}>
            {PERMISSION_GROUP_ORDER.map((group) => {
                const entries = catalog.filter((entry) => entry.group === group && granted.includes(entry.permission));
                const headingId = `permission-group-${group.toLowerCase().replace(/[^a-z]+/g, "-")}`;
                return (
                    <section key={group} aria-labelledby={headingId}>
                        <h3 id={headingId} className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                            {permissionGroupLabel(t, group)}
                        </h3>
                        {entries.length === 0 ? (
                            <p className="mt-1.5 flex items-center gap-2 text-[13px] text-fg-muted">
                                <Minus aria-hidden className="size-3.5 text-fg-subtle" />
                                {t("screens.admin.permission.noAccess")}
                            </p>
                        ) : (
                            <ul className="mt-1.5 flex flex-col gap-1.5">
                                {entries.map((entry) => (
                                    <li key={entry.permission} className="flex items-start gap-2 text-[13px]">
                                        <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success-fg" />
                                        <span className="min-w-0">
                                            <span className="text-fg">{permissionLabel(t, entry)}</span>
                                            <code className="ml-1.5 font-mono text-[11px] text-fg-subtle">{entry.permission}</code>
                                            {CLINICAL_PERMISSIONS.includes(entry.permission) && <ClinicalDataBadge className="ml-1.5 align-middle" locale={locale} />}
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
