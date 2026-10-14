import { LoadingRegion, PageHeaderSkeleton, TableCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading bouts">
            <PageHeaderSkeleton actions={1} />
            <TableCardSkeleton rows={4} columns={7} />
        </LoadingRegion>
    );
}
