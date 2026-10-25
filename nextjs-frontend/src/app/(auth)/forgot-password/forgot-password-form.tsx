"use client";

import { ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";

import { useT } from "@/components/i18n/locale-provider";
import { Callout } from "@/components/training/callout";
import { buttonClasses } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { requestPasswordReset } from "@/lib/actions/auth";
import { routes } from "@/lib/routes";

export function ForgotPasswordForm() {
    const t = useT();
    const form = useActionForm(requestPasswordReset, { id: "forgot-password" });
    const email = form.control("email", { id: "email", required: true });

    if (form.state.status === "success") {
        return (
            <Callout
                tone="success"
                icon={MailCheck}
                role="status"
                title={t("auth.checkInboxTitle")}
                className="mt-8"
                action={
                    <Link href={routes.login} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                        <ArrowLeft aria-hidden />
                        {t("auth.backToSignIn")}
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
            <Field label={t("auth.email")} htmlFor={email.id} error={form.error("email")}>
                <Input {...email} type="email" autoComplete="email" />
            </Field>
            <SubmitButton size="lg" className="w-full" pending={form.pending} pendingLabel={t("auth.sendResetLinkPending")}>
                {t("auth.sendResetLink")}
            </SubmitButton>
            <Link href={routes.login} className="flex items-center justify-center gap-1.5 text-sm font-medium text-fg-muted hover:text-fg">
                <ArrowLeft aria-hidden className="size-4" />
                {t("auth.backToSignIn")}
            </Link>
        </form>
    );
}
