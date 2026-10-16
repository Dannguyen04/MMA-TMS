import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function CoachBoutLoading() {
    return (
        <LoadingRegion label="Loading bout">
            <PageHeaderSkeleton />
            <div className="flex flex-col gap-4">
                <Skeleton className="h-80 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        </LoadingRegion>
    );
}