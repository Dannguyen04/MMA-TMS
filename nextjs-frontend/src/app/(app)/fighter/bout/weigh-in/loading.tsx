import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function WeighInLoading() {
    return (
        <LoadingRegion label="Loading weigh-in">
            <PageHeaderSkeleton />
            <div className="flex max-w-lg flex-col gap-4">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
            </div>
        </LoadingRegion>
    );
}
