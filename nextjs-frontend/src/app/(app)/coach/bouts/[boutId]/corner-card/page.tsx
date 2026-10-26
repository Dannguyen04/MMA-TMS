import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { boutLimitKg } from "@/lib/domain/bout";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { getBoutAnalysisDetail, getCornerCard } from "@/lib/services/bout-analysis";
import { getCampBout } from "@/lib/services/bouts";
import { getFighter } from "@/lib/services/people";
import { CornerCardView } from "./corner-card-view";

interface PageProps {
    params: Promise<{ boutId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const [{ boutId }, { t }] = await Promise.all([params, getTranslator()]);
    const bout = await getCampBout(boutId);
    return {
        title: bout
            ? t("boutAnalysis.cornerCard.metaTitle", { eventName: bout.event })
            : t("boutAnalysis.cornerCard.metaTitleDefault"),
    };
}

export default async function CoachCornerCardPage({ params }: PageProps) {
    const user = await requireRole("coach");
    const [{ boutId }, { t }] = await Promise.all([params, getTranslator()]);

    const bout = await getCampBout(boutId);
    if (!bout || !canAccessFighter(user, bout.fighterId)) {
        notFound();
    }

    const [fighter, analysisDetail, cardResult] = await Promise.all([
        getFighter(bout.fighterId),
        getBoutAnalysisDetail(boutId),
        getCornerCard(boutId),
    ]);

    if (!fighter) {
        notFound();
    }

    if (!cardResult.ok && cardResult.error === "BOUT_NOT_FOUND") {
        notFound();
    }

    const weightLimitKg = boutLimitKg(bout) ?? bout.limitKg ?? 0;

    return (
        <div className="flex min-w-0 flex-col gap-5">
            <div className="print:hidden">
                <PageHeader
                    eyebrow={t("boutAnalysis.cornerCard.eyebrow")}
                    back={{
                        href: routes.coach.bout(bout.id),
                        label: t("boutAnalysis.cornerCard.backToBout"),
                    }}
                    title={bout.event}
                    description={t("coachBouts.detail.headerDescription", {
                        fighter: fighter.name,
                        opponent: bout.opponent ?? t("bout.opponentTba"),
                        weight: weightLimitKg,
                    })}
                />
            </div>

            {!cardResult.ok ? (
                <Card className="min-w-0 border-warning-border bg-warning-soft">
                    <CardContent className="flex items-start gap-3 p-5 text-xs text-warning-fg">
                        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold">
                                {t("boutAnalysis.cornerCard.notWeighedInTitle")}
                            </p>
                            <p className="mt-1 break-words leading-relaxed">
                                {t("boutAnalysis.cornerCard.notWeighedInText")}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <CornerCardView
                    boutId={bout.id}
                    eventName={bout.event}
                    fighterName={fighter.name}
                    opponentName={bout.opponent ?? t("bout.opponentTba")}
                    weightLimitKg={weightLimitKg}
                    scheduledRounds={analysisDetail?.scheduledRounds ?? null}
                    card={cardResult.card}
                />
            )}
        </div>
    );
}
