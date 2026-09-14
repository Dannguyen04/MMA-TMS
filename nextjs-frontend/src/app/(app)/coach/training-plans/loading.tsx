import { CardGridSkeleton, FilterRowSkeleton, LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading training plans">
            <PageHeaderSkeleton actions={1} />
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <FilterRowSkeleton selects={2} />
                    <Skeleton className="h-9 w-40 rounded-lg" />
                </div>
                <CardGridSkeleton columns={3} count={6} height="h-64" />
            </div>
        </LoadingRegion>
    );
}
