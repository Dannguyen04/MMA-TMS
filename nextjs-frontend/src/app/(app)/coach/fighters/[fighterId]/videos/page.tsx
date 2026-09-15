import { Upload } from "lucide-react";
import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { VideoLibrary } from "@/components/video/video-library";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/coach/fighters/[fighterId]/videos">): Promise<Metadata> {
    const user = await requireRole("coach");
    const fighter = requireFighterAccess(user, (await params).fighterId);
    return { title: `Videos · ${fighter.name}` };
}

export default async function CoachFighterVideosPage({ params, searchParams }: PageProps<"/coach/fighters/[fighterId]/videos">) {
    const user = await requireRole("coach");
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    const fighter = requireFighterAccess(user, fighterId);
    const uploadHref = `${routes.coach.uploadVideo}?fighter=${encodeURIComponent(fighter.id)}`;
    const firstName = fighter.name.split(" ")[0];

    return (
        <section aria-labelledby="videos-heading" className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h2 id="videos-heading" className="text-lg font-semibold text-fg">
                        Videos
                    </h2>
                    <p className="mt-0.5 text-sm text-fg-muted">{firstName}&apos;s training footage with AI analysis and your reviews.</p>
                </div>
                <ButtonLink href={uploadHref}>
                    <Upload aria-hidden />
                    Upload video
                </ButtonLink>
            </div>
            <VideoLibrary
                user={user}
                role="coach"
                pathname={routes.coach.fighterVideos(fighter.id)}
                searchParams={query}
                fighterId={fighter.id}
                uploadHref={uploadHref}
                now={new Date().toISOString()}
                headingLevel={3}
            />
        </section>
    );
}
