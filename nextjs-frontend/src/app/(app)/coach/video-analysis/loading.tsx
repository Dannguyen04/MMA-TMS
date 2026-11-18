import { VideoLibrarySkeleton } from "@/components/video/video-skeletons";
import { getTranslator } from "@/lib/i18n/server";

export default async function CoachVideoAnalysisLoading() {
    const { t } = await getTranslator();
    return <VideoLibrarySkeleton label={t("screens.video.loading.analysisLibrary")} withQueue />;
}
