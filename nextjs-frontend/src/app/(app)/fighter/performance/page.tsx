import { Target, Upload } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PerformanceOverview } from "@/components/performance/performance-overview";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Performance" };

export default async function FighterPerformancePage() {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighter = requireFighterAccess(user, user.profileId);

    return (
        <>
            <PageHeader
                title="Performance"
                description="How your technique, speed and training load are developing week by week."
                actions={
                    <ButtonLink href={routes.fighter.goals} variant="secondary">
                        <Target aria-hidden />
                        My goals
                    </ButtonLink>
                }
            />
            <PerformanceOverview
                fighterId={fighter.id}
                fighterName={fighter.name}
                audience="fighter"
                headingLevel={2}
                techniqueHref={routes.fighter.technique}
                emptyAction={
                    <ButtonLink href={routes.fighter.uploadVideo}>
                        <Upload aria-hidden />
                        Upload a training video
                    </ButtonLink>
                }
            />
        </>
    );
}
