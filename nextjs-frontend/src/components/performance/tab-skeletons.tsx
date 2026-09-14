import { CardGridSkeleton, KpiRowSkeleton, LoadingRegion, SectionHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Placeholder for the performance tab inside a fighter profile (the layout already shows the header). */
export function PerformanceTabSkeleton() {
    return (
        <LoadingRegion label="Loading performance" className="flex flex-col gap-6">
            <SectionHeaderSkeleton />
            <KpiRowSkeleton />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <Skeleton className="h-96 rounded-xl lg:col-span-5" />
                <Skeleton className="h-96 rounded-xl lg:col-span-7" />
            </div>
            <Skeleton className="h-80 rounded-xl" />
        </LoadingRegion>
    );
}

/** Placeholder for the goals tab inside a fighter profile. */
export function GoalsTabSkeleton() {
    return (
        <LoadingRegion label="Loading goals" className="flex flex-col gap-6">
            <SectionHeaderSkeleton />
            <CardGridSkeleton columns={2} count={4} height="h-72" />
        </LoadingRegion>
    );
}
