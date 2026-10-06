"use client";

import { Swords } from "lucide-react";

import { FormMessage } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { activateFighterAccountAction } from "@/lib/actions/admissions";

/** Turns the approved applicant into a fighter; on success the action opens the fighter dashboard. */
export function ActivateAccountForm() {
    const form = useActionForm(activateFighterAccountAction, { id: "activate" });
    return (
        <form {...form.formProps} className="flex flex-col gap-3">
            <FormMessage {...form.message} />
            <SubmitButton size="lg" pending={form.pending} pendingLabel="Activating…">
                <Swords aria-hidden />
                Activate my fighter account
            </SubmitButton>
        </form>
    );
}
