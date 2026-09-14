"use client";

import { Ban, MailPlus, PenLine, RotateCcw, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
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
}

type AccountStatus = "active" | "suspended";

/** Edit, suspend / reactivate and resend-invite actions for one account. */
export function UserActions({ user, roleLockReason, isSelf }: UserActionsProps) {
    const toast = useToast();
    const [editing, setEditing] = useState(false);
    const nextStatus: AccountStatus = user.status === "suspended" ? "active" : "suspended";

    const statusChange = useConfirmAction((status: AccountStatus) => setUserStatusAction(IDLE, toFormData({ userId: user.id, status })), {
        onSuccess: (state, status) => toast({ tone: status === "active" ? "success" : "warning", title: state.message ?? "Account status updated." }),
    });
    const resend = useConfirmAction((userId: string) => resendInviteAction(IDLE, toFormData({ userId })), {
        onSuccess: (state) => toast({ title: state.message ?? "Invitation sent again.", description: "The previous link stops working." }),
    });

    /** Nothing to save when the name, title and role are unchanged. */
    const prepareEdit = (fd: FormData): ActionState | void => {
        const role = fd.get("role") ?? user.role;
        if (String(fd.get("name") ?? "").trim() === user.name && String(fd.get("title") ?? "").trim() === user.title && role === user.role) {
            return { status: "error", message: "Nothing has changed yet. Edit the name, job title or role, then save." };
        }
    };

    return (
        <>
            {user.status === "invited" && (
                <Button onClick={() => resend.request(user.id)}>
                    <MailPlus aria-hidden />
                    Resend invite
                </Button>
            )}
            <Button variant="secondary" onClick={() => setEditing(true)}>
                <PenLine aria-hidden />
                Edit account
            </Button>
            {!isSelf &&
                (user.status === "suspended" ? (
                    <Button onClick={() => statusChange.request("active")}>
                        <RotateCcw aria-hidden />
                        Reactivate
                    </Button>
                ) : (
                    <Button variant="danger-soft" onClick={() => statusChange.request("suspended")}>
                        <Ban aria-hidden />
                        Suspend
                    </Button>
                ))}

            <ActionDialog
                open={editing}
                onClose={() => setEditing(false)}
                title="Edit account"
                description={user.email}
                action={updateUserAction}
                prepare={prepareEdit}
                submitLabel="Save changes"
                pendingLabel="Saving…"
                onSuccess={(state) => toast({ title: state.message ?? "Account updated." })}
            >
                {(form) => <EditUserFields form={form} user={user} roleLockReason={roleLockReason} />}
            </ActionDialog>

            <ConfirmDialog
                {...statusChange.dialogProps}
                tone={nextStatus === "suspended" ? "danger" : "primary"}
                title={nextStatus === "suspended" ? `Suspend ${user.name}?` : `Reactivate ${user.name}?`}
                confirmLabel={nextStatus === "suspended" ? "Suspend account" : "Reactivate account"}
                description={
                    nextStatus === "suspended"
                        ? user.status === "invited"
                            ? `The invitation link stops working and ${user.name} won't be able to create a password until you reactivate the account.`
                            : `${user.name} is signed out on their next request and loses access to every page and notification. Their records and history are kept, and you can reactivate the account at any time.`
                        : `${user.name} can sign in again with the same ${ROLE_LABELS[user.role]} access they had before, and will be notified.`
                }
            />

            <ConfirmDialog
                {...resend.dialogProps}
                tone="primary"
                title={`Send ${user.name}'s invitation again?`}
                confirmLabel="Resend invitation"
                description={`A new invitation email goes to ${user.email}. The link in the previous invitation stops working.`}
            />
        </>
    );
}

function EditUserFields({ form, user, roleLockReason }: { form: ActionForm<undefined>; user: UserActionsProps["user"]; roleLockReason: string | null }) {
    const [role, setRole] = useState<Role>(user.role);
    const roleHint = roleLockReason ?? "Their menu and access switch to the new role immediately, and they're notified.";
    const { control, error } = form;

    return (
        <>
            <input type="hidden" name="userId" value={user.id} />
            <Field label="Full name" htmlFor={control("name").id} required error={error("name")}>
                <Input {...control("name", { required: true })} defaultValue={user.name} />
            </Field>
            <Field label="Job title" htmlFor={control("title").id} required error={error("title")}>
                <Input {...control("title", { required: true })} defaultValue={user.title} />
            </Field>
            <div>
                <Field label="Role" htmlFor={control("role").id} hint={roleHint} error={error("role")}>
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
                            The sports doctor role can open medical records and manage Medical Clearance.
                        </InlineNote>
                    )}
                </div>
            </div>
        </>
    );
}
