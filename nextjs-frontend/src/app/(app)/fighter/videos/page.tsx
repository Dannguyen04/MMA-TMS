import { Camera, FlaskConical, Upload } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VideoLibrary } from "@/components/video/video-library";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Film" };

export default async function FighterVideosPage({ searchParams }: PageProps<"/fighter/videos">) {
    const user = await requireRole("fighter");
    const params = await searchParams;
    const now = new Date().toISOString();

    return (
        <>
            <PageHeader
                title="Film"
                description="Your training footage and what the AI saw in it — strikes, guard, footwork — plus your coach's review."
                actions={
                    <ButtonLink href={routes.fighter.uploadVideo}>
                        <Upload aria-hidden />
                        Upload a video for AI analysis
                    </ButtonLink>
                }
            />
            <div className="flex flex-col gap-6">
                <LiveFormCheckCard href={routes.fighter.liveCheck} />
                <VideoLibrary user={user} role="fighter" pathname={routes.fighter.videos} searchParams={params} uploadHref={routes.fighter.uploadVideo} now={now} headingLevel={2} />
            </div>
        </>
    );
}

/** The in-browser form check, offered beside the uploads rather than hidden behind a header button. */
function LiveFormCheckCard({ href }: { href: string }) {
    return (
        <Card className="flex min-w-0 flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-ai-soft text-ai-fg ring-1 ring-ai-border ring-inset">
                <Camera className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-2 font-display text-[19px] leading-6 font-bold text-fg">
                    Live form check
                    <Badge tone="info" icon={FlaskConical} size="sm">
                        Beta
                    </Badge>
                </h2>
                <p className="mt-0.5 max-w-3xl text-sm text-pretty text-fg-muted">
                    Throw roundhouse kicks in front of your camera and get instant feedback on knee chamber, extension and speed. It runs on this
                    device: nothing is recorded or uploaded.
                </p>
            </div>
            <ButtonLink href={href} variant="secondary" className="w-fit">
                <Camera aria-hidden />
                Start a live check
            </ButtonLink>
        </Card>
    );
}
