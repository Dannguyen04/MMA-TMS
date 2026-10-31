import { ChevronRight, Flag, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { techniqueLabel, TECHNIQUES } from "@/lib/domain/labels";
import { formatDelta } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type Translator } from "@/lib/i18n/translate";
import type { PerformanceSummary } from "@/lib/services/performance";
import { routes } from "@/lib/routes";
import { sum } from "@/lib/utils";
import { comparisonLabel, percentChange } from "./performance-format";

export interface TeamMember {
    fighter: FighterIdentityData & { id: string };
    summary: PerformanceSummary;
}

const HIGHLIGHT_LIMIT = 3;
/** A technique score this far below its comparison average is worth a look. */
const TECHNIQUE_DROP = -2;
/** A week-over-week fall in training minutes of this share (%) is worth a look. */
const VOLUME_DROP_PCT = -30;

interface Highlight {
    member: TeamMember;
    reasons: string[];
    weight: number;
}

function overallChange(summary: PerformanceSummary, t: Translator, locale: Locale): string {
    return t("screens.performance.kpi.overallChange", {
        delta: formatDelta(summary.overallDelta, 1),
        comparison: comparisonLabel(summary.comparisonWeeks, locale),
    });
}

function mostImproved(members: TeamMember[], t: Translator, locale: Locale): Highlight[] {
    return members
        .filter(({ summary }) => summary.comparisonWeeks > 0 && summary.overallDelta > 0)
        .sort((a, b) => b.summary.overallDelta - a.summary.overallDelta)
        .slice(0, HIGHLIGHT_LIMIT)
        .map((member) => {
            const { summary } = member;
            const best = [...TECHNIQUES].sort((a, b) => summary.deltas[b] - summary.deltas[a])[0];
            const reasons = [overallChange(summary, t, locale)];
            if (summary.deltas[best] > 0) {
                reasons.push(t("screens.performance.highlights.biggestGain", { technique: techniqueLabel(t, best), delta: formatDelta(summary.deltas[best], 1) }));
            }
            return { member, reasons, weight: summary.overallDelta };
        });
}

function needsAttention(members: TeamMember[], t: Translator, locale: Locale): Highlight[] {
    return members
        .flatMap((member) => {
            const { summary } = member;
            if (summary.comparisonWeeks === 0) return [];
            const issues: { text: string; weight: number }[] = [];
            if (summary.trend === "declining") {
                issues.push({ text: overallChange(summary, t, locale), weight: -summary.overallDelta * 2 });
            }
            const worst = [...TECHNIQUES].sort((a, b) => summary.deltas[a] - summary.deltas[b])[0];
            if (summary.deltas[worst] <= TECHNIQUE_DROP) {
                issues.push({
                    text: t("screens.performance.highlights.techniqueScore", { technique: techniqueLabel(t, worst), delta: formatDelta(summary.deltas[worst], 1) }),
                    weight: -summary.deltas[worst],
                });
            }
            const minutesChange = summary.previous ? percentChange(summary.latest.trainingMinutes, summary.previous.trainingMinutes) : null;
            if (minutesChange !== null && minutesChange <= VOLUME_DROP_PCT) {
                issues.push({ text: t("screens.performance.highlights.minutesDrop", { delta: formatDelta(minutesChange) }), weight: -minutesChange / 10 });
            }
            return issues.length === 0 ? [] : [{ member, reasons: issues.map((issue) => issue.text), weight: sum(issues.map((issue) => issue.weight)) }];
        })
        .sort((a, b) => b.weight - a.weight)
        .slice(0, HIGHLIGHT_LIMIT);
}

/** "Most improved" and "Needs attention" cards computed from each fighter's latest week. */
export function TeamHighlights({ members, locale }: { members: TeamMember[]; locale: Locale }) {
    const t = createTranslator(locale);
    return (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <HighlightCard
                title={t("screens.performance.highlights.mostImproved")}
                description={t("screens.performance.highlights.mostImprovedDesc")}
                icon={<TrendingUp aria-hidden />}
                items={mostImproved(members, t, locale)}
                empty={t("screens.performance.highlights.mostImprovedEmpty")}
                t={t}
            />
            <HighlightCard
                title={t("screens.performance.highlights.attention")}
                description={t("screens.performance.highlights.attentionDesc")}
                icon={<Flag aria-hidden />}
                items={needsAttention(members, t, locale)}
                empty={t("screens.performance.highlights.attentionEmpty")}
                showHealth
                t={t}
            />
        </div>
    );
}

interface HighlightCardProps {
    title: string;
    description: string;
    icon: ReactNode;
    items: Highlight[];
    empty: string;
    showHealth?: boolean;
    t: Translator;
}

function HighlightCard({ title, description, icon, items, empty, showHealth = false, t }: HighlightCardProps) {
    return (
        <Card className="min-w-0">
            <CardHeader title={title} description={description} icon={icon} />
            <CardContent>
                {items.length === 0 ? (
                    <EmptyState compact title={t("screens.performance.highlights.nothing")} description={empty} />
                ) : (
                    <ul className="flex flex-col divide-y divide-border">
                        {items.map(({ member, reasons }) => (
                            <li key={member.fighter.id} className="relative flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                                <FighterIdentity
                                    fighter={member.fighter}
                                    size="sm"
                                    showMeta={false}
                                    showHealth={showHealth && member.fighter.healthStatus !== "healthy"}
                                    className="w-44 shrink-0 max-sm:w-36"
                                />
                                <ul className="min-w-0 flex-1 text-[13px] text-fg-muted">
                                    {reasons.map((reason) => (
                                        <li key={reason}>{reason}</li>
                                    ))}
                                </ul>
                                <Link
                                    href={routes.coach.fighterPerformance(member.fighter.id)}
                                    aria-label={t("screens.performance.highlights.view", { name: member.fighter.name })}
                                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-hover hover:text-fg"
                                >
                                    <ChevronRight aria-hidden className="size-4" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
