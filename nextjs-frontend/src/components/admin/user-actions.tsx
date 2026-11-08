"use client";

import { Ban, MailPlus, PenLine, RotateCcw, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useT } from "@/components/i18n/locale-provider";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { toFormData, type ActionForm } from "@/components/ui/use-action-form";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import { resendInviteAction, setUserStatusAction, updateUserAction } from "@/lib/actions/admin";
import { IDLE, type ActionState } from "@/lib/actions/state";
import { ROLE_LABELS } from "@/lib/domain/labels";
import type { Role, User } from "@/lib/domain/types";
import { ROLE_ORDER } from "./admin-format";

export interface UserActionsProps {
    user: Pick<User, "id" | "name" | "email" | "title" | "role" | "status">;
    /** Why the role can't change (own account or linked profile); null when it can. */
    roleLockReason: string | null;
    isSelf: boolean;
    /** Which actions the service offers; the others stay hidden. */
    available: { edit: boolean; status: boolean };
}

type AccountStatus = "active" | "suspended";

/** Edit, suspend / reactivate and resend-invite actions for one account. */
export function UserActions({ user, roleLockReason, isSelf, available }: UserActionsProps) {
    const t = useT();
    const toast = useToast();
    const [editing, setEditing] = useState(false);
    const nextStatus: AccountStatus = user.status === "suspended" ? "active" : "suspended";

    const statusChange = useConfirmAction((status: AccountStatus) => setUserStatusAction(IDLE, toFormData({ userId: user.id, status })), {
        onSuccess: (state, status) => toast({ tone: status === "active" ? "success" : "warning", title: state.message ?? t("adminForms.statusUpdated") }),
    });
    const resend = useConfirmAction((userId: string) => resendInviteAction(IDLE, toFormData({ userId })), {
        onSuccess: (state) => toast({ title: state.message ?? t("adminForms.inviteAgain"), description: t("adminForms.inviteAgainText") }),
    });

    /** Nothing to save when the name, title and role are unchanged. */
    const prepareEdit = (fd: FormData): ActionState | void => {
        const role = fd.get("role") ?? user.role;
        if (String(fd.get("name") ?? "").trim() === user.name && String(fd.get("title") ?? "").trim() === user.title && role === user.role) {
            return { status: "error", message: t("adminForms.nothingChanged") };
        }
    };

    return (
        <>
            {available.status && user.status === "invited" && (
                <Button onClick={() => resend.request(user.id)}>
                    <MailPlus aria-hidden />
                    {t("adminForms.resend")}
                </Button>
            )}
            {available.edit && (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                    <PenLine aria-hidden />
                    {t("adminForms.editAccount")}
                </Button>
            )}
            {available.status &&
                !isSelf &&
                (user.status === "suspended" ? (
                    <Button onClick={() => statusChange.request("active")}>
                        <RotateCcw aria-hidden />
                        {t("adminForms.reactivate")}
                    </Button>
                ) : (
                    <Button variant="danger-soft" onClick={() => statusChange.request("suspended")}>
                        <Ban aria-hidden />
                        {t("adminForms.suspend")}
                    </Button>
                ))}

            <ActionDialog
                open={editing}
                onClose={() => setEditing(false)}
                title={t("adminForms.editAccount")}
                description={user.email}
                action={updateUserAction}
                prepare={prepareEdit}
                submitLabel={t("adminForms.save")}
                pendingLabel={t("adminForms.saving")}
                onSuccess={(state) => toast({ title: state.message ?? t("adminForms.accountUpdated") })}
            >
                {(form) => <EditUserFields form={form} user={user} roleLockReason={roleLockReason} />}
            </ActionDialog>

            <ConfirmDialog
                {...statusChange.dialogProps}
                tone={nextStatus === "suspended" ? "danger" : "primary"}
                title={nextStatus === "suspended" ? t("adminForms.suspendTitle", { name: user.name }) : t("adminForms.reactivateTitle", { name: user.name })}
                confirmLabel={nextStatus === "suspended" ? t("adminForms.suspendAccount") : t("adminForms.reactivateAccount")}
                description={
                    nextStatus === "suspended"
                        ? user.status === "invited"
                            ? t("adminForms.suspendInvited", { name: user.name })
                            : t("adminForms.suspendActive", { name: user.name })
                        : t("adminForms.reactivateText", { name: user.name, role: ROLE_LABELS[user.role] })
                }
            />

            <ConfirmDialog
                {...resend.dialogProps}
                tone="primary"
                title={t("adminForms.resendTitle", { name: user.name })}
                confirmLabel={t("adminForms.resendConfirm")}
                description={t("adminForms.resendText", { email: user.email })}
            />
        </>
    );
}

function EditUserFields({ form, user, roleLockReason }: { form: ActionForm<undefined>; user: UserActionsProps["user"]; roleLockReason: string | null }) {
    const t = useT();
    const [role, setRole] = useState<Role>(user.role);
    const roleHint = roleLockReason ?? t("adminForms.roleSwitchHint");
    const { control, error } = form;

    return (
        <>
            <input type="hidden" name="userId" value={user.id} />
            <Field label={t("adminForms.fullName")} htmlFor={control("name").id} required error={error("name")}>
                <Input {...control("name", { required: true })} defaultValue={user.name} />
            </Field>
            <Field label={t("adminForms.jobTitle")} htmlFor={control("title").id} required error={error("title")}>
                <Input {...control("title", { required: true })} defaultValue={user.title} />
            </Field>
            <div>
                <Field label={t("adminForms.role")} htmlFor={control("role").id} hint={roleHint} error={error("role")}>
                    <Select {...control("role", { hint: roleHint })} value={role} disabled={roleLockReason !== null} onChange={(event) => setRole(event.target.value as Role)}>
                        {ROLE_ORDER.map((value) => (
                            <option key={value} value={value}>
                                {ROLE_LABELS[value]}
                            </option>
                        ))}
                    </Select>
                </Field>
                <div aria-live="polite">
                    {role !== user.role && role === "doctor" && (
                        <InlineNote icon={ShieldAlert} tone="warning" className="mt-3">
                            {t("adminForms.doctorWarn")}
                        </InlineNote>
                    )}
                </div>
            </div>
        </>
    );
}
