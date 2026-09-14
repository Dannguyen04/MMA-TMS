"use client";

import { CalendarCheck, CircleCheck, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";

import { InlineNote } from "@/components/dashboard/inline-note";
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
    status: InjuryStatus;
    fighterName: string;
    /** Title of a recovery plan still in progress for this injury, if any. */
    openPlanTitle: string | null;
    /** Today's date, already formatted for display. */
    todayLabel: string;
}

const TARGET_STATUS: Record<Transition, InjuryStatus> = { recovering: "recovering", resolved: "resolved", reopen: "recovering" };

/** Moves an injury through active → recovering → resolved (or reopens it), each behind a confirmation. */
export function InjuryStatusActions({ injuryId, status, fighterName, openPlanTitle, todayLabel }: InjuryStatusActionsProps) {
    const toast = useToast();
    const transition = useConfirmAction((next: Transition) => updateInjuryAction(IDLE, toFormData({ injuryId, status: TARGET_STATUS[next] })), {
        onSuccess: (state) => toast({ title: "Injury updated", description: state.message }),
    });

    const copy: Record<Transition, { title: string; description: string; confirmLabel: string }> = {
        recovering: {
            title: "Mark this injury as recovering?",
            description: `${fighterName} moves out of the acute phase. Their health status is recalculated — usually to Recovery — and coaches continue to see only Medical Clearance.`,
            confirmLabel: "Mark recovering",
        },
        resolved: {
            title: "Resolve this injury?",
            description: `This closes the injury record. ${fighterName}'s health status is recalculated from their clearance and any other open injuries, and the fighter and their coaches are notified. Medical Clearance does not change — review it separately.`,
            confirmLabel: "Resolve injury",
        },
        reopen: {
            title: "Reopen this injury?",
            description: `The injury returns to Recovering and its resolved date is cleared. ${fighterName}'s health status is recalculated.`,
            confirmLabel: "Reopen injury",
        },
    };

    const active = transition.payload ? copy[transition.payload] : null;

    return (
        <>
            {status === "active" && (
                <Button variant="secondary" onClick={() => transition.request("recovering")}>
                    <RefreshCw aria-hidden />
                    Mark recovering
                </Button>
            )}
            {status !== "resolved" && (
                <Button variant="secondary" onClick={() => transition.request("resolved")}>
                    <CircleCheck aria-hidden />
                    Mark resolved
                </Button>
            )}
            {status === "resolved" && (
                <Button variant="secondary" onClick={() => transition.request("reopen")}>
                    <RotateCcw aria-hidden />
                    Reopen injury
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
                            Resolved date: <span className="font-medium text-fg">{todayLabel}</span> (today — recorded when you confirm)
                        </InlineNote>
                        {openPlanTitle && (
                            <InlineNote icon={TriangleAlert} tone="warning">
                                The recovery plan “{openPlanTitle}” is still in progress. It stays open until you complete its final phase.
                            </InlineNote>
                        )}
                    </div>
                )}
            </ConfirmDialog>
        </>
    );
}
