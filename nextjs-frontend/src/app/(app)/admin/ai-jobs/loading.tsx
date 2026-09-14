import { FilterRowSkeleton, LoadingRegion, PageHeaderSkeleton, Skeleton, TableCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading AI jobs">
            <PageHeaderSkeleton actions={1} />
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <Skeleton className="h-11 w-[42rem] max-w-full rounded-xl" />
                    <FilterRowSkeleton selects={0} />
                </div>
                <TableCardSkeleton rows={10} withHeader />
            </div>
        </LoadingRegion>
    );
}
