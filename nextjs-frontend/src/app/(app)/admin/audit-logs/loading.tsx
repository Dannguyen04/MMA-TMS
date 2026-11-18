import { FilterRowSkeleton, LoadingRegion, PageHeaderSkeleton, Skeleton, TableCardSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("screens.admin.loading.auditLogs")}>
            <PageHeaderSkeleton />
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    <FilterRowSkeleton selects={3} />
                    <div className="flex flex-wrap gap-3">
                        <Skeleton className="h-9 w-[calc(50%-0.375rem)] rounded-lg sm:w-44" />
                        <Skeleton className="h-9 w-[calc(50%-0.375rem)] rounded-lg sm:w-44" />
                    </div>
                </div>
                <TableCardSkeleton rows={12} withHeader />
            </div>
        </LoadingRegion>
    );
}
