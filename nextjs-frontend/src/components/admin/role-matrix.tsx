"use client";

import { Lock, Minus, Plus, ShieldAlert } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form";
import { Table, TD, TH, THead } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { updateRolePermissionsAction } from "@/lib/actions/admin";
import type { ActionState } from "@/lib/actions/state";
import { DOCTOR_ONLY_PERMISSION_REASON, isDoctorOnlyPermission } from "@/lib/auth/permissions";
import type { Permission, Role } from "@/lib/domain/types";
import { pluralize } from "@/lib/format";
import type { PermissionCatalogEntry } from "@/lib/services/admin";
import { cn } from "@/lib/utils";
import { PERMISSION_GROUP_ORDER, SENSITIVE_PERMISSION_GROUP, SENSITIVE_PERMISSION_NOTE } from "./admin-format";

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

/** Permission × role checkbox grid with per-role save, diff summary and confirmation. */
export function RoleMatrix({ roles, catalog }: { roles: MatrixRole[]; catalog: PermissionCatalogEntry[] }) {
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
            toast({ title: result.message ?? "Permissions saved." });
        } else {
            setError(result.message);
        }
        return result;
    }, INITIAL_STATE);

    const openConfirm = (role: Role) => {
        setError(undefined);
        setConfirming(role);
    };

    const labelOf = (permission: Permission) => catalog.find((entry) => entry.permission === permission)?.label ?? permission;
    const diffs = Object.fromEntries(roles.map((r) => [r.role, diffFor(r.permissions, draft[r.role])])) as Record<Role, Diff>;
    const dirtyRoles = roles.filter((r) => diffs[r.role].added.length + diffs[r.role].removed.length > 0);

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
                title="Permission matrix"
                description="Tick what each role may do, then save that role. Nothing changes until you save."
                action={
                    <p aria-live="polite" className={cn("text-[13px]", dirtyRoles.length > 0 ? "font-medium text-warning-fg" : "text-fg-subtle")}>
                        {dirtyRoles.length > 0 ? `Unsaved changes: ${dirtyRoles.map((r) => r.label).join(", ")}` : "All changes saved"}
                    </p>
                }
                className="flex-wrap"
            />
            <div id={CLINICAL_REASON_ID} className="px-5 pb-4">
                <InlineNote icon={Lock}>{DOCTOR_ONLY_PERMISSION_REASON}, so they can&apos;t be granted to other roles.</InlineNote>
            </div>
            <div className="border-t border-border">
                <Table caption="Permissions granted to each role" className="relative min-w-[640px] md:min-w-[720px]">
                    <THead className="bg-surface-muted">
                        <tr>
                            <TH className="sticky left-0 z-10 w-44 bg-surface-muted md:w-[40%]">Permission</TH>
                            {roles.map((r) => (
                                <TH key={r.role} className="py-2 text-center">
                                    <span className="block text-fg">{r.label}</span>
                                    <span className="block font-normal text-fg-subtle">{pluralize(r.memberCount, "account")}</span>
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
                                            <span className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{group}</span>
                                            {sensitive && (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-fg">
                                                    <ShieldAlert aria-hidden className="size-3.5" />
                                                    {SENSITIVE_PERMISSION_NOTE}
                                                </span>
                                            )}
                                        </span>
                                    </th>
                                </tr>
                                {entries.map((entry) => (
                                    <tr key={entry.permission} className="transition-colors hover:bg-surface-muted/50">
                                        <th scope="row" className="sticky left-0 z-10 bg-surface px-5 py-2.5 text-left font-normal">
                                            <span className="flex items-start gap-2">
                                                {sensitive && <ShieldAlert aria-label="Clinical data" role="img" className="mt-0.5 size-3.5 shrink-0 text-warning-fg" />}
                                                <span className="min-w-0">
                                                    <span className="block text-sm text-fg">{entry.label}</span>
                                                    <code className="font-mono text-[11px] text-fg-subtle">{entry.permission}</code>
                                                    {isDoctorOnlyPermission(entry.permission) && (
                                                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-fg-muted">
                                                            <Lock aria-hidden className="size-3 shrink-0" />
                                                            Sports doctor only
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
                                                        disabled={pending || locked}
                                                        onChange={(event) => toggle(r.role, entry.permission, event.target.checked)}
                                                        aria-label={`${r.label}: ${entry.label}${changed ? " (unsaved)" : ""}`}
                                                        aria-describedby={locked ? CLINICAL_REASON_ID : undefined}
                                                        title={locked ? DOCTOR_ONLY_PERMISSION_REASON : undefined}
                                                        className="size-4 cursor-pointer align-middle accent-[var(--primary)] disabled:cursor-not-allowed"
                                                    />
                                                </TD>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        );
                    })}
                    <tfoot className="border-t border-border bg-surface-muted">
                        <tr>
                            <th scope="row" className="sticky left-0 z-10 bg-surface-muted px-5 py-3 text-left text-xs font-semibold text-fg-muted">
                                Save per role
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
                                                    <span className="sr-only"> unsaved changes for {r.label}</span>
                                                </span>
                                                <Button size="sm" onClick={() => openConfirm(r.role)}>
                                                    Save<span className="sr-only"> {r.label}</span>
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => discard(r.role)}>
                                                    Discard<span className="sr-only"> {r.label} changes</span>
                                                </Button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-fg-subtle">No changes</span>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    </tfoot>
                </Table>
            </div>

            <ConfirmDialog
                open={confirmRole !== null}
                onClose={() => setConfirming(null)}
                onConfirm={save}
                pending={pending}
                tone={confirmDiff && confirmDiff.removed.length > 0 ? "danger" : "primary"}
                title={`Save ${confirmRole?.label ?? ""} permissions?`}
                confirmLabel="Save permissions"
                description={
                    confirmRole
                        ? `Applies immediately to ${pluralize(confirmRole.memberCount, `${confirmRole.label} account`)}. Active members are notified that their access changed.`
                        : ""
                }
            >
                {confirmDiff && (
                    <div className="flex flex-col gap-3 text-sm">
                        {confirmDiff.added.length > 0 && (
                            <div>
                                <p className="font-medium text-fg">Adds</p>
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
                                <p className="font-medium text-fg">Removes</p>
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
                                No other role can hold clinical permissions, so nobody will be able to use the ones you remove until they are restored here.
                            </InlineNote>
                        )}
                        <FormMessage status={error ? "error" : "idle"} message={error} />
                    </div>
                )}
            </ConfirmDialog>
        </>
    );
}
