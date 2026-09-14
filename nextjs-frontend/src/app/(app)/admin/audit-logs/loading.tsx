import { FilterRowSkeleton, LoadingRegion, PageHeaderSkeleton, Skeleton, TableCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading audit logs">
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
