import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { getBoutAnalysisDetail } from "@/lib/services/bout-analysis";
import { getCampBout } from "@/lib/services/bouts";
import { getFighter } from "@/lib/services/people";
import { listSessions } from "@/lib/services/training";
import { OpponentAnalysisView } from "./opponent-analysis-view";

interface PageProps {
    params: Promise<{ boutId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const [{ boutId }, { t }] = await Promise.all([params, getTranslator()]);
    const bout = await getCampBout(boutId);
    return {
        title: bout
            ? t("boutAnalysis.analysis.metaTitle", { eventName: bout.event })
            : t("boutAnalysis.analysis.metaTitleDefault"),
    };
}

export default async function CoachOpponentAnalysisPage({ params }: PageProps) {
    const user = await requireRole("coach");
    const [{ boutId }, { t }] = await Promise.all([params, getTranslator()]);

    const bout = await getCampBout(boutId);
    if (!bout || !canAccessFighter(user, bout.fighterId)) {
        notFound();
    }

    const [fighter, analysisDetail, sessions] = await Promise.all([
        getFighter(bout.fighterId),
        getBoutAnalysisDetail(boutId),
        listSessions({ fighterIds: [bout.fighterId], from: bout.campStartedOn || undefined }),
    ]);

    if (!fighter) {
        notFound();
    }

    const campSessions = sessions
        .filter((s) => s.status !== "cancelled")
        .map((s) => ({ id: s.id, title: s.title, type: s.type, scheduledAt: s.scheduledAt, completed: s.status === "completed" }));

    const analysis = analysisDetail?.opponentAnalysis ?? { observations: [], tactics: [] };
    const locked = bout.phase === "COMPLETED" || bout.phase === "CANCELLED";
    const canOpenCornerCard = bout.phase === "WEIGHED_IN" || bout.phase === "COMPLETED";

    return (
        <div className="flex min-w-0 flex-col gap-5">
            <PageHeader
                eyebrow={t("boutAnalysis.analysis.eyebrow")}
                back={{
                    href: routes.coach.bout(bout.id),
                    label: t("boutAnalysis.cornerCard.backToBout"),
                }}
                title={t("boutAnalysis.analysis.title")}
                description={t("boutAnalysis.analysis.description", {
                    fighter: fighter.name,
                    opponent: bout.opponent ?? t("bout.opponentTba"),
                })}
            />

            <OpponentAnalysisView
                boutId={bout.id}
                scheduledRounds={analysisDetail?.scheduledRounds ?? null}
                analysis={analysis}
                locked={locked}
                canOpenCornerCard={canOpenCornerCard}
                fighterName={fighter.name}
                opponentName={bout.opponent ?? t("bout.opponentTba")}
                fighter={{ stance: fighter.stance, heightCm: fighter.heightCm, reachCm: fighter.reachCm }}
                sessions={campSessions}
            />
        </div>
    );
}
