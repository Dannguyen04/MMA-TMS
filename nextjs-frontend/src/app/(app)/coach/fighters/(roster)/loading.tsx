import { CardGridSkeleton, FilterRowSkeleton, LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function CoachFightersLoading() {
    return (
        <LoadingRegion label="Loading your roster">
            <PageHeaderSkeleton actions={2} />
            <div className="flex flex-col gap-4">
                <FilterRowSkeleton selects={4} />
                <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-9 w-40 rounded-lg" />
                </div>
                <CardGridSkeleton columns={3} count={6} height="h-[19.5rem]" />
            </div>
        </LoadingRegion>
    );
}
