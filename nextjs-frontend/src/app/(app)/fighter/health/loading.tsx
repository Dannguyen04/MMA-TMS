import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function FighterHealthLoading() {
    return (
        <LoadingRegion label="Loading your health and clearance">
            <PageHeaderSkeleton />
            <div className="mb-6 flex gap-6 overflow-hidden border-b border-border pb-3">
                {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-5 w-28 shrink-0" />
                ))}
            </div>
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex flex-col gap-6 lg:col-span-2">
                    <Skeleton className="h-72 rounded-xl" />
                    <Skeleton className="h-56 rounded-xl" />
                </div>
                <div className="flex flex-col gap-6">
                    <Skeleton className="h-52 rounded-xl" />
                    <Skeleton className="h-64 rounded-xl" />
                </div>
            </div>
        </LoadingRegion>
    );
}
