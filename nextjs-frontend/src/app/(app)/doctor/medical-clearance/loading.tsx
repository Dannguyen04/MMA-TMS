import { LoadingRegion, PageHeaderSkeleton, Skeleton, TableCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading Medical Clearance">
            <PageHeaderSkeleton actions={1} />
            <div className="flex flex-col gap-4">
                <Skeleton className="h-11 w-[40rem] max-w-full rounded-xl" />
                <TableCardSkeleton rows={8} />
            </div>
        </LoadingRegion>
    );
}
