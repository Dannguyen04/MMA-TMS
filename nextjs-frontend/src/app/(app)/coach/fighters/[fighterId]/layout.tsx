import { CalendarPlus, Target, Upload } from "lucide-react";

import { FighterProfileHeader } from "@/components/dashboard/fighter-profile-header";
import { loadRosterEntry } from "@/components/dashboard/roster-data";
import { ButtonLink } from "@/components/ui/button";
import { TabNav } from "@/components/ui/tabs";
import { requireRole } from "@/lib/auth/session";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";

export default async function CoachFighterLayout({ children, params }: LayoutProps<"/coach/fighters/[fighterId]">) {
    const user = await requireRole("coach");
    const { fighterId } = await params;
    const { fighter, clearanceState } = await loadRosterEntry(user, fighterId);
    const now = new Date().toISOString();

    return (
        <>
            <FighterProfileHeader
                fighter={fighter}
                clearanceState={clearanceState}
                back={{ href: routes.coach.fighters, label: "Fighters" }}
                now={now}
                actions={
                    <>
                        <ButtonLink href={routes.coach.fighterGoals(fighter.id)} variant="secondary">
                            <Target aria-hidden />
                            Set goal
                        </ButtonLink>
                        <ButtonLink href={hrefWith(routes.coach.uploadVideo, {}, { fighter: fighter.id })} variant="secondary">
                            <Upload aria-hidden />
                            Upload video
                        </ButtonLink>
                        <ButtonLink href={hrefWith(routes.coach.newSession, {}, { fighter: fighter.id })}>
                            <CalendarPlus aria-hidden />
                            Schedule session
                        </ButtonLink>
                    </>
                }
            />
            <TabNav
                label={`${fighter.name} profile sections`}
                items={[
                    { href: routes.coach.fighter(fighter.id), label: "Overview", exact: true },
                    { href: routes.coach.fighterPerformance(fighter.id), label: "Performance" },
                    { href: routes.coach.fighterTraining(fighter.id), label: "Training" },
                    { href: routes.coach.fighterVideos(fighter.id), label: "Videos" },
                    { href: routes.coach.fighterGoals(fighter.id), label: "Goals" },
                ]}
            />
            <div className="mt-6">{children}</div>
        </>
    );
}
