import { Target, Upload } from "lucide-react";
import type { Metadata } from "next";

import { PerformanceOverview } from "@/components/performance/performance-overview";
import { ButtonLink } from "@/components/ui/button";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/coach/fighters/[fighterId]/performance">): Promise<Metadata> {
    const user = await requireRole("coach");
    const fighter = await requireFighterAccess(user, (await params).fighterId);
    return { title: `Performance · ${fighter.name}` };
}

export default async function CoachFighterPerformancePage({ params }: PageProps<"/coach/fighters/[fighterId]/performance">) {
    const user = await requireRole("coach");
    const fighter = await requireFighterAccess(user, (await params).fighterId);

    return (
        <section aria-labelledby="performance-heading" className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h2 id="performance-heading" className="text-lg font-semibold text-fg">
                        Performance
                    </h2>
                    <p className="mt-0.5 text-sm text-fg-muted">
                        Weekly technique scores, volume, speed and training load for {fighter.name}.
                    </p>
                </div>
                <ButtonLink href={routes.coach.fighterGoals(fighter.id)} variant="secondary">
                    <Target aria-hidden />
                    Manage goals
                </ButtonLink>
            </div>
            <PerformanceOverview
                fighterId={fighter.id}
                fighterName={fighter.name}
                audience="coach"
                headingLevel={3}
                emptyAction={
                    <ButtonLink href={routes.coach.uploadVideo}>
                        <Upload aria-hidden />
                        Upload a training video
                    </ButtonLink>
                }
            />
        </section>
    );
}
