import { TodaySkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function FighterDashboardLoading() {
    const { t } = await getTranslator();
    return <TodaySkeleton label={t("fighterToday.loading")} />;
}
