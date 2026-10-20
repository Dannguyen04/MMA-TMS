"use client";

import { Swords } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { FormMessage } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { activateFighterAccountAction } from "@/lib/actions/admissions";

/** Turns the approved applicant into a fighter; on success the action opens the fighter dashboard. */
export function ActivateAccountForm() {
    const t = useT();
    const form = useActionForm(activateFighterAccountAction, { id: "activate" });
    return (
        <form {...form.formProps} className="flex flex-col gap-3">
            <FormMessage {...form.message} />
            <SubmitButton size="lg" pending={form.pending} pendingLabel={t("applicant.activate.submitting")}>
                <Swords aria-hidden />
                {t("applicant.activate.submit")}
            </SubmitButton>
        </form>
    );
}
