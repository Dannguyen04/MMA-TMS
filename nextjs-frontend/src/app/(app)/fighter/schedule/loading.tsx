import { DashboardSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function Loading() {
    const { t } = await getTranslator();
    return <DashboardSkeleton label={t("training.loading.schedule")} />;
}
