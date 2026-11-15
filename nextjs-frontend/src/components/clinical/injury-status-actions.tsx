"use client";

import { CalendarCheck, CircleCheck, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { toFormData } from "@/components/ui/use-action-form";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import { updateInjuryAction } from "@/lib/actions/clinical";
import { IDLE } from "@/lib/actions/state";
import type { InjuryStatus } from "@/lib/domain/types";

type Transition = "recovering" | "resolved" | "reopen";

export interface InjuryStatusActionsProps {
    injuryId: string;
    fighterId: string;
    status: InjuryStatus;
    fighterName: string;
    /** False where resolved is final (the medical service): a recurrence is recorded as a new injury instead. */
    canReopen: boolean;
    /** Title of a recovery plan still in progress for this injury, if any. */
    openPlanTitle: string | null;
    /** Today's date, already formatted for display. */
    todayLabel: string;
}

const TARGET_STATUS: Record<Transition, InjuryStatus> = { recovering: "recovering", resolved: "resolved", reopen: "recovering" };

/** Moves an injury through active → recovering → resolved (or reopens it), each behind a confirmation. */
export function InjuryStatusActions({ injuryId, fighterId, status, fighterName, canReopen, openPlanTitle, todayLabel }: InjuryStatusActionsProps) {
    const toast = useToast();
    const t = useT();
    const transition = useConfirmAction((next: Transition) => updateInjuryAction(IDLE, toFormData({ injuryId, fighterId, status: TARGET_STATUS[next] })), {
        onSuccess: (state) => toast({ title: t("doctorClinical.statusActions.updated"), description: state.message }),
    });

    const copy: Record<Transition, { title: string; description: string; confirmLabel: string }> = {
        recovering: {
            title: t("doctorClinical.statusActions.recoveringTitle"),
            description: t("doctorClinical.statusActions.recoveringDescription", { name: fighterName }),
            confirmLabel: t("doctorClinical.statusActions.toRecovering"),
        },
        resolved: {
            title: t("doctorClinical.statusActions.resolvedTitle"),
            description: canReopen
                ? t("doctorClinical.statusActions.resolvedDescription", { name: fighterName })
                : t("doctorClinical.statusActions.resolvedFinalDescription"),
            confirmLabel: t("doctorClinical.statusActions.markResolved"),
        },
        reopen: {
            title: t("doctorClinical.statusActions.reopenTitle"),
            description: t("doctorClinical.statusActions.reopenDescription", { name: fighterName }),
            confirmLabel: t("doctorClinical.statusActions.reopen"),
        },
    };

    const active = transition.payload ? copy[transition.payload] : null;

    return (
        <>
            {status === "active" && (
                <Button variant="secondary" onClick={() => transition.request("recovering")}>
                    <RefreshCw aria-hidden />
                    {t("doctorClinical.statusActions.toRecovering")}
                </Button>
            )}
            {status !== "resolved" && (
                <Button variant="secondary" onClick={() => transition.request("resolved")}>
                    <CircleCheck aria-hidden />
                    {t("doctorClinical.statusActions.markResolved")}
                </Button>
            )}
            {status === "resolved" && canReopen && (
                <Button variant="secondary" onClick={() => transition.request("reopen")}>
                    <RotateCcw aria-hidden />
                    {t("doctorClinical.statusActions.reopen")}
                </Button>
            )}

            <ConfirmDialog
                {...transition.dialogProps}
                title={active?.title ?? ""}
                description={active?.description ?? ""}
                confirmLabel={active?.confirmLabel ?? ""}
                tone="primary"
            >
                {transition.payload === "resolved" && (
                    <div className="flex flex-col gap-3">
                        <InlineNote icon={CalendarCheck}>
                            {t("doctorClinical.statusActions.resolvedOn")} <span className="font-medium text-fg">{todayLabel}</span>{" "}
                            {t("doctorClinical.statusActions.resolvedOnNote")}
                        </InlineNote>
                        {openPlanTitle && (
                            <InlineNote icon={TriangleAlert} tone="warning">
                                {t("doctorClinical.statusActions.openPlan", { title: openPlanTitle })}
                            </InlineNote>
                        )}
                    </div>
                )}
            </ConfirmDialog>
        </>
    );
}
