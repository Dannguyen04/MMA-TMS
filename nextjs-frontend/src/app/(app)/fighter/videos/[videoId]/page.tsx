import type { Metadata } from "next";

import { loadVideoDetail, VideoDetailView } from "@/components/video/video-detail-view";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata({ params }: PageProps<"/fighter/videos/[videoId]">): Promise<Metadata> {
    const user = await requireRole("fighter");
    const [detail, { t }] = await Promise.all([loadVideoDetail((await params).videoId), getTranslator()]);
    return { title: detail && canAccessFighter(user, detail.fighter.id) ? detail.video.title : t("screens.video.page.videoAnalysis") };
}

export default async function FighterVideoPage({ params, searchParams }: PageProps<"/fighter/videos/[videoId]">) {
    const user = await requireRole("fighter");
    const [{ videoId }, query] = await Promise.all([params, searchParams]);
    return <VideoDetailView user={user} videoId={videoId} role="fighter" searchParams={query} />;
}
