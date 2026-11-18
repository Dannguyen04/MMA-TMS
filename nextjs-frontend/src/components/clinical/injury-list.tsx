import Link from "next/link";

import { describeDaysUntil } from "@/components/domain/domain-format";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { InjuryCard } from "@/components/domain/injury-card";
import { InjurySeverityBadge, InjuryStatusBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/ui/progress";
import { SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { Fighter, Injury } from "@/lib/domain/types";
import { daysBetween, formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type Translator } from "@/lib/i18n/translate";
import type { SearchParams, SortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";
import { injuryText, regionText } from "./clinical-copy";

export interface InjuryPlanSummary {
    id: string;
    progressPct: number;
    /** 1-based number of the current phase, or null when none is current. */
    currentPhase: number | null;
    phaseCount: number;
    completed: boolean;
}

export interface InjuryRow {
    injury: Injury;
    fighter: Fighter;
    plan: InjuryPlanSummary | null;
}

export interface InjuryListProps {
    rows: InjuryRow[];
    now: string;
    pathname: string;
    searchParams: SearchParams;
    sort: string;
    direction: SortDirection;
    locale?: Locale;
}

/** Sortable injury table on md+ and stacked injury cards on small screens. */
export function InjuryList({ rows, now, pathname, searchParams, sort, direction, locale = "vi" }: InjuryListProps) {
    const t = createTranslator(locale);
    const sortable = { pathname, searchParams, activeSort: sort, direction };
    return (
        <>
            <div className="hidden md:block">
                <Table caption={t("doctorClinical.injuryList.caption")}>
                    <THead>
                        <tr>
                            <SortableTH label={t("doctorClinical.common.fighter")} sortKey="fighter" {...sortable} />
                            <SortableTH label={t("doctorClinical.common.injury")} sortKey="injury" {...sortable} />
                            <SortableTH label={t("doctorClinical.common.severity")} sortKey="severity" {...sortable} />
                            <SortableTH label={t("doctorClinical.injuryList.status")} sortKey="status" {...sortable} />
                            <SortableTH label={t("doctorClinical.common.occurred")} sortKey="occurred" {...sortable} />
                            <SortableTH label={t("doctorClinical.injuryList.expectedReturn")} sortKey="return" {...sortable} />
                            <TH>{t("doctorClinical.injuryList.recoveryPlan")}</TH>
                        </tr>
                    </THead>
                    <TBody>
                        {rows.map(({ injury, fighter, plan }) => (
                            <TR key={injury.id}>
                                <TD>
                                    <FighterIdentity fighter={fighter} size="sm" showMeta={false} href={routes.doctor.fighter(fighter.id)} />
                                </TD>
                                <TD className="min-w-48">
                                    <Link href={routes.doctor.injury(injury.id)} className="font-medium text-fg hover:underline">
                                        {injuryText(t, injury)}
                                    </Link>
                                    <p className="text-[13px] text-fg-muted">{regionText(t, injury.bodyRegion)}</p>
                                </TD>
                                <TD>
                                    <InjurySeverityBadge severity={injury.severity} size="sm" locale={locale} />
                                </TD>
                                <TD>
                                    <InjuryStatusBadge status={injury.status} size="sm" locale={locale} />
                                </TD>
                                <TD className="whitespace-nowrap">
                                    <time dateTime={injury.occurredAt}>{formatDate(injury.occurredAt, locale)}</time>
                                    <p className="text-[13px] text-fg-muted">{describeDaysUntil(daysBetween(now, injury.occurredAt), locale)}</p>
                                </TD>
                                <TD className="whitespace-nowrap">
                                    <ReturnCell injury={injury} now={now} t={t} />
                                </TD>
                                <TD className="relative min-w-40">
                                    <PlanCell plan={plan} injury={injury} t={t} />
                                </TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            </div>

            <ul aria-label={t("doctorClinical.injuryList.mobileLabel")} className="flex flex-col gap-5 pb-4 md:hidden">
                {rows.map(({ injury, fighter, plan }) => (
                    <li key={injury.id} className="flex flex-col gap-2">
                        <p className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-fg-muted">
                            <Avatar name={fighter.name} shape="octagon" size="xs" />
                            <span className="truncate">{fighter.name}</span>
                        </p>
                        <InjuryCard injury={injury} now={now} href={routes.doctor.injury(injury.id)} locale={locale} />
                        {plan && <PlanProgress plan={plan} className="px-1" t={t} />}
                    </li>
                ))}
            </ul>
        </>
    );
}

function PlanProgress({ plan, className, t }: { plan: InjuryPlanSummary; className?: string; t: Translator }) {
    const phaseText = plan.completed
        ? t("doctorClinical.injuryList.planCompleted")
        : plan.currentPhase
          ? t("doctorClinical.injuryList.phaseOf", { n: plan.currentPhase, total: plan.phaseCount })
          : t("doctorClinical.injuryList.recoveryPlan");
    return (
        <div className={className}>
            <p className="mb-1 flex items-center justify-between gap-2 text-xs text-fg-muted">
                <span>{phaseText}</span>
                <span className="font-medium text-fg tabular-nums">{plan.progressPct}%</span>
            </p>
            <ProgressBar
                value={plan.progressPct}
                size="sm"
                hideValue
                tone={plan.completed ? "success" : "info"}
                label={t("doctorClinical.injuryList.progressLabel")}
                valueText={`${plan.progressPct}%, ${phaseText.toLowerCase()}`}
            />
        </div>
    );
}

function ReturnCell({ injury, now, t }: { injury: Injury; now: string; t: Translator }) {
    const locale = t.locale ?? "vi";
    if (injury.resolvedAt) {
        return (
            <>
                <span className="text-fg-muted">{t("doctorClinical.injuryList.resolved")}</span>
                <p className="text-[13px] text-fg-muted">
                    <time dateTime={injury.resolvedAt}>{formatDate(injury.resolvedAt, locale)}</time>
                </p>
            </>
        );
    }
    if (!injury.expectedReturnAt) return <span className="text-fg-muted">{t("doctorClinical.injuryList.toBeAssessed")}</span>;
    const days = daysBetween(now, injury.expectedReturnAt);
    return (
        <>
            <time dateTime={injury.expectedReturnAt}>{formatDate(injury.expectedReturnAt, locale)}</time>
            <p className={days < 0 ? "text-[13px] font-medium text-warning-fg" : "text-[13px] text-fg-muted"}>
                {days < 0 ? t("doctorClinical.injuryList.targetPassed", { when: describeDaysUntil(days, locale) }) : describeDaysUntil(days, locale)}
            </p>
        </>
    );
}

function PlanCell({ plan, injury, t }: { plan: InjuryPlanSummary | null; injury: Injury; t: Translator }) {
    if (!plan) {
        return <span className="text-[13px] text-fg-subtle">{injury.status === "resolved" ? t("doctorClinical.injuryList.noPlan") : t("doctorClinical.injuryList.noPlanYet")}</span>;
    }
    return (
        <Link href={routes.doctor.recoveryPlan(plan.id)} className="block rounded-md hover:[&_p]:text-fg">
            <span className="sr-only">{t("doctorClinical.injuryList.openPlan")} </span>
            <PlanProgress plan={plan} t={t} />
        </Link>
    );
}
