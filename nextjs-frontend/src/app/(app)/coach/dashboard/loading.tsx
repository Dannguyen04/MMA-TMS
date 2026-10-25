import { QueueSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function CoachDashboardLoading() {
    const { t } = await getTranslator();
    return <QueueSkeleton label={t("coachToday.loading")} />;
}
