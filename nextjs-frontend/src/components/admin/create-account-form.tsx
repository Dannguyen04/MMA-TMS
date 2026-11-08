"use client";

import { Check, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useT } from "@/components/i18n/locale-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { FormStep, FormSteps, type FormStepDefinition } from "@/components/ui/form-steps";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm, type ActionForm } from "@/components/ui/use-action-form";
import { createAccountAction } from "@/lib/actions/admin";
import { PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import { ROLE_LABELS } from "@/lib/domain/labels";
import type { Role } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { AccountProfileFields } from "./account-profile-fields";
import { generatePassword } from "./password-generator";
import { roleChoiceOptions, type RoleOption } from "./role-options";

export interface CreateAccountFormProps {
    roles: RoleOption[];
    defaultRole: Role;
    /** Set when the page was opened for one role (e.g. "Add fighter"): the role starts chosen and folded away. */
    presetRole?: Role | null;
    today: string;
}

/**
 * Creates an account with its first password and the role's profile, as the user service requires, in two steps:
 * the account, then the profile (administrators have none). On success the action opens the new account.
 */
export function CreateAccountForm({ roles, defaultRole, presetRole = null, today }: CreateAccountFormProps) {
    const t = useT();
    const form = useActionForm(createAccountAction, { id: "create-account" });
    const [role, setRole] = useState<Role>(presetRole ?? defaultRole);
    const [pickingRole, setPickingRole] = useState(presetRole === null);
    const { control, error } = form;
    const emailHint = t("adminForms.emailHint");
    const email = control("email", { hint: emailHint, required: true });

    const steps: FormStepDefinition[] =
        role === "admin"
            ? [{ id: "account", label: t("adminForms.account"), description: t("adminForms.accountDesc") }]
            : [
                  { id: "account", label: t("adminForms.account"), description: t("adminForms.accountDesc") },
                  {
                      id: "profile",
                      label: t("adminForms.profile", { role: ROLE_LABELS[role] }),
                      description: role === "fighter" ? t("adminForms.profileFighter") : t("adminForms.profileStaff"),
                  },
              ];

    return (
        <form {...form.formProps} className="px-5 pb-5">
            <FormSteps
                steps={steps}
                state={form.state}
                message={<FormMessage {...form.message} />}
                cancel={
                    <ButtonLink href={routes.admin.users} variant="secondary" size="lg" className="w-full sm:h-9 sm:w-auto sm:px-3.5 sm:text-sm">
                        {t("adminForms.cancel")}
                    </ButtonLink>
                }
                submit={
                    <SubmitButton size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm" pending={form.pending} pendingLabel={t("adminForms.creatingAccount")}>
                        {t("adminForms.create")}
                    </SubmitButton>
                }
            >
                <FormStep id="account" className="flex flex-col gap-6">
                    {pickingRole ? (
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
                    ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted px-3.5 py-2.5">
                            <input type="hidden" name="role" value={role} />
                            <p className="text-sm text-fg-muted">
                                {t("adminForms.creating", { role: ROLE_LABELS[role] })}
                            </p>
                            <Button variant="ghost" size="sm" onClick={() => setPickingRole(true)}>
                                {t("adminForms.changeRole")}
                            </Button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <Field label={t("adminForms.email")} htmlFor={email.id} required hint={emailHint} error={error("email")}>
                            <Input {...email} type="email" autoComplete="off" placeholder={t("adminForms.emailPlaceholder")} />
                        </Field>
                        <FirstPasswordField form={form} />
                    </div>

                    {role === "admin" && (
                        <InlineNote icon={ShieldCheck}>{t("adminForms.adminNote")}</InlineNote>
                    )}
                </FormStep>

                {role !== "admin" && (
                    <FormStep id="profile" className="flex flex-col gap-5">
                        <AccountProfileFields form={form} role={role} today={today} />
                    </FormStep>
                )}
            </FormSteps>
        </form>
    );
}

type CopyState = "idle" | "copied" | "failed";

/**
 * The first password, typed or generated. A generated one is shown once, with a copy button, so the administrator
 * can hand it over privately; it is only ever sent with this form.
 */
function FirstPasswordField({ form }: { form: ActionForm<undefined> }) {
    const t = useT();
    const passwordHint = t("adminForms.passwordHint", { min: PASSWORD_LENGTH.min, max: PASSWORD_LENGTH.max });
    const password = form.control("password", { hint: passwordHint, required: true });
    const [value, setValue] = useState("");
    const [generated, setGenerated] = useState<string | null>(null);
    const [copy, setCopy] = useState<CopyState>("idle");
    const showGenerated = generated !== null && generated === value;

    const write = (next: string) => {
        setValue(next);
        setCopy("idle");
        form.markEdited("password");
    };
    const generate = () => {
        const next = generatePassword();
        setGenerated(next);
        write(next);
    };
    const copyGenerated = async () => {
        if (!generated) return;
        try {
            await navigator.clipboard.writeText(generated);
            setCopy("copied");
        } catch {
            setCopy("failed");
        }
    };

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <Field label={t("adminForms.firstPassword")} htmlFor={password.id} required hint={passwordHint} error={form.error("password")}>
                <PasswordInput
                    {...password}
                    value={value}
                    onChange={(event) => write(event.target.value)}
                    autoComplete="new-password"
                    minLength={PASSWORD_LENGTH.min}
                    maxLength={PASSWORD_LENGTH.max}
                />
            </Field>
            <div>
                <Button variant="secondary" size="sm" onClick={generate}>
                    <KeyRound aria-hidden />
                    {generated ? t("adminForms.generateAnother") : t("adminForms.generate")}
                </Button>
            </div>
            {showGenerated && (
                <div className="flex flex-col gap-2 rounded-lg bg-surface-muted px-3 py-2.5 ring-1 ring-border ring-inset">
                    <div className="flex items-center justify-between gap-2">
                        <code className="min-w-0 font-mono text-sm break-all text-fg select-all">{generated}</code>
                        <Button variant="ghost" size="sm" onClick={copyGenerated} aria-label={copy === "copied" ? t("adminForms.passwordCopied") : t("adminForms.copyPassword")}>
                            {copy === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
                            {copy === "copied" ? t("adminForms.copied") : t("adminForms.copy")}
                        </Button>
                    </div>
                    <p className="text-[13px] text-fg-muted" aria-live="polite">
                        {copy === "failed" ? t("adminForms.copyFailed") : t("adminForms.copyNow")}
                    </p>
                </div>
            )}
        </div>
    );
}
