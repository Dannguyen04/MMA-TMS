import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading system settings">
            <PageHeaderSkeleton />
            <Skeleton className="h-[48rem] rounded-xl" />
        </LoadingRegion>
    );
}
