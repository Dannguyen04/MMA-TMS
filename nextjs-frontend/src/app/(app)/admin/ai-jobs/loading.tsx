import { FilterRowSkeleton, LoadingRegion, PageHeaderSkeleton, Skeleton, TableCardSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("screens.admin.loading.aiJobs")}>
            <PageHeaderSkeleton actions={1} />
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <Skeleton className="h-11 w-[42rem] max-w-full rounded-xl" />
                    <FilterRowSkeleton selects={0} />
                </div>
                <TableCardSkeleton rows={10} withHeader />
            </div>
        </LoadingRegion>
    );
}
