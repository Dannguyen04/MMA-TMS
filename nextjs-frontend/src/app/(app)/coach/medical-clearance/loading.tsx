import { DashboardSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function CoachMedicalClearanceLoading() {
    const { t } = await getTranslator();
    return <DashboardSkeleton label={t("health.loadingCoachClearance")} />;
}
