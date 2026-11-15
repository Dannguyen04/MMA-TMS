import { ClipboardList, Eye, Flame, Scale, Swords, Target, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Callout } from "@/components/training/callout";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { Tone } from "@/components/ui/tone";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import type { BoutResult } from "@/lib/domain/bout";
import { improvementPointMessage, type BoutReport } from "@/lib/domain/bout-report";
import { formatNumber, formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getBoutReport } from "@/lib/services/bout-analysis";
import { getCampBout } from "@/lib/services/bouts";
import { getFighter } from "@/lib/services/people";
import { ReportReviewForm } from "./report-review-form";

interface PageProps {
    params: Promise<{ boutId: string }>;
}

const RESULT_TONE: Record<BoutResult, Tone> = { WIN: "success", LOSS: "danger", DRAW: "neutral", NO_CONTEST: "neutral" };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const [{ boutId }, { t }] = await Promise.all([params, getTranslator()]);
    const bout = await getCampBout(boutId);
    return { title: bout ? t("boutAnalysis.report.metaTitle", { eventName: bout.event }) : t("boutAnalysis.report.metaTitleDefault") };
}

function resultLine(result: BoutReport["result"], t: Translator): string {
    if (!result.result) return "—";
    const parts = [t(`boutLabel.result.${result.result}`)];
    if (result.method) parts.push(t(`boutLabel.method.${result.method}`));
    const line = parts.join(" · ");
    return result.resultRound ? `${line}, ${t("boutDetail.resultCard.round", { n: result.resultRound })}` : line;
}

/** Business flow 14 (T-041): what worked, what the opponent didn't do, and what to train for the next camp. */
export default async function CoachBoutReportPage({ params }: PageProps) {
    const user = await requireRole("coach");
    const [{ boutId }, { t, locale }] = await Promise.all([params, getTranslator()]);

    const bout = await getCampBout(boutId);
    if (!bout || !canAccessFighter(user, bout.fighterId)) notFound();

    const [fighter, reportResult] = await Promise.all([getFighter(bout.fighterId), getBoutReport(boutId)]);
    if (!fighter) notFound();
    if (!reportResult.ok && reportResult.error !== "BOUT_INVALID_TRANSITION") notFound();

    const boutHref = routes.coach.bout(bout.id);
    const roundsHref = `${boutHref}/rounds`;

    return (
        <div className="flex min-w-0 flex-col gap-5">
            <PageHeader
                eyebrow={t("boutAnalysis.report.eyebrow")}
                back={{ href: boutHref, label: t("boutAnalysis.cornerCard.backToBout") }}
                title={bout.event}
                description={`${fighter.name} · ${bout.opponent ?? t("bout.opponentTba")} · ${formatShortDate(bout.boutAt, locale)}`}
                actions={
                    <ButtonLink href={roundsHref} variant="secondary">
                        <ClipboardList aria-hidden />
                        {t("boutAnalysis.nav.rounds")}
                    </ButtonLink>
                }
            />

            {!reportResult.ok ? (
                <Callout
                    tone="warning"
                    icon={Trophy}
                    title={t("boutAnalysis.report.notReadyTitle")}
                    action={
                        <ButtonLink href={boutHref} variant="secondary" size="sm">
                            {t("boutAnalysis.cornerCard.backToBout")}
                        </ButtonLink>
                    }
                >
                    {t("boutAnalysis.report.notReadyText")}
                </Callout>
            ) : (
                <ReportBody report={reportResult.report} boutId={bout.id} boutDate={formatShortDate(bout.boutAt, locale)} roundsHref={roundsHref} locale={locale} t={t} />
            )}
        </div>
    );
}

function ReportBody({
    report,
    boutId,
    boutDate,
    roundsHref,
    locale,
    t,
}: {
    report: BoutReport;
    boutId: string;
    boutDate: string;
    roundsHref: string;
    locale: Locale;
    t: Translator;
}) {
    const { result, roundsRecorded } = report;
    const exceeded = report.acuteLoss?.status === "EXCEEDED" ? report.acuteLoss : null;

    return (
        <>
            <Card className="min-w-0">
                <CardContent className="flex min-w-0 flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-[0.08em] text-fg-subtle uppercase">{t("boutAnalysis.report.resultTitle")}</p>
                        <p className="mt-1 font-display text-2xl font-bold break-words text-fg">{resultLine(result, t)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {result.result && (
                            <Badge tone={RESULT_TONE[result.result]} icon={Trophy}>
                                {t(`boutLabel.result.${result.result}`)}
                            </Badge>
                        )}
                        {result.knockedDown !== null && (
                            <Badge tone={result.knockedDown ? "warning" : "neutral"}>
                                {t(result.knockedDown ? "boutAnalysis.report.knockedDown" : "boutAnalysis.report.notKnockedDown")}
                            </Badge>
                        )}
                        <Badge tone="info" icon={ClipboardList}>
                            {t("boutAnalysis.report.roundsRecorded", { count: roundsRecorded })}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {roundsRecorded === 0 && (
                <Callout
                    tone="info"
                    icon={ClipboardList}
                    title={t("boutAnalysis.report.noRoundsTitle")}
                    action={
                        <ButtonLink href={roundsHref} variant="secondary" size="sm">
                            {t("boutAnalysis.nav.rounds")}
                        </ButtonLink>
                    }
                >
                    {t("boutAnalysis.report.noRoundsText")}
                </Callout>
            )}

            <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-3">
                <Card className="min-w-0 lg:col-start-3 lg:row-start-1">
                    <CardHeader title={t("boutAnalysis.report.pointsTitle")} icon={<Target />} />
                    <CardContent>
                        {report.improvementPoints.length === 0 ? (
                            <p className="text-sm text-fg-muted">{t("boutAnalysis.report.pointsEmpty")}</p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {report.improvementPoints.map((point, index) => {
                                    const { key, values } = improvementPointMessage(point);
                                    return (
                                        <li key={`${point.code}-${index}`} className="flex items-start gap-2 text-sm text-fg">
                                            <Flame aria-hidden className="mt-0.5 size-4 shrink-0 text-danger-fg" />
                                            <span className="min-w-0 break-words">{t(key, values)}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card className="min-w-0 lg:col-span-2 lg:row-span-3 lg:row-start-1">
                    <CardHeader title={t("boutAnalysis.report.tacticsTitle")} description={t("boutAnalysis.report.tacticsDescription")} icon={<Swords />} />
                    <CardContent>
                        {report.tactics.length === 0 ? (
                            <p className="text-sm text-fg-muted">{t("boutAnalysis.report.tacticsEmpty")}</p>
                        ) : roundsRecorded === 0 ? (
                            // Without rounds there is nothing to judge; a saved verdict would also outrank the rounds recorded later.
                            <p className="text-sm text-fg-muted">{t("boutAnalysis.report.tacticsNeedRounds")}</p>
                        ) : (
                            <ReportReviewForm boutId={boutId} tactics={report.tactics} />
                        )}
                    </CardContent>
                </Card>

                <Card className="min-w-0 lg:col-start-3">
                    <CardHeader title={t("boutAnalysis.report.observationsTitle")} icon={<Eye />} />
                    <CardContent>
                        {report.observations.length === 0 ? (
                            <p className="text-sm text-fg-muted">{t("boutAnalysis.report.observationsEmpty")}</p>
                        ) : (
                            <ul className="flex flex-col gap-3">
                                {report.observations.map((observation) => (
                                    <li key={observation.id} className="flex min-w-0 flex-col gap-1">
                                        <p className="text-sm break-words text-fg">{observation.text}</p>
                                        {observation.notSeenInBout && (
                                            <Badge tone="warning" size="sm">
                                                {t("boutAnalysis.report.notSeen", { date: boutDate })}
                                            </Badge>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                {exceeded && (
                    <div className="min-w-0 lg:col-start-3">
                        <Callout tone="danger" icon={Scale} title={t("boutAnalysis.report.acuteTitle")}>
                            {t("boutAnalysis.report.acuteText", {
                                lossPct: exceeded.lossPct === null ? "—" : formatNumber(exceeded.lossPct, 1),
                                startKg: exceeded.startKg === null ? "—" : formatNumber(exceeded.startKg, 1),
                                startOn: exceeded.startOn ? formatShortDate(exceeded.startOn, locale) : "—",
                                limitPct: formatNumber(exceeded.limitPct, 1),
                            })}
                        </Callout>
                    </div>
                )}
            </div>
        </>
    );
}
