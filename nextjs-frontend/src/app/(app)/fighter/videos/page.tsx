import { Camera, FlaskConical, Upload } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VideoLibrary } from "@/components/video/video-library";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.video.page.film") };
}

export default async function FighterVideosPage({ searchParams }: PageProps<"/fighter/videos">) {
    const { t } = await getTranslator();
    const user = await requireRole("fighter");
    const params = await searchParams;
    const now = new Date().toISOString();

    return (
        <>
            <PageHeader
                title={t("screens.video.page.film")}
                description={t("screens.video.page.filmDesc")}
                actions={
                    <ButtonLink href={routes.fighter.uploadVideo}>
                        <Upload aria-hidden />
                        {t("screens.video.page.uploadForAnalysis")}
                    </ButtonLink>
                }
            />
            <div className="flex flex-col gap-6">
                <LiveFormCheckCard href={routes.fighter.liveCheck} t={t} />
                <VideoLibrary user={user} role="fighter" pathname={routes.fighter.videos} searchParams={params} uploadHref={routes.fighter.uploadVideo} now={now} headingLevel={2} />
            </div>
        </>
    );
}

/** The in-browser form check, offered beside the uploads rather than hidden behind a header button. */
function LiveFormCheckCard({ href, t }: { href: string; t: Translator }) {
    return (
        <Card className="flex min-w-0 flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-ai-soft text-ai-fg ring-1 ring-ai-border ring-inset">
                <Camera className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-2 font-display text-[19px] leading-6 font-bold text-fg">
                    {t("screens.video.page.liveCheck")}
                    <Badge tone="info" icon={FlaskConical} size="sm">
                        {t("screens.video.page.beta")}
                    </Badge>
                </h2>
                <p className="mt-0.5 max-w-3xl text-sm text-pretty text-fg-muted">{t("screens.video.page.liveCardDesc")}</p>
            </div>
            <ButtonLink href={href} variant="secondary" className="w-fit">
                <Camera aria-hidden />
                {t("screens.video.page.startLiveCheck")}
            </ButtonLink>
        </Card>
    );
}
