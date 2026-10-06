"use client";

import { useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { inviteUserAction } from "@/lib/actions/admin";
import type { Role } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { ROLE_HINT, roleChoiceOptions, type RoleOption } from "./role-options";

const TITLE_EXAMPLES: Record<Role, string> = {
    fighter: "Professional Fighter",
    coach: "Assistant Coach",
    doctor: "Sports Medicine Physician",
    admin: "Platform Engineer",
};

const EMAIL_HINT = "The invitation link is sent here. Emails must be unique.";
const TITLE_HINT = "Shown under their name across the platform.";

/** Invites a new account. On success the action opens the new user's page. */
export function InviteUserForm({ roles, defaultRole }: { roles: RoleOption[]; defaultRole: Role }) {
    const form = useActionForm(inviteUserAction, { id: "invite" });
    const [role, setRole] = useState<Role>(defaultRole);
    const { control, error } = form;

    return (
        <form {...form.formProps}>
            <div className="flex flex-col gap-6 px-5 pb-6">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="Full name" htmlFor={control("name").id} required error={error("name")}>
                        <Input {...control("name", { required: true })} autoComplete="off" placeholder="e.g. Mai Anh Nguyễn" />
                    </Field>
                    <Field label="Email" htmlFor={control("email").id} required hint={EMAIL_HINT} error={error("email")}>
                        <Input {...control("email", { hint: EMAIL_HINT, required: true })} type="email" autoComplete="off" placeholder="name@lotus-combat.test" />
                    </Field>
                </div>

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

                <Field label="Job title" htmlFor={control("title").id} required hint={TITLE_HINT} error={error("title")} className="sm:max-w-md">
                    <Input {...control("title", { hint: TITLE_HINT, required: true })} autoComplete="off" placeholder={`e.g. ${TITLE_EXAMPLES[role]}`} />
                </Field>

                <FormMessage {...form.message} />
            </div>
            <CardFooter className="justify-end bg-surface-muted/50">
                <ButtonLink href={routes.admin.users} variant="secondary">
                    Cancel
                </ButtonLink>
                <SubmitButton pending={form.pending} pendingLabel="Sending invitation…">
                    Send invitation
                </SubmitButton>
            </CardFooter>
        </form>
    );
}
