import { DashboardSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function CoachPerformanceLoading() {
    const { t } = await getTranslator();
    return <DashboardSkeleton label={t("screens.performance.loading.team")} />;
}
