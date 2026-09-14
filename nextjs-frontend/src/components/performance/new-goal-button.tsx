"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

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
    const [open, setOpen] = useState(false);
    const toast = useToast();

    return (
        <>
            <Button variant={variant} onClick={() => setOpen(true)}>
                <Plus aria-hidden />
                New goal
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                size="lg"
                title={fighter ? `New goal for ${fighter.name}` : "New goal"}
                description="Set one measurable target with a due date. The fighter is notified and can follow progress on their Goals page."
                action={createGoal}
                submitLabel="Create goal"
                pendingLabel="Creating…"
                onSuccess={(state) => toast({ title: "Goal created", description: state.message })}
            >
                {(form) => <GoalForm form={form} mode="create" fighterId={fighter?.id} fighters={fighters} now={now} />}
            </ActionDialog>
        </>
    );
}
