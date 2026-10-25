"use client";

import { MailCheck } from "lucide-react";
import { useTransition } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { requestPasswordResetEmail } from "@/lib/actions/account";

/** Asks the identity provider to email the signed-in user a password reset link. */
export function PasswordResetButton() {
    const toast = useToast();
    const t = useT();
    const [pending, startTransition] = useTransition();

    const onClick = () =>
        startTransition(async () => {
            const result = await requestPasswordResetEmail();
            if (result.status === "error") {
                toast({ title: t("account.security.resetEmailFailedTitle"), description: result.message, tone: "error" });
            } else {
                toast({ title: t("account.security.resetEmailSentTitle"), description: result.message });
            }
        });

    return (
        <Button variant="secondary" size="sm" onClick={onClick} loading={pending}>
            {!pending && <MailCheck aria-hidden />}
            {pending ? t("account.security.sending") : t("account.security.sendResetEmail")}
        </Button>
    );
}
