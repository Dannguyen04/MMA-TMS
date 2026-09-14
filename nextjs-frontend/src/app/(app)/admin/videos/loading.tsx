import { FilterRowSkeleton, LoadingRegion, PageHeaderSkeleton, Skeleton, TableCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading videos">
            <PageHeaderSkeleton />
            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {Array.from({ length: 3 }, (_, i) => (
                        <Skeleton key={i} className="h-[112px] rounded-xl" />
                    ))}
                </div>
                <div className="flex flex-col gap-4">
                    <FilterRowSkeleton selects={3} />
                    <TableCardSkeleton rows={10} withHeader />
                </div>
            </div>
        </LoadingRegion>
    );
}
