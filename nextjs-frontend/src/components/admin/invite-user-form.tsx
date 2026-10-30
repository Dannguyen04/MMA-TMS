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
import type { MessageKey } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { roleChoiceOptions, type RoleOption } from "./role-options";

/** Invites a new account. On success the action opens the new user's page. */
export function InviteUserForm({ roles, defaultRole }: { roles: RoleOption[]; defaultRole: Role }) {
    const t = useT();
    const form = useActionForm(inviteUserAction, { id: "invite" });
    const [role, setRole] = useState<Role>(defaultRole);
    const { control, error } = form;
    const emailHint = t("screens.admin.invite.emailHint");
    const titleHint = t("screens.admin.invite.titleHint");

    return (
        <form {...form.formProps}>
            <div className="flex flex-col gap-6 px-5 pb-6">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label={t("screens.admin.common.fullName")} htmlFor={control("name").id} required error={error("name")}>
                        <Input {...control("name", { required: true })} autoComplete="off" placeholder={t("screens.admin.invite.namePlaceholder")} />
                    </Field>
                    <Field label={t("screens.admin.common.email")} htmlFor={control("email").id} required hint={emailHint} error={error("email")}>
                        <Input
                            {...control("email", { hint: emailHint, required: true })}
                            type="email"
                            autoComplete="off"
                            placeholder={t("screens.admin.common.emailPlaceholder")}
                        />
                    </Field>
                </div>

                <ChoiceGroup
                    id={control("role").id}
                    name="role"
                    legend={t("screens.admin.common.role")}
                    required
                    columns={2}
                    hint={t("screens.admin.roleOptions.hint")}
                    options={roleChoiceOptions(roles, t)}
                    value={role}
                    onChange={setRole}
                    error={error("role")}
                />

                <Field label={t("screens.admin.common.jobTitle")} htmlFor={control("title").id} required hint={titleHint} error={error("title")} className="sm:max-w-md">
                    <Input
                        {...control("title", { hint: titleHint, required: true })}
                        autoComplete="off"
                        placeholder={t(`screens.admin.invite.titleExample.${role}` as MessageKey)}
                    />
                </Field>

                <FormMessage {...form.message} />
            </div>
            <CardFooter className="justify-end bg-surface-muted/50">
                <ButtonLink href={routes.admin.users} variant="secondary">
                    {t("screens.admin.common.cancel")}
                </ButtonLink>
                <SubmitButton pending={form.pending} pendingLabel={t("screens.admin.invite.sending")}>
                    {t("screens.admin.invite.send")}
                </SubmitButton>
            </CardFooter>
        </form>
    );
}
