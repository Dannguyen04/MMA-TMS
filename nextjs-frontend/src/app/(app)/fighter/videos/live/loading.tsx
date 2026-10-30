import { DetailSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function FighterLiveFormCheckLoading() {
    const { t } = await getTranslator();
    return <DetailSkeleton label={t("screens.video.loading.liveCheck")} />;
}
