import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function FighterGoalsLoading() {
    return (
        <LoadingRegion label="Loading goals">
            <PageHeaderSkeleton meta actions={1} />
            <div className="flex flex-col gap-3">
                <Skeleton className="h-6 w-64 max-w-full" />
                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} className="h-[19rem] rounded-xl" />
                    ))}
                </div>
            </div>
        </LoadingRegion>
    );
}
