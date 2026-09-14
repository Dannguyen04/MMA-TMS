import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading invitation form">
            <PageHeaderSkeleton back />
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <Skeleton className="h-[34rem] rounded-xl lg:col-span-2" />
                <div className="flex flex-col gap-6">
                    <Skeleton className="h-72 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                </div>
            </div>
        </LoadingRegion>
    );
}
