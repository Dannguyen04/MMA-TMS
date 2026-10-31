"use client";

import { useDemoCopy } from "@/components/i18n/locale-provider";
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

export interface PlanStatusActionsProps {
    planId: string;
    /** The statuses this plan can move to now (`planTransitions`). */
    transitions: PlanStatus[];
    planTitle: string;
    fighterName: string;
}

/** Status changes for a plan, each confirmed with its consequence spelled out. */
export function PlanStatusActions({ planId, transitions, planTitle, fighterName }: PlanStatusActionsProps) {
    const copy = useDemoCopy();
const ACTIVATE: Transition = {
    to: "active",
    label: "Activate plan",
    icon: Play,
    variant: "primary",
    tone: "primary",
    title: "Activate this plan?",
    description: (plan, fighter) => copy("{fighter} will see “{plan}” and receive a notification.", { fighter, plan }),
    confirmLabel: "Activate plan",
};

const COMPLETE: Transition = {
    to: "completed",
    label: "Mark completed",
    icon: CircleCheck,
    variant: "secondary",
    tone: "primary",
    title: "Mark this plan as completed?",
    description: (plan, fighter) => copy("“{plan}” moves to {fighter}’s history. Scheduled sessions stay on the calendar.", { plan, fighter }),
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
        copy("“{plan}” is archived. Scheduled sessions stay on the calendar; cancel any you no longer need.", { plan }),
    confirmLabel: "Archive plan",
};

const RESTORE: Transition = {
    to: "draft",
    label: "Restore as draft",
    icon: RotateCcw,
    variant: "secondary",
    tone: "primary",
    title: "Restore this plan as a draft?",
    description: (plan) => copy("“{plan}” returns as a draft visible only to coaches.", { plan }),
    confirmLabel: "Restore as draft",
};

/** How each status change reads, by the status it moves to. */
const TRANSITION_TO: Record<PlanStatus, Transition> = {
    draft: RESTORE,
    active: ACTIVATE,
    completed: COMPLETE,
    archived: ARCHIVE,
};


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
                toast({ title: copy(result.message ?? "Plan updated.") });
                setActive(null);
                setError(undefined);
            } else {
                setError(result.message ? copy(result.message) : undefined);
            }
        });
    };

    return (
        <>
            {transitions.map((next) => {
                const transition = TRANSITION_TO[next];
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
                        {copy(transition.label)}
                    </Button>
                );
            })}
            <ConfirmDialog
                open={active !== null}
                onClose={close}
                onConfirm={confirm}
                pending={pending}
                tone={active?.tone ?? "primary"}
                title={copy(active?.title ?? "")}
                description={active?.description(planTitle, fighterName) ?? ""}
                confirmLabel={copy(active?.confirmLabel ?? "Confirm")}
            >
                {error && <FormMessage status="error" message={error} />}
            </ConfirmDialog>
        </>
    );
}
