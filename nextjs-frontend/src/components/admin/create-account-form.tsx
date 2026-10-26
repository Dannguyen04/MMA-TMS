"use client";

import { Check, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
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
import { ROLE_HINT, roleChoiceOptions, type RoleOption } from "./role-options";

const EMAIL_HINT = "They sign in with this email. Each account needs its own.";
const PASSWORD_HINT = `${PASSWORD_LENGTH.min} to ${PASSWORD_LENGTH.max} characters. Share it privately; they can choose their own with “Forgot password”.`;

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
    const form = useActionForm(createAccountAction, { id: "create-account" });
    const [role, setRole] = useState<Role>(presetRole ?? defaultRole);
    const [pickingRole, setPickingRole] = useState(presetRole === null);
    const { control, error } = form;
    const email = control("email", { hint: EMAIL_HINT, required: true });

    const steps: FormStepDefinition[] =
        role === "admin"
            ? [{ id: "account", label: "Account", description: "Role, email and first password" }]
            : [
                  { id: "account", label: "Account", description: "Role, email and first password" },
                  { id: "profile", label: `${ROLE_LABELS[role]} profile`, description: role === "fighter" ? "Name, birth date, weight class" : "Name and role details" },
              ];

    return (
        <form {...form.formProps} className="px-5 pb-5">
            <FormSteps
                steps={steps}
                state={form.state}
                message={<FormMessage {...form.message} />}
                cancel={
                    <ButtonLink href={routes.admin.users} variant="secondary" size="lg" className="w-full sm:h-9 sm:w-auto sm:px-3.5 sm:text-sm">
                        Cancel
                    </ButtonLink>
                }
                submit={
                    <SubmitButton size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm" pending={form.pending} pendingLabel="Creating account…">
                        Create account
                    </SubmitButton>
                }
            >
                <FormStep id="account" className="flex flex-col gap-6">
                    {pickingRole ? (
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
                    ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted px-3.5 py-2.5">
                            <input type="hidden" name="role" value={role} />
                            <p className="text-sm text-fg-muted">
                                Creating a <span className="font-medium text-fg">{ROLE_LABELS[role].toLowerCase()}</span> account
                            </p>
                            <Button variant="ghost" size="sm" onClick={() => setPickingRole(true)}>
                                Change role
                            </Button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <Field label="Email" htmlFor={email.id} required hint={EMAIL_HINT} error={error("email")}>
                            <Input {...email} type="email" autoComplete="off" placeholder="name@lotus-combat.test" />
                        </Field>
                        <FirstPasswordField form={form} />
                    </div>

                    {role === "admin" && (
                        <InlineNote icon={ShieldCheck}>Administrators have no fighter, coach or doctor profile: the email and password are all the account needs.</InlineNote>
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
    const password = form.control("password", { hint: PASSWORD_HINT, required: true });
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
            <Field label="First password" htmlFor={password.id} required hint={PASSWORD_HINT} error={form.error("password")}>
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
                    {generated ? "Generate another" : "Generate password"}
                </Button>
            </div>
            {showGenerated && (
                <div className="flex flex-col gap-2 rounded-lg bg-surface-muted px-3 py-2.5 ring-1 ring-border ring-inset">
                    <div className="flex items-center justify-between gap-2">
                        <code className="min-w-0 font-mono text-sm break-all text-fg select-all">{generated}</code>
                        <Button variant="ghost" size="sm" onClick={copyGenerated} aria-label={copy === "copied" ? "Password copied" : "Copy password"}>
                            {copy === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
                            {copy === "copied" ? "Copied" : "Copy"}
                        </Button>
                    </div>
                    <p className="text-[13px] text-fg-muted" aria-live="polite">
                        {copy === "failed"
                            ? "Couldn't copy. Select the password and copy it yourself."
                            : "Copy it now and give it to them privately. It isn't shown again once the account is created."}
                    </p>
                </div>
            )}
        </div>
    );
}
