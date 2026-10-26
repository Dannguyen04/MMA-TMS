import { DetailSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function FighterInjuryLoading() {
    const { t } = await getTranslator();
    return <DetailSkeleton label={t("health.loadingInjury")} />;
}
