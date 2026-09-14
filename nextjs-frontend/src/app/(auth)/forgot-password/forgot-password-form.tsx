"use client";

import { ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";

import { Callout } from "@/components/training/callout";
import { buttonClasses } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { requestPasswordReset } from "@/lib/actions/auth";
import { routes } from "@/lib/routes";

export function ForgotPasswordForm() {
    const form = useActionForm(requestPasswordReset, { id: "forgot-password" });
    const email = form.control("email", { id: "email", required: true });

    if (form.state.status === "success") {
        return (
            <Callout
                tone="success"
                icon={MailCheck}
                role="status"
                title="Check your inbox"
                className="mt-8"
                action={
                    <Link href={routes.login} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                        <ArrowLeft aria-hidden />
                        Back to sign in
                    </Link>
                }
            >
                {form.state.message}
            </Callout>
        );
    }

    return (
        <form {...form.formProps} className="mt-8 space-y-5">
            <FormMessage {...form.message} />
            <Field label="Email" htmlFor={email.id} error={form.error("email")}>
                <Input {...email} type="email" autoComplete="email" />
            </Field>
            <SubmitButton size="lg" className="w-full" pending={form.pending} pendingLabel="Sending link…">
                Send reset link
            </SubmitButton>
            <Link href={routes.login} className="flex items-center justify-center gap-1.5 text-sm font-medium text-fg-muted hover:text-fg">
                <ArrowLeft aria-hidden className="size-4" />
                Back to sign in
            </Link>
        </form>
    );
}
