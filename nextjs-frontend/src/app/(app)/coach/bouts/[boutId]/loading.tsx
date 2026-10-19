import { Card } from "@/components/ui/card";
import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading bout details">
            <PageHeaderSkeleton back actions={2} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="flex flex-col gap-6 lg:col-span-2">
                    <Card className="p-6">
                        <Skeleton className="mb-4 h-6 w-48" />
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    </Card>
                    <Card className="p-6">
                        <Skeleton className="mb-4 h-6 w-48" />
                        <div className="flex flex-col gap-3">
                            <Skeleton className="h-14 w-full" />
                            <Skeleton className="h-14 w-full" />
                            <Skeleton className="h-14 w-full" />
                        </div>
                    </Card>
                </div>
                <div className="flex flex-col gap-6">
                    <Card className="p-6">
                        <Skeleton className="mb-4 h-6 w-40" />
                        <Skeleton className="mb-2 h-4 w-full" />
                        <Skeleton className="mb-2 h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </Card>
                    <Card className="p-6">
                        <Skeleton className="mb-4 h-6 w-32" />
                        <Skeleton className="h-24 w-full" />
                    </Card>
                </div>
            </div>
        </LoadingRegion>
    );
}
