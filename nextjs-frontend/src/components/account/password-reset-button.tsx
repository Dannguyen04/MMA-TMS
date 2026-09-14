"use client";

import { MailCheck } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { requestPasswordResetEmail } from "@/lib/actions/account";

/** Asks the identity provider to email the signed-in user a password reset link. */
export function PasswordResetButton() {
    const toast = useToast();
    const [pending, startTransition] = useTransition();

    const onClick = () =>
        startTransition(async () => {
            const result = await requestPasswordResetEmail();
            if (result.status === "error") {
                toast({ title: "Couldn't send the reset email", description: result.message, tone: "error" });
            } else {
                toast({ title: "Reset email sent", description: result.message });
            }
        });

    return (
        <Button variant="secondary" size="sm" onClick={onClick} loading={pending}>
            {!pending && <MailCheck aria-hidden />}
            {pending ? "Sending…" : "Send password reset email"}
        </Button>
    );
}
