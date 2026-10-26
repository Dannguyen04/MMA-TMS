import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { getBoutAnalysisDetail, getBoutRounds } from "@/lib/services/bout-analysis";
import { getBout } from "@/lib/services/bouts";
import { getFighter } from "@/lib/services/people";
import { RoundsView } from "./rounds-view";

interface PageProps {
    params: Promise<{ boutId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const [{ boutId }, { t }] = await Promise.all([params, getTranslator()]);
    const bout = await getBout(boutId);
    return {
        title: bout
            ? t("boutAnalysis.rounds.metaTitle", { eventName: bout.eventName })
            : t("boutAnalysis.rounds.metaTitleDefault"),
    };
}

export default async function CoachBoutRoundsPage({ params }: PageProps) {
    const user = await requireRole("coach");
    const [{ boutId }, { t }] = await Promise.all([params, getTranslator()]);

    const bout = await getBout(boutId);
    if (!bout || !canAccessFighter(user, bout.fighterId)) {
        notFound();
    }

    const [fighter, analysisDetail, roundsResult] = await Promise.all([
        getFighter(bout.fighterId),
        getBoutAnalysisDetail(boutId),
        getBoutRounds(boutId),
    ]);

    if (!fighter) {
        notFound();
    }

    if (!roundsResult.ok && roundsResult.error === "BOUT_NOT_FOUND") {
        notFound();
    }

    const canRecordRounds = bout.status === "WEIGHED_IN" || bout.status === "COMPLETED";
    const scheduledRounds =
        (roundsResult.ok ? roundsResult.data.scheduledRounds : null) ??
        analysisDetail?.scheduledRounds ??
        null;

    return (
        <div className="flex min-w-0 flex-col gap-5">
            <PageHeader
                eyebrow={t("boutAnalysis.rounds.eyebrow")}
                back={{
                    href: routes.coach.bout(bout.id),
                    label: t("boutAnalysis.cornerCard.backToBout"),
                }}
                title={t("boutAnalysis.rounds.title")}
                description={t("boutAnalysis.rounds.description", {
                    fighter: fighter.name,
                    opponent: bout.opponentName ?? t("bout.opponentTba"),
                    rounds: scheduledRounds ?? 0,
                })}
            />

            {!canRecordRounds || !roundsResult.ok ? (
                <Card className="min-w-0 border-warning-border bg-warning-soft">
                    <CardContent className="flex items-start gap-3 p-5 text-xs text-warning-fg">
                        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold">
                                {t("boutAnalysis.rounds.notWeighedInTitle")}
                            </p>
                            <p className="mt-1 break-words leading-relaxed">
                                {t("boutAnalysis.rounds.notWeighedInText")}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : scheduledRounds === null ? (
                <Card className="min-w-0">
                    <CardContent className="p-5 text-xs text-fg-muted">
                        {t("boutAnalysis.rounds.noScheduledRounds")}
                    </CardContent>
                </Card>
            ) : (
                <RoundsView
                    boutId={bout.id}
                    scheduledRounds={scheduledRounds}
                    observations={analysisDetail?.opponentAnalysis.observations ?? []}
                    tactics={analysisDetail?.opponentAnalysis.tactics ?? []}
                    rounds={roundsResult.data.rounds}
                    advice={roundsResult.data.advice}
                />
            )}
        </div>
    );
}
