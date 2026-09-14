import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { UploadWizard } from "@/components/video/upload-wizard";
import { loadUploadWizardData } from "@/components/video/upload-wizard-data";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Upload video" };

export default async function CoachUploadVideoPage({ searchParams }: PageProps<"/coach/video-analysis/upload">) {
    const user = await requireRole("coach");
    const params = await searchParams;
    const data = await loadUploadWizardData(user);
    const fighterId = param(params.fighter) ?? null;
    const validFighter = data.fighters.some((f) => f.id === fighterId) ? fighterId : null;

    return (
        <>
            <PageHeader
                back={{ href: validFighter ? routes.coach.fighterVideos(validFighter) : routes.coach.videoAnalysis, label: validFighter ? "Fighter videos" : "Video analysis" }}
                title="Upload training video"
                description="Add footage for a fighter on your roster. The AI analyses it and the findings land in your review queue."
            />
            <UploadWizard
                role="coach"
                viewerId={user.id}
                {...data}
                initialFighterId={validFighter}
                initialSessionId={param(params.session) ?? null}
                cancelHref={validFighter ? routes.coach.fighterVideos(validFighter) : routes.coach.videoAnalysis}
            />
        </>
    );
}
