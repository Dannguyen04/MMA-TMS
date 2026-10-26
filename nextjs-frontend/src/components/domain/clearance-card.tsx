"use client";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList, type DescriptionItem } from "@/components/ui/description-list";
import { EmptyState } from "@/components/ui/states";
import { clearanceLevelLabel, clearanceStatusLabel } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import type { MedicalClearance } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { CLEARANCE_WARNING_DAYS, ClearanceValidity } from "./clearance-validity";
import { RestrictionList } from "./restriction-list";
import { CLEARANCE_STATE_META, ClearanceBadge } from "./status-badges";

const NoClearanceIcon = CLEARANCE_STATE_META.none.icon;

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
    const t = useT();

    return (
        <Card className={className}>
            <CardHeader title={t("coachClearance.pageTitle")} icon={<ShieldCheck />} action={actions} />
            <CardContent>
                {state === "none" || !clearance ? (
                    <EmptyState
                        compact
                        icon={<NoClearanceIcon />}
                        title={t("clearanceCard.emptyTitle")}
                        description={
                            variant === "clinical"
                                ? t("clearanceCard.emptyClinicalDesc")
                                : t("clearanceCard.emptySummaryDesc")
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
    const t = useT();
    const locale = useLocale();
    const meta = CLEARANCE_STATE_META[state];
    const isExpired = state === "expired";
    // While paused, the clearance's own level describes its validity and restrictions.
    const recordState = paused ? clearance.level : state;

    const items: DescriptionItem[] = [
        {
            label: t("clearanceCard.validity"),
            value: <ClearanceValidity locale={locale} clearance={clearance} state={recordState} now={now} warningDays={warningDays} />,
        },
        {
            label: t("clearanceCard.issuedBy"),
            value: (
                <span className="flex flex-col gap-0.5">
                    {doctorName ?? t("role.doctor")}
                    <span className="text-[13px] font-normal text-fg-muted">
                        {t("clearanceCard.issuedOn", { date: formatDate(clearance.issuedAt, locale) })}
                    </span>
                </span>
            ),
        },
    ];

    if (isExpired) {
        items.push({ label: t("clearanceCard.lapsedLevel"), value: clearanceLevelLabel(clearance.level, locale) });
    }
    if (variant === "clinical" && clearance.status !== "active" && clearance.status !== "expired") {
        items.push({
            label: t("clearanceCard.recordStatus"),
            value: clearance.revokedAt
                ? t("clearanceCard.recordStatusOn", { status: clearanceStatusLabel(clearance.status, locale), date: formatDate(clearance.revokedAt, locale) })
                : clearanceStatusLabel(clearance.status, locale),
        });
    }
    if (variant === "clinical" && clearance.revokedReason) {
        items.push({ label: t("clearanceCard.revocationReason"), value: clearance.revokedReason, wide: true });
    }
    if (variant === "clinical" && clearance.reason) {
        items.push({ label: t("clearanceCard.clinicalReason"), value: <span className="font-normal">{clearance.reason}</span>, wide: true });
    }

    return (
        <div className="flex flex-col gap-5">
            <Callout
                tone={paused ? "warning" : meta.tone}
                icon={meta.icon}
                title={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {paused ? t("clearanceCard.headline.paused") : t(`clearanceCard.headline.${state}`)}
                        <ClearanceBadge locale={locale} state={state} size="sm" />
                    </span>
                }
            >
                {paused ? t("clearanceCard.explanation.paused") : t(`clearanceCard.explanation.${state}`)}
            </Callout>

            <DescriptionList items={items} />

            {clearance.restrictions.length > 0 && (
                <div>
                    <h3 className="mb-2 text-[13px] font-semibold text-fg">
                        {isExpired ? t("clearanceCard.restrictionsLapsed") : t("clearanceCard.restrictions")}
                        <span className="ml-1.5 font-normal text-fg-muted">({clearance.restrictions.length})</span>
                    </h3>
                    <RestrictionList restrictions={clearance.restrictions} />
                </div>
            )}
        </div>
    );
}
