import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading AI movement observations">
            <PageHeaderSkeleton />
            <div className="flex flex-col gap-5">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-11 w-[39rem] max-w-full rounded-xl" />
                <div className="flex flex-col gap-4">
                    {Array.from({ length: 3 }, (_, i) => (
                        <Skeleton key={i} className="h-60 rounded-xl" />
                    ))}
                </div>
            </div>
        </LoadingRegion>
    );
}
