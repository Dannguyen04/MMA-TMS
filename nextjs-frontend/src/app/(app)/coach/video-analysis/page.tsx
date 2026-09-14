import { ArrowRight, CircleX, LoaderCircle, Upload } from "lucide-react";
import type { Metadata } from "next";

import { FighterIdentity } from "@/components/domain/fighter-identity";
import { VideoStatusBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { describeJobFailure } from "@/components/video/job-failure";
import { LiveJobStatus } from "@/components/video/live-job-status";
import { ReviewQueue } from "@/components/video/review-queue";
import { VideoLibrary } from "@/components/video/video-library";
import { VideoThumb } from "@/components/video/video-thumb";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import type { User, VideoStatus } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { listReviewQueue, listVideoLibrary, type VideoLibraryItem } from "@/lib/services/videos";

export const metadata: Metadata = { title: "Video analysis" };

/** Footage that can't be reviewed yet: listed on its own and left out of the unfiltered library grid. */
const ATTENTION_STATUSES: VideoStatus[] = ["processing", "queued", "failed"];

export default async function CoachVideoAnalysisPage({ searchParams }: PageProps<"/coach/video-analysis">) {
    const user = await requireRole("coach");
    const params = await searchParams;
    const now = new Date().toISOString();

    return (
        <>
            <PageHeader
                title="Video analysis"
                description="See what the AI found in your fighters' footage, then confirm or correct it before it shapes training."
                actions={
                    <ButtonLink href={routes.coach.uploadVideo}>
                        <Upload aria-hidden />
                        Upload video
                    </ButtonLink>
                }
            />
            {/* The review sections and the library are sibling async components, so their data loads in parallel. */}
            <div className="flex flex-col gap-8">
                <ReviewSections user={user} now={now} />
                <section aria-labelledby="library-heading" className="flex flex-col gap-4">
                    <div>
                        <h2 id="library-heading" className="text-lg font-semibold text-fg">
                            All footage
                        </h2>
                        <p className="mt-0.5 text-sm text-fg-muted">Analysed footage from your roster, newest first. Filter by status to include processing or failed videos.</p>
                    </div>
                    <VideoLibrary
                        user={user}
                        role="coach"
                        pathname={routes.coach.videoAnalysis}
                        searchParams={params}
                        uploadHref={routes.coach.uploadVideo}
                        now={now}
                        hideStatuses={ATTENTION_STATUSES}
                    />
                </section>
            </div>
        </>
    );
}

async function ReviewSections({ user, now }: { user: User; now: string }) {
    const scope = accessibleFighterIds(user);
    const [queue, roster] = await Promise.all([listReviewQueue(scope), listVideoLibrary({ fighterIds: scope })]);
    const attention = roster.filter((item) => ATTENTION_STATUSES.includes(item.video.status));

    return (
        <>
            <ReviewQueue items={queue} now={now} />
            {attention.length > 0 && (
                <Card>
                    <CardHeader icon={<LoaderCircle />} title="Processing and needs attention" description="Footage still being analysed, and analyses that didn't finish." />
                    <ul className="divide-y divide-border border-t border-border">
                        {attention.map((item) => (
                            <AttentionRow key={item.video.id} item={item} />
                        ))}
                    </ul>
                </Card>
            )}
        </>
    );
}

function AttentionRow({ item: { video, fighter, job } }: { item: VideoLibraryItem }) {
    const inFlight = video.status === "queued" || video.status === "processing";
    return (
        <li className="flex items-center gap-3 px-5 py-3.5 md:gap-4">
            <VideoThumb trainingType={video.trainingType} durationSec={video.durationSec} size="sm" className="hidden w-24 shrink-0 rounded-lg sm:block" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg sm:truncate">{video.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <FighterIdentity fighter={fighter} size="sm" showMeta={false} />
                    <VideoStatusBadge status={video.status} size="sm" />
                </div>
                {inFlight && video.jobId && (
                    <div className="mt-2 max-w-80">
                        <LiveJobStatus jobId={video.jobId} initialJob={job} />
                    </div>
                )}
                {video.status === "failed" && (
                    <p className="mt-1.5 flex items-start gap-1 text-xs text-danger-fg">
                        <CircleX aria-hidden className="mt-px size-3.5 shrink-0" />
                        {describeJobFailure(job?.errorCode ?? null).title}
                    </p>
                )}
            </div>
            <ButtonLink href={routes.coach.video(video.id)} variant="secondary" size="sm" aria-label={`Open ${video.title}`}>
                Open
                <ArrowRight aria-hidden />
            </ButtonLink>
        </li>
    );
}
