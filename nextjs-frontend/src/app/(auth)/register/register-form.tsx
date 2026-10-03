"use client";

import Link from "next/link";

import { Field, FormMessage, Input } from "@/components/ui/form";
import { NewPasswordFields } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { registerAction } from "@/lib/actions/auth";
import { routes } from "@/lib/routes";

/** Creates the account an applicant applies with. */
export function RegisterForm() {
    const form = useActionForm(registerAction, { id: "register" });
    const email = form.control("email", { id: "email", required: true });

    return (
        <form {...form.formProps} className="mt-8 space-y-5">
            <FormMessage {...form.message} />
            <Field label="Email" htmlFor={email.id} required error={form.error("email")}>
                <Input {...email} type="email" autoComplete="email" placeholder="you@example.com" />
            </Field>
            <NewPasswordFields form={form} label="Password" />
            <SubmitButton size="lg" className="w-full" pending={form.pending} pendingLabel="Creating account…">
                Create account
            </SubmitButton>
            <p className="text-center text-sm text-fg-muted">
                Already have an account?{" "}
                <Link href={routes.login} className="font-medium text-primary-soft-fg hover:underline">
                    Sign in
                </Link>
            </p>
        </form>
    );
}
