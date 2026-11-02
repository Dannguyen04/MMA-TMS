import { LoadingRegion, PageHeaderSkeleton, TableCardSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function CoachBoutsLoading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("coachBouts.list.loading")}>
            <PageHeaderSkeleton actions={1} />
            <TableCardSkeleton rows={4} />
        </LoadingRegion>
    );
}
