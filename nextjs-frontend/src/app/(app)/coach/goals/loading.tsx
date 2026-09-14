import { FilterRowSkeleton, KpiRowSkeleton, LoadingRegion, PageHeaderSkeleton, TableCardSkeleton } from "@/components/ui/skeleton";

export default function CoachGoalsLoading() {
    return (
        <LoadingRegion label="Loading goals">
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
