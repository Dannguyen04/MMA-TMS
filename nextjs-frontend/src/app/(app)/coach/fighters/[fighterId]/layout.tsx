import { CalendarPlus, Target, Upload } from "lucide-react";

import { FighterProfileHeader } from "@/components/dashboard/fighter-profile-header";
import { loadRosterEntry } from "@/components/dashboard/roster-data";
import { FighterFigure } from "@/components/fighter-3d/fighter-figure";
import { getClearanceSummary } from "@/components/training/training-data";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { TabNav } from "@/components/ui/tabs";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";

export default async function CoachFighterLayout({ children, params }: LayoutProps<"/coach/fighters/[fighterId]">) {
    const { t, locale } = await getTranslator();
    const user = await requireRole("coach");
    const { fighterId } = await params;
    const { fighter, clearanceState } = await loadRosterEntry(user, fighterId);
    const now = new Date().toISOString();
    // Summary clearance only (clinical fields blanked): what a coach may see.
    const clearance = clearanceState === "restricted" ? (await getClearanceSummary(fighter.id, now)).clearance : null;
    const restricted = (clearance?.restrictions ?? []).flatMap((restriction) => restriction.blockedRegions.map((region) => ({ region, label: restriction.label })));

    return (
        <>
            <FighterProfileHeader
                fighter={fighter}
                clearanceState={clearanceState}
                back={{ href: routes.coach.fighters, label: t("training.fighterLayout.back") }}
                now={now}
                locale={locale}
                figure={
                    <FighterFigure
                        name={fighter.name}
                        figure={{
                            sex: fighter.sex,
                            heightCm: fighter.heightCm,
                            weightKg: fighter.weightKg,
                            bodyFatPct: fighter.bodyFatPct,
                            stance: fighter.stance,
                            healthStatus: fighter.healthStatus,
                        }}
                        reachCm={fighter.reachCm}
                        weightClass={fighter.weightClass}
                        restricted={restricted}
                        fallback={<Avatar name={fighter.name} shape="octagon" size="xl" className="max-sm:size-14 max-sm:text-lg" />}
                    />
                }
                actions={
                    <>
                        <ButtonLink href={routes.coach.fighterGoals(fighter.id)} variant="secondary">
                            <Target aria-hidden />
                            {t("training.fighterLayout.setGoal")}
                        </ButtonLink>
                        <ButtonLink href={hrefWith(routes.coach.uploadVideo, {}, { fighter: fighter.id })} variant="secondary">
                            <Upload aria-hidden />
                            {t("training.fighterLayout.uploadVideo")}
                        </ButtonLink>
                        <ButtonLink href={hrefWith(routes.coach.newSession, {}, { fighter: fighter.id })}>
                            <CalendarPlus aria-hidden />
                            {t("training.fighterLayout.scheduleSession")}
                        </ButtonLink>
                    </>
                }
            />
            <TabNav
                label={t("training.fighterLayout.tabSections", { name: fighter.name })}
                items={[
                    { href: routes.coach.fighter(fighter.id), label: t("training.fighterLayout.tabOverview"), exact: true },
                    { href: routes.coach.fighterPerformance(fighter.id), label: t("training.fighterLayout.tabPerformance") },
                    { href: routes.coach.fighterTraining(fighter.id), label: t("training.fighterLayout.tabTraining") },
                    { href: routes.coach.fighterVideos(fighter.id), label: t("training.fighterLayout.tabVideos") },
                    { href: routes.coach.fighterGoals(fighter.id), label: t("training.fighterLayout.tabGoals") },
                ]}
            />
            <div className="mt-6">{children}</div>
        </>
    );
}
