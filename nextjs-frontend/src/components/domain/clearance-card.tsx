import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList, type DescriptionItem } from "@/components/ui/description-list";
import { EmptyState } from "@/components/ui/states";
import { CLEARANCE_LEVEL_LABELS, CLEARANCE_STATUS_LABELS } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import type { MedicalClearance } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { CLEARANCE_WARNING_DAYS, ClearanceValidity } from "./clearance-validity";
import { RestrictionList } from "./restriction-list";
import { CLEARANCE_STATE_META, ClearanceBadge } from "./status-badges";

const NoClearanceIcon = CLEARANCE_STATE_META.none.icon;

const HEADLINES: Record<ClearanceState, string> = {
    full: "Full training",
    restricted: "Training within restrictions",
    not_cleared: "No training permitted",
    expired: "Renewal required",
    none: "Awaiting clearance",
};

const EXPLANATIONS: Record<Exclude<ClearanceState, "none">, string> = {
    full: "Cleared for all training. No restrictions apply.",
    restricted: "Cleared to train, but only within the restrictions below. Plan sessions around them.",
    not_cleared: "Must not train. Only the sports doctor can change this clearance.",
    expired: "This clearance has lapsed. A sports doctor must renew it before training continues.",
};

export interface ClearanceCardProps {
    clearance: MedicalClearance | null;
    state: ClearanceState;
    doctorName?: string;
    /** Server time (ISO) used for days remaining. */
    now: string;
    /** "clinical" (doctors) shows the clinical reason; "summary" (coaches, fighters) never does. */
    variant: "clinical" | "summary";
    /** Header actions, e.g. "Renew" or "Revoke" for doctors. */
    actions?: ReactNode;
    /** Days before expiry at which the validity turns into a warning. */
    warningDays?: number;
    /**
     * Training is paused for a pending medical review. The clearance itself still stands, so the card says why
     * training stopped instead of calling the clearance "not cleared".
     */
    pausedForReview?: boolean;
    className?: string;
}

const PAUSED_HEADLINE = "Paused for a medical review";
const PAUSED_EXPLANATION = "The clearance below still stands, but training waits until the sports doctor examines the fighter.";

/** Medical Clearance at a glance: state, validity, issuing doctor and restrictions. */
export function ClearanceCard({
    clearance,
    state,
    doctorName,
    now,
    variant,
    actions,
    warningDays = CLEARANCE_WARNING_DAYS,
    pausedForReview = false,
    className,
}: ClearanceCardProps) {
    return (
        <Card className={className}>
            <CardHeader title="Medical Clearance" icon={<ShieldCheck />} action={actions} />
            <CardContent>
                {state === "none" || !clearance ? (
                    <EmptyState
                        compact
                        icon={<NoClearanceIcon />}
                        title="No Medical Clearance on file"
                        description={
                            variant === "clinical"
                                ? "Complete a baseline examination, then issue a clearance so coaches can plan training against it."
                                : "Training can't be checked against medical guidance yet. A sports doctor issues a clearance after a baseline examination."
                        }
                    />
                ) : (
                    <ClearanceDetails
                        clearance={clearance}
                        state={state}
                        doctorName={doctorName}
                        now={now}
                        variant={variant}
                        warningDays={warningDays}
                        paused={pausedForReview && state === "not_cleared" && clearance.status === "active" && clearance.level !== "not_cleared"}
                    />
                )}
            </CardContent>
        </Card>
    );
}

function ClearanceDetails({
    clearance,
    state,
    doctorName,
    now,
    variant,
    warningDays,
    paused,
}: {
    clearance: MedicalClearance;
    state: Exclude<ClearanceState, "none">;
    doctorName?: string;
    now: string;
    variant: "clinical" | "summary";
    warningDays: number;
    paused: boolean;
}) {
    const meta = CLEARANCE_STATE_META[state];
    const isExpired = state === "expired";
    // While paused, the clearance's own level describes its validity and restrictions.
    const recordState = paused ? clearance.level : state;

    const items: DescriptionItem[] = [
        {
            label: "Validity",
            value: <ClearanceValidity clearance={clearance} state={recordState} now={now} warningDays={warningDays} />,
        },
        {
            label: "Issued by",
            value: (
                <span className="flex flex-col gap-0.5">
                    {doctorName ?? "Sports doctor"}
                    <span className="text-[13px] font-normal text-fg-muted">
                        on <time dateTime={clearance.issuedAt}>{formatDate(clearance.issuedAt)}</time>
                    </span>
                </span>
            ),
        },
    ];

    if (isExpired) {
        items.push({ label: "Lapsed clearance level", value: CLEARANCE_LEVEL_LABELS[clearance.level] });
    }
    if (variant === "clinical" && clearance.status !== "active" && clearance.status !== "expired") {
        items.push({
            label: "Record status",
            value: clearance.revokedAt
                ? `${CLEARANCE_STATUS_LABELS[clearance.status]} on ${formatDate(clearance.revokedAt)}`
                : CLEARANCE_STATUS_LABELS[clearance.status],
        });
    }
    if (variant === "clinical" && clearance.revokedReason) {
        items.push({ label: "Revocation reason", value: clearance.revokedReason, wide: true });
    }
    if (variant === "clinical" && clearance.reason) {
        items.push({ label: "Clinical reason", value: <span className="font-normal">{clearance.reason}</span>, wide: true });
    }

    return (
        <div className="flex flex-col gap-5">
            <Callout
                tone={paused ? "warning" : meta.tone}
                icon={meta.icon}
                title={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {paused ? PAUSED_HEADLINE : HEADLINES[state]}
                        <ClearanceBadge state={state} size="sm" />
                    </span>
                }
            >
                {paused ? PAUSED_EXPLANATION : EXPLANATIONS[state]}
            </Callout>

            <DescriptionList items={items} />

            {clearance.restrictions.length > 0 && (
                <div>
                    <h3 className="mb-2 text-[13px] font-semibold text-fg">
                        {isExpired ? "Restrictions on the lapsed clearance" : "Restrictions"}
                        <span className="ml-1.5 font-normal text-fg-muted">({clearance.restrictions.length})</span>
                    </h3>
                    <RestrictionList restrictions={clearance.restrictions} />
                </div>
            )}
        </div>
    );
}
