import { DashboardSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function FighterPerformanceLoading() {
    const { t } = await getTranslator();
    return <DashboardSkeleton label={t("screens.performance.loading.performance")} />;
}
