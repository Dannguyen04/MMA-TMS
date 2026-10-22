import { LoadingRegion, PageHeaderSkeleton, TableCardSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("coachBouts.loading.bouts")}>
            <PageHeaderSkeleton actions={1} />
            <TableCardSkeleton rows={4} withHeader />
        </LoadingRegion>
    );
}
