import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { UploadWizard } from "@/components/video/upload-wizard";
import { loadUploadWizardData } from "@/components/video/upload-wizard-data";
import { requireRole } from "@/lib/auth/session";
import { getDemoCopy } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const copy = await getDemoCopy();
    return { title: copy("Upload training video") };
}

export default async function CoachUploadVideoPage({ searchParams }: PageProps<"/coach/video-analysis/upload">) {
    const copy = await getDemoCopy();
    const user = await requireRole("coach");
    const params = await searchParams;
    const data = await loadUploadWizardData(user);
    const fighterId = param(params.fighter) ?? null;
    const validFighter = data.fighters.some((f) => f.id === fighterId) ? fighterId : null;

    return (
        <>
            <PageHeader
                back={{ href: validFighter ? routes.coach.fighterVideos(validFighter) : routes.coach.videoAnalysis, label: validFighter ? copy("Fighter videos") : copy("Film room") }}
                title={copy("Upload training video")}
                description={copy("Add footage for a fighter on your roster. The AI analyses it and the findings land in your review queue.")}
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
