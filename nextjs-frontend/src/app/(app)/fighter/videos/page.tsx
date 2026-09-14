import { Camera, Upload } from "lucide-react";
import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { VideoLibrary } from "@/components/video/video-library";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Videos" };

export default async function FighterVideosPage({ searchParams }: PageProps<"/fighter/videos">) {
    const user = await requireRole("fighter");
    const params = await searchParams;
    const now = new Date().toISOString();

    return (
        <>
            <PageHeader
                title="Videos"
                description="Your training footage and what the AI saw in it — strikes, guard, footwork — plus your coach's review."
                actions={
                    <>
                        <ButtonLink href={routes.fighter.liveCheck} variant="secondary">
                            <Camera aria-hidden />
                            Live form check
                        </ButtonLink>
                        <ButtonLink href={routes.fighter.uploadVideo}>
                            <Upload aria-hidden />
                            Upload video
                        </ButtonLink>
                    </>
                }
            />
            <VideoLibrary user={user} role="fighter" pathname={routes.fighter.videos} searchParams={params} uploadHref={routes.fighter.uploadVideo} now={now} headingLevel={2} />
        </>
    );
}
