"use client";

import { useT } from "@/components/i18n/locale-provider";
import { Archive, CircleCheck, Play, RotateCcw, type LucideIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Button, type ButtonVariant } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { setPlanStatus } from "@/lib/actions/training";
import type { PlanStatus } from "@/lib/domain/types";
import type { Translator } from "@/lib/i18n/translate";

interface TransitionConfig {
    to: PlanStatus;
    labelKey: "training.planActions.activateLabel" | "training.planActions.completeLabel" | "training.planActions.archiveLabel" | "training.planActions.restoreLabel";
    icon: LucideIcon;
    variant: ButtonVariant;
    tone: "primary" | "danger";
    titleKey: "training.planActions.activateTitle" | "training.planActions.completeTitle" | "training.planActions.archiveTitle" | "training.planActions.restoreTitle";
    description: (t: Translator, planTitle: string, fighterName: string) => string;
    confirmLabelKey: "training.planActions.activateLabel" | "training.planActions.completeLabel" | "training.planActions.archiveLabel" | "training.planActions.restoreLabel";
}

const TRANSITIONS: Record<PlanStatus, TransitionConfig> = {
    active: {
        to: "active",
        labelKey: "training.planActions.activateLabel",
        icon: Play,
        variant: "primary",
        tone: "primary",
        titleKey: "training.planActions.activateTitle",
        description: (t, plan, fighter) => t("training.planActions.activateDesc", { plan, fighter }),
        confirmLabelKey: "training.planActions.activateLabel",
    },
    completed: {
        to: "completed",
        labelKey: "training.planActions.completeLabel",
        icon: CircleCheck,
        variant: "secondary",
        tone: "primary",
        titleKey: "training.planActions.completeTitle",
        description: (t, plan, fighter) => t("training.planActions.completeDesc", { plan, fighter }),
        confirmLabelKey: "training.planActions.completeLabel",
    },
    archived: {
        to: "archived",
        labelKey: "training.planActions.archiveLabel",
        icon: Archive,
        variant: "secondary",
        tone: "danger",
        titleKey: "training.planActions.archiveTitle",
        description: (t, plan, fighter) => t("training.planActions.archiveDesc", { plan, fighter }),
        confirmLabelKey: "training.planActions.archiveLabel",
    },
    draft: {
        to: "draft",
        labelKey: "training.planActions.restoreLabel",
        icon: RotateCcw,
        variant: "secondary",
        tone: "primary",
        titleKey: "training.planActions.restoreTitle",
        description: (t, plan, fighter) => t("training.planActions.restoreDesc", { plan, fighter }),
        confirmLabelKey: "training.planActions.restoreLabel",
    },
};

export interface PlanStatusActionsProps {
    planId: string;
    /** The statuses this plan can move to now (`planTransitions`). */
    transitions: PlanStatus[];
    planTitle: string;
    fighterName: string;
}

/** Status changes for a plan, each confirmed with its consequence spelled out. */
export function PlanStatusActions({ planId, transitions, planTitle, fighterName }: PlanStatusActionsProps) {
    const t = useT();
    const toast = useToast();
    const [active, setActive] = useState<TransitionConfig | null>(null);
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
                toast({ title: result.message ?? t("training.planActions.updated") });
                setActive(null);
                setError(undefined);
            } else {
                setError(result.message);
            }
        });
    };

    return (
        <>
            {transitions.map((next) => {
                const transition = TRANSITIONS[next];
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
                        {t(transition.labelKey)}
                    </Button>
                );
            })}
            <ConfirmDialog
                open={active !== null}
                onClose={close}
                onConfirm={confirm}
                pending={pending}
                tone={active?.tone ?? "primary"}
                title={active ? t(active.titleKey) : ""}
                description={active?.description(t, planTitle, fighterName) ?? ""}
                confirmLabel={active ? t(active.confirmLabelKey) : "Confirm"}
            >
                {error && <FormMessage status="error" message={error} />}
            </ConfirmDialog>
        </>
    );
}
