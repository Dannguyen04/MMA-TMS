import { Card } from "@/components/ui/card";
import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("suspensions.loading")}>
            <div className="flex flex-col gap-6">
                <PageHeaderSkeleton actions={1} />
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-20 rounded-xl" />
                    <Skeleton className="h-8 w-28 rounded-xl" />
                    <Skeleton className="h-8 w-32 rounded-xl" />
                    <Skeleton className="h-8 w-28 rounded-xl" />
                </div>
                <Card className="divide-y divide-border overflow-hidden">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <Skeleton className="size-10 shrink-0 rounded-lg" />
                                <div className="flex flex-col gap-1.5 min-w-0">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-48" />
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-5 w-24 hidden sm:block" />
                                <Skeleton className="h-6 w-20 rounded-full" />
                            </div>
                        </div>
                    ))}
                </Card>
            </div>
        </LoadingRegion>
    );
}
