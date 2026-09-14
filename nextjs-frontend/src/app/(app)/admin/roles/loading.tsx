import { CardGridSkeleton, LoadingRegion, PageHeaderSkeleton, TableCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading roles and permissions">
            <PageHeaderSkeleton />
            <div className="flex flex-col gap-6">
                <CardGridSkeleton columns={4} count={4} height="h-40" />
                <TableCardSkeleton rows={12} />
            </div>
        </LoadingRegion>
    );
}
