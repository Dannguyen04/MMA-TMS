"use client";

import { useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { ButtonLink } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { inviteUserAction } from "@/lib/actions/admin";
import type { Role } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import type { MessageKey } from "@/lib/i18n/translate";
import { roleChoiceOptions, type RoleOption } from "./role-options";

const TITLE_KEYS: Record<Role, MessageKey> = {
    fighter: "adminForms.title.fighter",
    coach: "adminForms.title.coach",
    doctor: "adminForms.title.doctor",
    admin: "adminForms.title.admin",
};

/** Invites a new account. On success the action opens the new user's page. */
export function InviteUserForm({ roles, defaultRole }: { roles: RoleOption[]; defaultRole: Role }) {
    const t = useT();
    const form = useActionForm(inviteUserAction, { id: "invite" });
    const [role, setRole] = useState<Role>(defaultRole);
    const { control, error } = form;

    return (
        <form {...form.formProps}>
            <div className="flex flex-col gap-6 px-5 pb-6">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label={t("adminForms.fullName")} htmlFor={control("name").id} required error={error("name")}>
                        <Input {...control("name", { required: true })} autoComplete="off" placeholder={t("adminForms.namePlaceholder")} />
                    </Field>
                    <Field label={t("adminForms.email")} htmlFor={control("email").id} required hint={t("adminForms.inviteEmailHint")} error={error("email")}>
                        <Input {...control("email", { hint: t("adminForms.inviteEmailHint"), required: true })} type="email" autoComplete="off" placeholder={t("adminForms.emailPlaceholder")} />
                    </Field>
                </div>

                <ChoiceGroup
                    id={control("role").id}
                    name="role"
                    legend={t("adminForms.role")}
                    required
                    columns={2}
                    hint={t("adminForms.roleHint")}
                    options={roleChoiceOptions(roles, t)}
                    value={role}
                    onChange={setRole}
                    error={error("role")}
                />

                <Field label={t("adminForms.jobTitle")} htmlFor={control("title").id} required hint={t("adminForms.titleHint")} error={error("title")} className="sm:max-w-md">
                    <Input {...control("title", { hint: t("adminForms.titleHint"), required: true })} autoComplete="off" placeholder={t("adminForms.titleExample", { example: t(TITLE_KEYS[role]) })} />
                </Field>

                <FormMessage {...form.message} />
            </div>
            <CardFooter className="justify-end bg-surface-muted/50">
                <ButtonLink href={routes.admin.users} variant="secondary">
                    {t("adminForms.cancel")}
                </ButtonLink>
                <SubmitButton pending={form.pending} pendingLabel={t("adminForms.sendingInvite")}>
                    {t("adminForms.sendInvite")}
                </SubmitButton>
            </CardFooter>
        </form>
    );
}
