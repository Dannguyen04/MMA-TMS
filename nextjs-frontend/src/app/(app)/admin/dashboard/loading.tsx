import { QueueSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function Loading() {
    const { t } = await getTranslator();
    return <QueueSkeleton label={t("screens.admin.loading.today")} actions={1} />;
}
