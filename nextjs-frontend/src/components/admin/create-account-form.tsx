"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { ButtonLink } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { createAccountAction } from "@/lib/actions/admin";
import { ACCOUNT_LIMITS } from "@/lib/domain/account-contract";
import { ROLE_LABELS } from "@/lib/domain/labels";
import type { Role } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { AccountProfileFields } from "./account-profile-fields";
import { ROLE_HINT, roleChoiceOptions, type RoleOption } from "./role-options";

const EMAIL_HINT = "They sign in with this email. Each account needs its own.";
const PASSWORD_HINT = `${ACCOUNT_LIMITS.passwordMin} to ${ACCOUNT_LIMITS.passwordMax} characters. Share it privately; they can choose their own with “Forgot password”.`;

/** Creates an account with its first password and the role's profile, as the user service requires. On success the action opens it. */
export function CreateAccountForm({ roles, defaultRole, today }: { roles: RoleOption[]; defaultRole: Role; today: string }) {
    const form = useActionForm(createAccountAction, { id: "create-account" });
    const [role, setRole] = useState<Role>(defaultRole);
    const { control, error } = form;
    const email = control("email", { hint: EMAIL_HINT, required: true });
    const password = control("password", { hint: PASSWORD_HINT, required: true });

    return (
        <form {...form.formProps}>
            <div className="flex flex-col gap-6 px-5 pb-6">
                <ChoiceGroup
                    id={control("role").id}
                    name="role"
                    legend="Role"
                    required
                    columns={2}
                    hint={ROLE_HINT}
                    options={roleChoiceOptions(roles)}
                    value={role}
                    onChange={setRole}
                    error={error("role")}
                />

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="Email" htmlFor={email.id} required hint={EMAIL_HINT} error={error("email")}>
                        <Input {...email} type="email" autoComplete="off" placeholder="name@lotus-combat.test" />
                    </Field>
                    <Field label="First password" htmlFor={password.id} required hint={PASSWORD_HINT} error={error("password")}>
                        <PasswordInput {...password} autoComplete="new-password" minLength={ACCOUNT_LIMITS.passwordMin} maxLength={ACCOUNT_LIMITS.passwordMax} />
                    </Field>
                </div>

                {role === "admin" ? (
                    <InlineNote icon={ShieldCheck}>Administrators have no fighter, coach or doctor profile: the email and password are all the account needs.</InlineNote>
                ) : (
                    <fieldset className="flex min-w-0 flex-col gap-5">
                        <legend className="mb-5 text-sm font-semibold text-fg">{ROLE_LABELS[role]} profile</legend>
                        <AccountProfileFields form={form} role={role} today={today} />
                    </fieldset>
                )}

                <FormMessage {...form.message} />
            </div>
            <CardFooter className="justify-end bg-surface-muted/50">
                <ButtonLink href={routes.admin.users} variant="secondary">
                    Cancel
                </ButtonLink>
                <SubmitButton pending={form.pending} pendingLabel="Creating account…">
                    Create account
                </SubmitButton>
            </CardFooter>
        </form>
    );
}
