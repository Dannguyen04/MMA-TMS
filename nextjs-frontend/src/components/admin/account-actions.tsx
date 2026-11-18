"use client";

import { PenLine, Trash2 } from "lucide-react";
import { useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { toFormData } from "@/components/ui/use-action-form";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import { deleteAccountAction, updateAccountAction } from "@/lib/actions/admin";
import { IDLE } from "@/lib/actions/state";
import type { User } from "@/lib/domain/types";
import { AccountProfileFields, type StaffAccount } from "./account-profile-fields";

export interface AccountActionsProps {
    user: Pick<User, "id" | "name" | "email">;
    /** The profile to edit; null for administrators, who have none, and for a profile that couldn't be read. */
    account: StaffAccount | null;
    /** False on your own account. */
    canDelete: boolean;
    /** Today's academy date (YYYY-MM-DD). */
    today: string;
}

/** Edit-profile and delete actions for one account, in the user service's terms (`usesUserServiceForms`). */
export function AccountActions({ user, account, canDelete, today }: AccountActionsProps) {
    const t = useT();
    const toast = useToast();
    const [editing, setEditing] = useState(false);
    // On success the action opens the user list, so there is nothing to report here.
    const removal = useConfirmAction((userId: string) => deleteAccountAction(IDLE, toFormData({ userId })));

    return (
        <>
            {account && (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                    <PenLine aria-hidden />
                    {t("screens.admin.accountActions.edit")}
                </Button>
            )}
            {canDelete && (
                <Button variant="danger-soft" onClick={() => removal.request(user.id)}>
                    <Trash2 aria-hidden />
                    {t("screens.admin.accountActions.delete")}
                </Button>
            )}

            {account && (
                <ActionDialog
                    open={editing}
                    onClose={() => setEditing(false)}
                    title={t("screens.admin.accountActions.edit")}
                    description={user.email}
                    size="lg"
                    action={updateAccountAction}
                    submitLabel={t("screens.admin.common.saveChanges")}
                    pendingLabel={t("screens.admin.common.saving")}
                    onSuccess={(state) => toast({ title: state.message ?? t("screens.admin.accountActions.updated") })}
                >
                    {(form) => (
                        <>
                            <input type="hidden" name="userId" value={user.id} />
                            <input type="hidden" name="role" value={account.role} />
                            <AccountProfileFields form={form} role={account.role} initial={account} today={today} />
                        </>
                    )}
                </ActionDialog>
            )}

            <ConfirmDialog
                {...removal.dialogProps}
                tone="danger"
                title={t("screens.admin.accountActions.deleteTitle", { name: user.name })}
                confirmLabel={t("screens.admin.accountActions.delete")}
                description={t("screens.admin.accountActions.deleteDescription", { name: user.name })}
            />
        </>
    );
}
