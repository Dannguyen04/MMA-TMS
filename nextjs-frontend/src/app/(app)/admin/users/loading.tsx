import { FilterRowSkeleton, LoadingRegion, PageHeaderSkeleton, TableCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading users">
            <PageHeaderSkeleton actions={1} />
            <div className="flex flex-col gap-4">
                <FilterRowSkeleton selects={2} />
                <TableCardSkeleton rows={10} withHeader />
            </div>
        </LoadingRegion>
    );
}
