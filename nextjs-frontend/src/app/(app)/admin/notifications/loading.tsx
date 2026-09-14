import { LoadingRegion, PageHeaderSkeleton, Skeleton, TableCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading broadcasts">
            <PageHeaderSkeleton actions={1} />
            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {Array.from({ length: 3 }, (_, i) => (
                        <Skeleton key={i} className="h-[112px] rounded-xl" />
                    ))}
                </div>
                <TableCardSkeleton rows={2} />
                <TableCardSkeleton rows={3} />
            </div>
        </LoadingRegion>
    );
}
