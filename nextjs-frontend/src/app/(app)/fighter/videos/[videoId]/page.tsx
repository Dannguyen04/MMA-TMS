import type { Metadata } from "next";

import { loadVideoDetail, VideoDetailView } from "@/components/video/video-detail-view";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";

export async function generateMetadata({ params }: PageProps<"/fighter/videos/[videoId]">): Promise<Metadata> {
    const user = await requireRole("fighter");
    const detail = await loadVideoDetail((await params).videoId);
    return { title: detail && canAccessFighter(user, detail.fighter.id) ? detail.video.title : "Video analysis" };
}

export default async function FighterVideoPage({ params, searchParams }: PageProps<"/fighter/videos/[videoId]">) {
    const user = await requireRole("fighter");
    const [{ videoId }, query] = await Promise.all([params, searchParams]);
    return <VideoDetailView user={user} videoId={videoId} role="fighter" searchParams={query} />;
}
