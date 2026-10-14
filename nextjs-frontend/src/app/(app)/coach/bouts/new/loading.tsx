import { Card } from "@/components/ui/card";
import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <LoadingRegion label="Loading new bout form">
            <PageHeaderSkeleton back />
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <Card className="p-6 lg:col-span-2">
                    <div className="flex flex-col gap-6">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </Card>
            </div>
        </LoadingRegion>
    );
}
