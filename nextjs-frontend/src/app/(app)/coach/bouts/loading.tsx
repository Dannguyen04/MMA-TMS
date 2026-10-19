import { LoadingRegion, PageHeaderSkeleton, TableCardSkeleton } from "@/components/ui/skeleton";

export default function CoachBoutsLoading() {
    return (
        <LoadingRegion label="Loading bouts">
            <PageHeaderSkeleton actions={1} />
            <TableCardSkeleton rows={4} />
        </LoadingRegion>
    );
}
