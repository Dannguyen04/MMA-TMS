import { FilterRowSkeleton, KpiRowSkeleton, LoadingRegion, PageHeaderSkeleton, TableCardSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function CoachGoalsLoading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("screens.performance.loading.goals")}>
            <PageHeaderSkeleton actions={1} />
            <div className="flex flex-col gap-6">
                <KpiRowSkeleton />
                <div className="flex flex-col gap-4">
                    <FilterRowSkeleton search={false} selects={3} />
                    <TableCardSkeleton rows={8} />
                </div>
            </div>
        </LoadingRegion>
    );
}
