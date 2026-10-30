import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { UploadWizard } from "@/components/video/upload-wizard";
import { loadUploadWizardData } from "@/components/video/upload-wizard-data";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.video.page.uploadVideo") };
}

export default async function CoachUploadVideoPage({ searchParams }: PageProps<"/coach/video-analysis/upload">) {
    const { t } = await getTranslator();
    const user = await requireRole("coach");
    const params = await searchParams;
    const data = await loadUploadWizardData(user);
    const fighterId = param(params.fighter) ?? null;
    const validFighter = data.fighters.some((f) => f.id === fighterId) ? fighterId : null;

    return (
        <>
            <PageHeader
                back={{ href: validFighter ? routes.coach.fighterVideos(validFighter) : routes.coach.videoAnalysis, label: validFighter ? t("screens.video.page.fighterVideos") : t("screens.video.page.filmRoom") }}
                title={t("screens.video.page.uploadTitle")}
                description={t("screens.video.page.uploadDescCoach")}
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
