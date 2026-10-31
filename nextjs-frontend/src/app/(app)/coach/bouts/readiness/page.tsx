import { AlertCircle, Ban, CheckCircle2, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { IntensityLadder } from "@/components/domain/intensity-ladder";
import { WeightWarningBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import type { SessionIntensityTier } from "@/lib/domain/intensity-tiers";
import { isGradedReturnOnly, readinessMaxTier } from "@/lib/domain/suspension-rules";
import type { ReadinessRow } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { listRulesets } from "@/lib/services/bouts";
import { getReadiness, type ReadinessFilter } from "@/lib/services/suspensions";
import { param } from "@/lib/utils";
import { ReadinessFilterBar } from "./readiness-filter-bar";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: `${t("readiness.title")} · ${t("nav.Bouts")}` };
}

interface CoachReadinessPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CoachReadinessPage({ searchParams }: CoachReadinessPageProps) {
    const user = await requireRole("coach");
    const params = await searchParams;

    const rawRulesetId = param(params.rulesetId);
    const rawWeightLimit = param(params.weightLimitKg);
    const rawBoutOn = param(params.boutOn);

    const rulesetId = rawRulesetId?.trim() || undefined;
    const parsedWeight = rawWeightLimit ? Number(rawWeightLimit) : undefined;
    const weightLimitKg = parsedWeight !== undefined && Number.isFinite(parsedWeight) ? parsedWeight : undefined;
    const boutOn = rawBoutOn?.trim() || undefined;

    // B6-4: If weightLimitKg or boutOn is provided without rulesetId, do not call API with them
    const hasMissingRuleset = Boolean((weightLimitKg !== undefined || boutOn !== undefined) && !rulesetId);

    const filter: ReadinessFilter = hasMissingRuleset
        ? {}
        : {
              rulesetId,
              weightLimitKg,
              boutOn,
          };

    const [rulesets, rows, { t, locale }] = await Promise.all([
        listRulesets(),
        getReadiness(filter, user),
        getTranslator(),
    ]);

    // Partition rows into 3 columns
    // 1. Ready: ready === true
    const readyRows: ReadinessRow[] = [];
    // 2. Graded Return: !ready && gradedReturn !== null
    const gradedReturnRows: ReadinessRow[] = [];
    // 3. Not Ready: remaining rows
    const notReadySuspended: ReadinessRow[] = [];
    const notReadyAwaiting: ReadinessRow[] = [];
    const notReadyOther: ReadinessRow[] = [];

    for (const row of rows) {
        if (row.ready) {
            readyRows.push(row);
        } else if (isGradedReturnOnly(row)) {
            gradedReturnRows.push(row);
        } else if (row.status === "SUSPENDED") {
            notReadySuspended.push(row);
        } else if (row.status === "AWAITING_CLEARANCE") {
            notReadyAwaiting.push(row);
        } else {
            notReadyOther.push(row);
        }
    }

    const notReadyRows: ReadinessRow[] = [
        ...notReadySuspended,
        ...notReadyAwaiting,
        ...notReadyOther,
    ];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={t("readiness.title")}
                description={t("readiness.description")}
            />

            {/* Filter Bar */}
            <ReadinessFilterBar
                rulesets={rulesets}
                initialRulesetId={rulesetId}
                initialWeightLimitKg={weightLimitKg}
                initialBoutOn={boutOn}
                labels={{
                    ruleset: t("readiness.filter.ruleset"),
                    selectRuleset: t("readiness.filter.selectRuleset"),
                    weightClass: t("readiness.filter.weightClass"),
                    allWeightClasses: t("readiness.filter.allWeightClasses"),
                    boutOn: t("readiness.filter.boutOn"),
                    apply: t("readiness.filter.apply"),
                    clear: t("readiness.filter.clear"),
                }}
            />

            {/* Warning banner when weight or bout date is filtered without ruleset */}
            {hasMissingRuleset && (
                <div
                    role="alert"
                    className="flex items-center gap-3 rounded-xl border border-warning-border bg-warning-surface/30 p-4 text-sm text-warning-fg"
                >
                    <AlertCircle aria-hidden className="size-5 shrink-0" />
                    <span>{t("readiness.filter.missingRulesetNotice")}</span>
                </div>
            )}

            {/* Three Columns Kanban Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {(
                    [
                        { type: "ready", icon: <CheckCircle2 className="size-4 text-success-fg" aria-hidden />, labelKey: "readiness.columns.ready", emptyKey: "readiness.empty.ready", rows: readyRows },
                        { type: "graded-return", icon: <Clock className="size-4 text-info-fg" aria-hidden />, labelKey: "readiness.columns.gradedReturn", emptyKey: "readiness.empty.gradedReturn", rows: gradedReturnRows },
                        { type: "not-ready", icon: <Ban className="size-4 text-danger-fg" aria-hidden />, labelKey: "readiness.columns.notReady", emptyKey: "readiness.empty.notReady", rows: notReadyRows },
                    ] as const
                ).map((column) => (
                    <section key={column.type} data-column={column.type} className="flex flex-col gap-3">
                        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur py-2.5 px-3 rounded-lg border border-border flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
                                {column.icon}
                                <span>{t(column.labelKey)}</span>
                            </h2>
                            <span
                                data-count={column.type}
                                className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-fg-muted"
                            >
                                {column.rows.length}
                            </span>
                        </div>

                        {column.rows.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-fg-muted">
                                {t(column.emptyKey)}
                            </div>
                        ) : (
                            column.rows.map((row) => (
                                <FighterCard
                                    key={row.fighterId}
                                    row={row}
                                    columnType={column.type}
                                    locale={locale}
                                    t={t}
                                />
                            ))
                        )}
                    </section>
                ))}
            </div>
        </div>
    );
}

interface FighterCardProps {
    row: ReadinessRow;
    columnType: "ready" | "graded-return" | "not-ready";
    locale: "vi" | "en";
    t: Translator;
}

function FighterCard({ row, columnType, locale, t }: FighterCardProps) {
    const hasSuspension =
        row.suspension !== null ||
        row.status === "SUSPENDED" ||
        row.status === "AWAITING_CLEARANCE" ||
        row.gradedReturn !== null;

    // Intensity ladder props
    const { allowed: ladderMaxTier, effective: effectiveMaxTier } = readinessMaxTier(row);
    const ladderCeiling =
        (row.gradedReturn?.ceiling ?? row.suspension?.gradedReturn?.ceiling) as 3 | 4 | undefined;

    const maxIntensityText =
        effectiveMaxTier <= 0
            ? t("intensityLadder.summaryBlocked")
            : t("readiness.card.maxIntensity", {
                  tier: t(`intensityTier.${effectiveMaxTier as SessionIntensityTier}.label` as MessageKey),
              });

    return (
        <div data-fighter-card={row.fighterId} className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3 shadow-card hover:border-fg-subtle/50 transition-colors">
            {/* Top row: Avatar + Fighter Name + Weight */}
            <div className="flex items-center gap-3 min-w-0">
                <Avatar name={row.fighterName} shape="octagon" size="md" />
                <div className="flex flex-col min-w-0">
                    <Link
                        href={routes.coach.fighter(row.fighterId)}
                        className="font-semibold text-fg text-sm hover:text-primary hover:underline truncate"
                    >
                        {row.fighterName}
                    </Link>
                    <span className="text-xs text-fg-muted truncate">
                        {row.latestWeightKg !== null
                            ? t("readiness.card.latestWeight", {
                                  kg: row.latestWeightKg,
                                  date: formatShortDate(row.latestWeightOn!, locale),
                              })
                            : t("readiness.card.notWeighed")}
                    </span>
                </div>
            </div>

            {/* Feasibility warning badge + remaining % */}
            {row.feasibility && (
                <div
                    className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40"
                    data-badge="weight-warning"
                >
                    <WeightWarningBadge
                        status={row.feasibility.status}
                        size="sm"
                        locale={locale}
                    />
                    {row.feasibility.remainingPct !== null &&
                        row.feasibility.remainingPct !== undefined && (
                            <span className="text-xs text-fg-muted font-medium">
                                {t("readiness.card.remainingPct", {
                                    pct: Math.abs(row.feasibility.remainingPct),
                                })}
                            </span>
                        )}
                </div>
            )}

            {/* Intensity Ladder size="sm" */}
            <div className="w-full flex flex-col gap-1.5">
                <span data-testid="max-intensity-text" className="text-xs text-fg-muted font-medium">
                    {maxIntensityText}
                </span>
                <IntensityLadder
                    maxAllowedTier={ladderMaxTier}
                    ceiling={ladderCeiling}
                    size="sm"
                    locale={locale}
                />
            </div>

            {/* Text description / reasons */}
            {columnType === "graded-return" && row.fullReturnOn && (
                <p className="text-xs font-medium text-info-fg">
                    {t("readiness.card.fullReturnFrom", {
                        date: formatShortDate(row.fullReturnOn, locale),
                    })}
                </p>
            )}

            {columnType === "not-ready" && (
                <div className="flex flex-col gap-1 text-xs">
                    {row.status === "SUSPENDED" && row.suspension?.endsOn && (
                        <p className="text-danger-fg">
                            {t("readiness.card.suspendedUntil", {
                                date: formatShortDate(row.suspension.endsOn, locale),
                            })}
                        </p>
                    )}
                    {row.status === "AWAITING_CLEARANCE" && (
                        <p className="text-warning-fg font-medium">
                            {t("readiness.card.awaitingClearance")}
                        </p>
                    )}
                    {row.activeBout && (
                        <p className="text-fg-muted">
                            {t("readiness.card.activeBout", { event: row.activeBout.eventName })}
                        </p>
                    )}
                    {row.notReadyReasons?.includes("SUSPENDED_PAST_BOUT_DATE") && (
                        <p className="text-danger-fg font-medium">
                            {t("readiness.card.suspendedPastBoutDate")}
                        </p>
                    )}
                    {row.fullReturnOn && (
                        <p className="text-fg-muted">
                            {t("readiness.card.fullReturnFrom", {
                                date: formatShortDate(row.fullReturnOn, locale),
                            })}
                        </p>
                    )}
                </div>
            )}

            {/* Link to Suspensions page when fighter has a suspension */}
            {hasSuspension && (
                <div className="pt-2 border-t border-border/40">
                    <Link
                        href={routes.coach.suspensions}
                        className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                    >
                        {t("readiness.card.viewSuspension")} →
                    </Link>
                </div>
            )}
        </div>
    );
}
