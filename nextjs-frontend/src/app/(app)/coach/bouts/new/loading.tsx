import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function NewBoutLoading() {
    return (
        <LoadingRegion label="Loading the bout form">
            <PageHeaderSkeleton back eyebrow />
            <div className="flex flex-col gap-6">
                <Skeleton className="h-56 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
            </div>
        </LoadingRegion>
    );
}
