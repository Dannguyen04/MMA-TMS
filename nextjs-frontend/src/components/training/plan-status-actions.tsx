"use client";

import { Archive, CircleCheck, Play, RotateCcw, type LucideIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Button, type ButtonVariant } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { setPlanStatus } from "@/lib/actions/training";
import type { PlanStatus } from "@/lib/domain/types";

interface Transition {
    to: PlanStatus;
    label: string;
    icon: LucideIcon;
    variant: ButtonVariant;
    tone: "primary" | "danger";
    title: string;
    description: (planTitle: string, fighterName: string) => string;
    confirmLabel: string;
}

const ACTIVATE: Transition = {
    to: "active",
    label: "Activate plan",
    icon: Play,
    variant: "primary",
    tone: "primary",
    title: "Activate this plan?",
    description: (plan, fighter) => `${fighter} will see “${plan}” in their training plans and get a notification.`,
    confirmLabel: "Activate plan",
};

const COMPLETE: Transition = {
    to: "completed",
    label: "Mark completed",
    icon: CircleCheck,
    variant: "secondary",
    tone: "primary",
    title: "Mark this plan as completed?",
    description: (plan, fighter) => `“${plan}” moves to ${fighter}'s plan history. Sessions already on the calendar stay scheduled.`,
    confirmLabel: "Mark completed",
};

const ARCHIVE: Transition = {
    to: "archived",
    label: "Archive",
    icon: Archive,
    variant: "secondary",
    tone: "danger",
    title: "Archive this plan?",
    description: (plan) =>
        `“${plan}” is removed from active planning and hidden from the fighter's current plans. Scheduled sessions stay on the calendar — cancel any you no longer need.`,
    confirmLabel: "Archive plan",
};

const RESTORE: Transition = {
    to: "draft",
    label: "Restore as draft",
    icon: RotateCcw,
    variant: "secondary",
    tone: "primary",
    title: "Restore this plan as a draft?",
    description: (plan) => `“${plan}” returns as a draft that only coaches can see. Activate it again when it's ready.`,
    confirmLabel: "Restore as draft",
};

const TRANSITIONS: Record<PlanStatus, Transition[]> = {
    draft: [ACTIVATE, ARCHIVE],
    active: [COMPLETE, ARCHIVE],
    completed: [ARCHIVE],
    archived: [RESTORE],
};

export interface PlanStatusActionsProps {
    planId: string;
    status: PlanStatus;
    planTitle: string;
    fighterName: string;
}

/** Status changes for a plan, each confirmed with its consequence spelled out. */
export function PlanStatusActions({ planId, status, planTitle, fighterName }: PlanStatusActionsProps) {
    const toast = useToast();
    const [active, setActive] = useState<Transition | null>(null);
    const [error, setError] = useState<string | undefined>();
    const [pending, startTransition] = useTransition();

    const close = () => {
        setActive(null);
        setError(undefined);
    };

    const confirm = () => {
        if (!active) return;
        startTransition(async () => {
            const result = await setPlanStatus(planId, active.to);
            if (result.status === "success") {
                toast({ title: result.message ?? "Plan updated." });
                setActive(null);
                setError(undefined);
            } else {
                setError(result.message);
            }
        });
    };

    return (
        <>
            {TRANSITIONS[status].map((transition) => {
                const Icon = transition.icon;
                return (
                    <Button
                        key={transition.to}
                        variant={transition.variant}
                        onClick={() => {
                            setError(undefined);
                            setActive(transition);
                        }}
                    >
                        <Icon aria-hidden />
                        {transition.label}
                    </Button>
                );
            })}
            <ConfirmDialog
                open={active !== null}
                onClose={close}
                onConfirm={confirm}
                pending={pending}
                tone={active?.tone ?? "primary"}
                title={active?.title ?? ""}
                description={active?.description(planTitle, fighterName) ?? ""}
                confirmLabel={active?.confirmLabel ?? "Confirm"}
            >
                {error && <FormMessage status="error" message={error} />}
            </ConfirmDialog>
        </>
    );
}
