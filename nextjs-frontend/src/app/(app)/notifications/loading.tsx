import { LoadingRegion, PageHeaderSkeleton, Skeleton, TableCardSkeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
    return (
        <LoadingRegion label="Loading notifications">
            <PageHeaderSkeleton meta actions={2} />
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-11 w-44 rounded-xl" />
                    <Skeleton className="h-8 w-[36rem] max-w-full rounded-full" />
                </div>
                <TableCardSkeleton rows={8} />
            </div>
        </LoadingRegion>
    );
}
