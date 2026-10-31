"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createGoal } from "@/lib/actions/goals";
import { GoalForm, type FighterOption } from "./goal-form";

export interface NewGoalButtonProps {
    /** Server time (ISO) for date defaults. */
    now: string;
    /** Fixed fighter (fighter tab). */
    fighter?: FighterOption;
    /** Roster to choose from when no fighter is fixed. */
    fighters?: FighterOption[];
    variant?: ButtonVariant;
}

/** Opens the new-goal dialog; requires picking a fighter unless one is fixed. */
export function NewGoalButton({ now, fighter, fighters, variant = "primary" }: NewGoalButtonProps) {
    const t = useT();
    const [open, setOpen] = useState(false);
    const toast = useToast();

    return (
        <>
            <Button variant={variant} onClick={() => setOpen(true)}>
                <Plus aria-hidden />
                {t("screens.performance.newGoal.button")}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                size="lg"
                title={fighter ? t("screens.performance.newGoal.titleFor", { name: fighter.name }) : t("screens.performance.newGoal.button")}
                description={t("screens.performance.newGoal.desc")}
                action={createGoal}
                submitLabel={t("screens.performance.newGoal.create")}
                pendingLabel={t("screens.performance.newGoal.creating")}
                onSuccess={(state) => toast({ title: t("screens.performance.newGoal.created"), description: state.message })}
            >
                {(form) => <GoalForm form={form} mode="create" fighterId={fighter?.id} fighters={fighters} now={now} />}
            </ActionDialog>
        </>
    );
}
