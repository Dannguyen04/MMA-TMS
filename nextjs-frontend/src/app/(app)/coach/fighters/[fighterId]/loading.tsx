import { ProfileOverviewSkeleton } from "@/components/dashboard/profile-overview-skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function CoachFighterOverviewLoading() {
    const { t } = await getTranslator();
    return <ProfileOverviewSkeleton label={t("training.loading.fighterProfile")} />;
}
