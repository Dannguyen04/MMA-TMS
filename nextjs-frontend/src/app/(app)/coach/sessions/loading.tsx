import { LoadingRegion, PageHeaderSkeleton, Skeleton, WeekAgendaSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading sessions">
            <PageHeaderSkeleton actions={1} />
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <Skeleton className="h-10 w-40 rounded-lg" />
                    <Skeleton className="h-9 w-40 rounded-lg" />
                </div>
                <div className="flex flex-col gap-6">
                    <WeekAgendaSkeleton />
                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
                        <Skeleton className="h-56 rounded-xl" />
                    </div>
                </div>
            </div>
        </LoadingRegion>
    );
}
