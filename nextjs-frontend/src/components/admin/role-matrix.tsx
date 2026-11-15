"use client";

import { Lock, Minus, Plus, ShieldAlert } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form";
import { Table, TD, TH, THead } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { updateRolePermissionsAction } from "@/lib/actions/admin";
import type { ActionState } from "@/lib/actions/state";
import { isDoctorOnlyPermission } from "@/lib/auth/permissions";
import type { Permission, PermissionCatalogEntry, Role } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { countLabel, PERMISSION_GROUP_ORDER, permissionGroupLabel, permissionLabel, roleInSentence, SENSITIVE_PERMISSION_GROUP } from "./admin-format";

export interface MatrixRole {
    role: Role;
    label: string;
    permissions: Permission[];
    memberCount: number;
}

const INITIAL_STATE: ActionState<Permission[]> = { status: "idle" };
const CLINICAL_REASON_ID = "clinical-permission-reason";

interface Diff {
    added: Permission[];
    removed: Permission[];
}

function diffFor(saved: Permission[], draft: Permission[]): Diff {
    return { added: draft.filter((p) => !saved.includes(p)), removed: saved.filter((p) => !draft.includes(p)) };
}

/**
 * Permission × role checkbox grid with per-role save, diff summary and confirmation. Read-only while role permissions
 * can't be saved: it then shows each role's baseline grants.
 */
export function RoleMatrix({ roles, catalog, readOnly = false }: { roles: MatrixRole[]; catalog: PermissionCatalogEntry[]; readOnly?: boolean }) {
    const t = useT();
    const locale = useLocale();
    const toast = useToast();
    const [draft, setDraft] = useState<Record<Role, Permission[]>>(
        () => Object.fromEntries(roles.map((r) => [r.role, r.permissions])) as Record<Role, Permission[]>,
    );
    const [confirming, setConfirming] = useState<Role | null>(null);
    const [error, setError] = useState<string | undefined>();

    const [, dispatch, pending] = useActionState(async (previous: ActionState<Permission[]>, formData: FormData) => {
        const result = await updateRolePermissionsAction(previous, formData);
        if (result.status === "success") {
            const role = formData.get("role") as Role;
            const saved = result.data;
            if (saved) setDraft((current) => ({ ...current, [role]: saved }));
            setConfirming(null);
            toast({ title: result.message ?? t("screens.admin.matrix.saved") });
        } else {
            setError(result.message);
        }
        return result;
    }, INITIAL_STATE);

    const openConfirm = (role: Role) => {
        setError(undefined);
        setConfirming(role);
    };

    const labelOf = (permission: Permission) => {
        const entry = catalog.find((candidate) => candidate.permission === permission);
        return entry ? permissionLabel(t, entry) : permission;
    };
    const diffs = Object.fromEntries(roles.map((r) => [r.role, diffFor(r.permissions, draft[r.role])])) as Record<Role, Diff>;
    const dirtyRoles = roles.filter((r) => diffs[r.role].added.length + diffs[r.role].removed.length > 0);
    const doctorOnlyReason = t("screens.admin.permission.doctorOnlyReason");

    const toggle = (role: Role, permission: Permission, checked: boolean) => {
        setDraft((current) => ({
            ...current,
            [role]: checked ? [...current[role], permission] : current[role].filter((p) => p !== permission),
        }));
    };

    const discard = (role: Role) => {
        const saved = roles.find((r) => r.role === role)?.permissions ?? [];
        setDraft((current) => ({ ...current, [role]: saved }));
    };

    const save = () => {
        if (!confirming) return;
        const formData = new FormData();
        formData.set("role", confirming);
        draft[confirming].forEach((permission) => formData.append("permissions", permission));
        startTransition(() => dispatch(formData));
    };

    const confirmRole = roles.find((r) => r.role === confirming) ?? null;
    const confirmDiff = confirming ? diffs[confirming] : null;
    // Only the sports doctor role can hold clinical permissions, so removing them leaves nobody able to use them.
    const removesClinical = confirming === "doctor" && (confirmDiff?.removed ?? []).some(isDoctorOnlyPermission);

    return (
        <>
            <CardHeader
                title={t("screens.admin.matrix.title")}
                description={readOnly ? t("screens.admin.matrix.readOnly") : t("screens.admin.matrix.editable")}
                action={
                    readOnly ? undefined : (
                        <p aria-live="polite" className={cn("text-[13px]", dirtyRoles.length > 0 ? "font-medium text-warning-fg" : "text-fg-subtle")}>
                            {dirtyRoles.length > 0
                                ? t("screens.admin.matrix.unsaved", { roles: dirtyRoles.map((r) => r.label).join(", ") })
                                : t("screens.admin.common.allChangesSaved")}
                        </p>
                    )
                }
                className="flex-wrap"
            />
            <div id={CLINICAL_REASON_ID} className="px-5 pb-4">
                <InlineNote icon={Lock}>{t("screens.admin.matrix.clinicalReason")}</InlineNote>
            </div>
            <div className="border-t border-border">
                <Table caption={t("screens.admin.matrix.caption")} className="relative min-w-[640px] md:min-w-[720px]">
                    <THead className="bg-surface-muted">
                        <tr>
                            <TH className="sticky left-0 z-10 w-44 bg-surface-muted md:w-[40%]">{t("screens.admin.matrix.permission")}</TH>
                            {roles.map((r) => (
                                <TH key={r.role} className="py-2 text-center">
                                    <span className="block text-fg">{r.label}</span>
                                    <span className="block font-normal text-fg-subtle">{countLabel(t, "screens.admin.count.accounts", r.memberCount)}</span>
                                </TH>
                            ))}
                        </tr>
                    </THead>
                    {PERMISSION_GROUP_ORDER.map((group) => {
                        const entries = catalog.filter((entry) => entry.group === group);
                        const sensitive = group === SENSITIVE_PERMISSION_GROUP;
                        return (
                            <tbody key={group} className="divide-y divide-border border-t border-border">
                                <tr className={sensitive ? "bg-warning-soft/50" : "bg-surface-muted/40"}>
                                    <th scope="colgroup" colSpan={roles.length + 1} className="px-5 py-2 text-left">
                                        <span className="sticky left-5 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                            <span className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{permissionGroupLabel(t, group)}</span>
                                            {sensitive && (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-fg">
                                                    <ShieldAlert aria-hidden className="size-3.5" />
                                                    {t("screens.admin.permission.sensitiveNote")}
                                                </span>
                                            )}
                                        </span>
                                    </th>
                                </tr>
                                {entries.map((entry) => {
                                    const label = permissionLabel(t, entry);
                                    return (
                                        <tr key={entry.permission} className="transition-colors hover:bg-surface-muted/50">
                                            <th scope="row" className="sticky left-0 z-10 bg-surface px-5 py-2.5 text-left font-normal">
                                                <span className="flex items-start gap-2">
                                                    {sensitive && (
                                                        <ShieldAlert aria-label={t("screens.admin.clinicalData")} role="img" className="mt-0.5 size-3.5 shrink-0 text-warning-fg" />
                                                    )}
                                                    <span className="min-w-0">
                                                        <span className="block text-sm text-fg">{label}</span>
                                                        <code className="font-mono text-[11px] text-fg-subtle">{entry.permission}</code>
                                                        {isDoctorOnlyPermission(entry.permission) && (
                                                            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-fg-muted">
                                                                <Lock aria-hidden className="size-3 shrink-0" />
                                                                {t("screens.admin.matrix.doctorOnly")}
                                                            </span>
                                                        )}
                                                    </span>
                                                </span>
                                            </th>
                                            {roles.map((r) => {
                                                const checked = draft[r.role].includes(entry.permission);
                                                const changed = checked !== r.permissions.includes(entry.permission);
                                                // A clinical permission a non-doctor role already holds can still be removed.
                                                const locked = r.role !== "doctor" && isDoctorOnlyPermission(entry.permission) && !checked;
                                                return (
                                                    <TD key={r.role} className={cn("py-2.5 text-center", changed && "bg-primary-soft/60")}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            disabled={readOnly || pending || locked}
                                                            onChange={(event) => toggle(r.role, entry.permission, event.target.checked)}
                                                            aria-label={t(changed ? "screens.admin.matrix.checkboxUnsaved" : "screens.admin.matrix.checkbox", {
                                                                role: r.label,
                                                                permission: label,
                                                            })}
                                                            aria-describedby={locked ? CLINICAL_REASON_ID : undefined}
                                                            title={locked ? doctorOnlyReason : undefined}
                                                            className="size-4 cursor-pointer align-middle accent-[var(--primary)] disabled:cursor-not-allowed"
                                                        />
                                                    </TD>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        );
                    })}
                    {!readOnly && (
                        <tfoot className="border-t border-border bg-surface-muted">
                            <tr>
                                <th scope="row" className="sticky left-0 z-10 bg-surface-muted px-5 py-3 text-left text-xs font-semibold text-fg-muted">
                                    {t("screens.admin.matrix.savePerRole")}
                                </th>
                                {roles.map((r) => {
                                    const diff = diffs[r.role];
                                    const dirty = diff.added.length + diff.removed.length > 0;
                                    return (
                                        <td key={r.role} className="px-2 py-3 text-center align-top">
                                            {dirty ? (
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <span className="text-xs font-medium text-fg tabular-nums">
                                                        {diff.added.length > 0 && <span className="text-success-fg">+{diff.added.length}</span>}
                                                        {diff.added.length > 0 && diff.removed.length > 0 && " "}
                                                        {diff.removed.length > 0 && <span className="text-danger-fg">−{diff.removed.length}</span>}
                                                        <span className="sr-only"> {t("screens.admin.matrix.unsavedFor", { role: r.label })}</span>
                                                    </span>
                                                    <Button size="sm" onClick={() => openConfirm(r.role)}>
                                                        {t("screens.admin.matrix.save")}
                                                        <span className="sr-only"> {r.label}</span>
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => discard(r.role)}>
                                                        {t("screens.admin.common.discard")}
                                                        <span className="sr-only"> {t("screens.admin.matrix.roleChanges", { role: r.label })}</span>
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-fg-subtle">{t("screens.admin.matrix.noChanges")}</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tfoot>
                    )}
                </Table>
            </div>

            <ConfirmDialog
                open={confirmRole !== null}
                onClose={() => setConfirming(null)}
                onConfirm={save}
                pending={pending}
                tone={confirmDiff && confirmDiff.removed.length > 0 ? "danger" : "primary"}
                title={t("screens.admin.matrix.confirmTitle", { role: confirmRole?.label ?? "" })}
                confirmLabel={t("screens.admin.matrix.confirmButton")}
                description={
                    confirmRole
                        ? countLabel(t, "screens.admin.matrix.confirmDescription", confirmRole.memberCount, { role: roleInSentence(confirmRole.label, locale) })
                        : ""
                }
            >
                {confirmDiff && (
                    <div className="flex flex-col gap-3 text-sm">
                        {confirmDiff.added.length > 0 && (
                            <div>
                                <p className="font-medium text-fg">{t("screens.admin.matrix.adds")}</p>
                                <ul className="mt-1 flex flex-col gap-1">
                                    {confirmDiff.added.map((permission) => (
                                        <li key={permission} className="flex items-start gap-2 text-fg-muted">
                                            <Plus aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success-fg" />
                                            {labelOf(permission)}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {confirmDiff.removed.length > 0 && (
                            <div>
                                <p className="font-medium text-fg">{t("screens.admin.matrix.removes")}</p>
                                <ul className="mt-1 flex flex-col gap-1">
                                    {confirmDiff.removed.map((permission) => (
                                        <li key={permission} className="flex items-start gap-2 text-fg-muted">
                                            <Minus aria-hidden className="mt-0.5 size-3.5 shrink-0 text-danger-fg" />
                                            {labelOf(permission)}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {removesClinical && (
                            <InlineNote icon={ShieldAlert} tone="warning">
                                {t("screens.admin.matrix.removesClinical")}
                            </InlineNote>
                        )}
                        <FormMessage status={error ? "error" : "idle"} message={error} />
                    </div>
                )}
            </ConfirmDialog>
        </>
    );
}
