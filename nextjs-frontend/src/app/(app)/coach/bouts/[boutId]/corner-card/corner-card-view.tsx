"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Printer, ShieldAlert, TriangleAlert } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    filterCornerCardTactics,
    type CornerCard,
} from "@/lib/domain/round-advice";
import { routes } from "@/lib/routes";

interface CornerCardViewProps {
    boutId: string;
    eventName: string;
    fighterName: string;
    opponentName: string;
    weightLimitKg: number;
    scheduledRounds: number | null;
    card: CornerCard;
}

export function CornerCardView({
    boutId,
    eventName,
    fighterName,
    opponentName,
    weightLimitKg,
    scheduledRounds,
    card,
}: CornerCardViewProps) {
    const t = useT();
    const [selectedRound, setSelectedRound] = useState<number | null>(null);

    const maxTacticRound = card.tactics.reduce(
        (max, item) => (item.round !== null && item.round > max ? item.round : max),
        0,
    );
    const totalRounds = scheduledRounds ?? (maxTacticRound > 0 ? maxTacticRound : 3);
    const roundNumbers = Array.from({ length: totalRounds }, (_, idx) => idx + 1);

    const filteredTactics = filterCornerCardTactics(card.tactics, selectedRound);

    return (
        <div className="corner-card-sheet flex min-w-0 flex-col gap-4 print:gap-2">
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .corner-card-sheet {
                        max-height: 275mm;
                        overflow: hidden;
                        page-break-after: avoid;
                        break-inside: avoid;
                    }
                }
            `}</style>

            {/* Compact summary header (visible on screen & print) */}
            <Card className="min-w-0 print:border-black print:shadow-none">
                <CardContent className="flex flex-col gap-3 p-4 print:p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                                {t("boutAnalysis.cornerCard.eyebrow")}
                            </p>
                            <h2 className="truncate text-base font-bold text-fg print:text-sm">
                                {eventName}
                            </h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 print:hidden">
                            <Link
                                href={`${routes.coach.bout(boutId)}/rounds`}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-fg transition hover:bg-surface-muted"
                            >
                                <ClipboardList aria-hidden className="size-3.5 shrink-0" />
                                <span>{t("boutAnalysis.nav.rounds")}</span>
                            </Link>
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-fg transition hover:opacity-90"
                            >
                                <Printer aria-hidden className="size-3.5 shrink-0" />
                                <span>{t("boutAnalysis.cornerCard.printButton")}</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 print:grid-cols-4 print:text-[11px]">
                        <div className="min-w-0">
                            <span className="block text-fg-muted">{t("boutAnalysis.cornerCard.fighterLabel")}</span>
                            <span className="block truncate font-semibold text-fg">{fighterName}</span>
                        </div>
                        <div className="min-w-0">
                            <span className="block text-fg-muted">{t("boutAnalysis.cornerCard.opponentLabel")}</span>
                            <span className="block truncate font-semibold text-fg">{opponentName}</span>
                        </div>
                        <div className="min-w-0">
                            <span className="block text-fg-muted">{t("boutAnalysis.cornerCard.weightClassLabel")}</span>
                            <span className="block font-semibold tabular-nums text-fg">{weightLimitKg} kg</span>
                        </div>
                        <div className="min-w-0">
                            <span className="block text-fg-muted">{t("boutAnalysis.cornerCard.scheduledRoundsLabel")}</span>
                            <span className="block font-semibold tabular-nums text-fg">{totalRounds}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Acute weight loss warning (R19 / R20) */}
            {card.acuteLossFlag && (
                <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-xs text-danger-fg print:py-2"
                >
                    <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0">
                        <p className="font-bold">{t("boutAnalysis.cornerCard.acuteLossTitle")}</p>
                        <p className="mt-0.5 break-words">{t("boutAnalysis.cornerCard.acuteLossText")}</p>
                    </div>
                </div>
            )}

            {/* Round filter bar (hidden when printing A4) */}
            <div className="flex flex-col gap-1.5 print:hidden">
                <span className="text-xs font-medium text-fg-muted">
                    {t("boutAnalysis.cornerCard.filterLabel")}
                </span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("boutAnalysis.cornerCard.filterLabel")}>
                    <button
                        type="button"
                        onClick={() => setSelectedRound(null)}
                        aria-pressed={selectedRound === null}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                            selectedRound === null
                                ? "border-primary bg-primary text-primary-fg"
                                : "border-border bg-surface text-fg hover:bg-surface-muted"
                        }`}
                    >
                        {t("boutAnalysis.cornerCard.allRounds")}
                    </button>
                    {roundNumbers.map((round) => (
                        <button
                            key={round}
                            type="button"
                            onClick={() => setSelectedRound(round)}
                            aria-pressed={selectedRound === round}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums transition ${
                                selectedRound === round
                                    ? "border-primary bg-primary text-primary-fg"
                                    : "border-border bg-surface text-fg hover:bg-surface-muted"
                            }`}
                        >
                            {t("boutAnalysis.cornerCard.roundTab", { round })}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tactics list (preserves backend R20 order strictly) */}
            {card.tactics.length === 0 ? (
                <Card className="min-w-0">
                    <CardContent className="p-5 text-center text-xs text-fg-muted">
                        {t("boutAnalysis.cornerCard.noAnalysisYet")}
                    </CardContent>
                </Card>
            ) : filteredTactics.length === 0 ? (
                <Card className="min-w-0">
                    <CardContent className="p-5 text-center text-xs text-fg-muted">
                        {t("boutAnalysis.cornerCard.emptyTactics")}
                    </CardContent>
                </Card>
            ) : (
                <ol className="flex min-w-0 flex-col gap-3 print:gap-2">
                    {filteredTactics.map((tactic, idx) => (
                        <li
                            key={tactic.id}
                            className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-2xs print:break-inside-avoid print:rounded-md print:border-black print:p-2.5 print:shadow-none"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-start gap-2.5">
                                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold tabular-nums text-fg print:size-5 print:border print:border-black">
                                        {idx + 1}
                                    </span>
                                    <p className="min-w-0 break-words text-sm font-semibold leading-snug text-fg print:text-xs">
                                        {tactic.text}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-8 print:mt-1.5 print:pl-7">
                                <Badge
                                    tone={tactic.round !== null ? "info" : "neutral"}
                                    variant="outline"
                                >
                                    {tactic.round !== null
                                        ? t("boutAnalysis.cornerCard.roundBadge", { round: tactic.round })
                                        : t("boutAnalysis.cornerCard.everyRoundBadge")}
                                </Badge>

                                <Badge
                                    tone={tactic.basis === "REPEATED" ? "success" : "neutral"}
                                    variant="outline"
                                >
                                    {t(`boutAnalysis.cornerCard.basis.${tactic.basis}`)}
                                </Badge>

                                {!tactic.trained ? (
                                    <Badge tone="warning" icon={TriangleAlert}>
                                        {t("boutAnalysis.cornerCard.untrainedBadge")}
                                    </Badge>
                                ) : (
                                    <Badge tone="neutral" variant="outline">
                                        {t("boutAnalysis.cornerCard.trainedBadge")}
                                    </Badge>
                                )}
                            </div>

                            {tactic.partnerBrief && (
                                <div className="mt-2.5 rounded-lg bg-surface-muted px-3 py-2 text-xs text-fg-muted sm:ml-8 print:mt-1.5 print:ml-7 print:py-1 print:text-[11px]">
                                    <span className="font-semibold text-fg">
                                        {t("boutAnalysis.cornerCard.partnerBriefLabel")}{" "}
                                    </span>
                                    <span className="break-words">{tactic.partnerBrief}</span>
                                </div>
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
