import { FilterRowSkeleton, LoadingRegion, PageHeaderSkeleton, Skeleton, TableCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading injuries">
            <PageHeaderSkeleton actions={1} />
            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
                        {Array.from({ length: 3 }, (_, i) => (
                            <Skeleton key={i} className="h-[155px] rounded-xl" />
                        ))}
                    </div>
                    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-5 pt-4 pb-5 lg:col-span-2">
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-56" />
                            <Skeleton className="h-4 w-72 max-w-full" />
                        </div>
                        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                            <Skeleton className="h-[22rem] w-40 shrink-0 rounded-3xl" />
                            <div className="w-full min-w-0 flex-1 space-y-4">
                                {Array.from({ length: 4 }, (_, i) => (
                                    <Skeleton key={i} className="h-12 rounded-lg" />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    <FilterRowSkeleton selects={5} />
                    <TableCardSkeleton rows={6} />
                </div>
            </div>
        </LoadingRegion>
    );
}
