"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { requestAdmissionCodeAction, verifyAdmissionCodeAction } from "@/lib/actions/auth";
import { routes } from "@/lib/routes";

/**
 * Applicants sign up, and come back to their application, with a code sent to their email: there is no password until
 * the academy approves them. The email stays in the form, never in the URL.
 */
export function EmailCodeForm() {
    const t = useT();
    const [email, setEmail] = useState<string | null>(null);
    const request = useActionForm(requestAdmissionCodeAction, { id: "admission-email", onSuccess: (state) => setEmail(state.data?.email ?? null) });
    const verify = useActionForm(verifyAdmissionCodeAction, { id: "admission-code" });

    if (!email) {
        const control = request.control("email", { id: "email", required: true });
        return (
            <form {...request.formProps} className="mt-8 space-y-5">
                <FormMessage {...request.message} />
                <Field label={t("auth.email")} htmlFor={control.id} required error={request.error("email")}>
                    <Input {...control} type="email" autoComplete="email" placeholder="you@example.com" />
                </Field>
                <SubmitButton size="lg" className="w-full" pending={request.pending} pendingLabel={t("auth.sendCodePending")}>
                    {t("auth.sendCode")}
                </SubmitButton>
                <SignInHint />
            </form>
        );
    }

    const token = verify.control("token", { id: "token", required: true, hint: true });
    const sent = request.state.status === "success" ? request.state.message : null;
    return (
        <form {...verify.formProps} className="mt-8 space-y-5">
            <input type="hidden" name="email" value={email} />
            <p className="flex items-start gap-2.5 rounded-lg bg-surface-muted px-3.5 py-3 text-sm text-fg-muted" aria-live="polite">
                <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-soft-fg" />
                <span>
                    <span className="font-medium text-fg">{email}</span>
                    <span className="block">{sent}</span>
                </span>
            </p>
            {request.state.status === "error" && <FormMessage {...request.message} />}
            <FormMessage {...verify.message} />
            <Field label={t("auth.code")} htmlFor={token.id} required error={verify.error("token")} hint={t("auth.codeHint")}>
                <Input {...token} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={10} placeholder="123456" className="tracking-widest" />
            </Field>
            <SubmitButton size="lg" className="w-full" pending={verify.pending} pendingLabel={t("auth.checkingCodePending")}>
                {t("auth.continue")}
            </SubmitButton>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="ghost" size="sm" loading={request.pending} onClick={() => request.submit({ email })}>
                    {t("auth.sendNewCode")}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        request.reset();
                        verify.reset();
                        setEmail(null);
                    }}
                >
                    {t("auth.useDifferentEmail")}
                </Button>
            </div>
        </form>
    );
}

function SignInHint() {
    const t = useT();
    return (
        <p className="text-center text-sm text-fg-muted">
            {t("auth.staffOrFighter")}{" "}
            <Link href={routes.login} className="font-medium text-primary-soft-fg hover:underline">
                {t("auth.signInWithPassword")}
            </Link>
        </p>
    );
}
