import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("readiness.loading")}>
            <div className="flex flex-col gap-6">
                <PageHeaderSkeleton actions={0} />

                {/* Filter bar skeleton */}
                <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 flex flex-wrap gap-4">
                    <Skeleton className="h-9 w-56 rounded-lg" />
                    <Skeleton className="h-9 w-52 rounded-lg" />
                    <Skeleton className="h-9 w-44 rounded-lg" />
                    <Skeleton className="h-9 w-24 rounded-lg" />
                </div>

                {/* 3 columns skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {Array.from({ length: 3 }).map((_, colIndex) => (
                        <div key={colIndex} className="flex flex-col gap-3">
                            <div className="py-2.5 px-3 rounded-lg border border-border bg-surface flex items-center justify-between">
                                <Skeleton className="h-5 w-28" />
                                <Skeleton className="h-5 w-8 rounded-full" />
                            </div>
                            {Array.from({ length: 2 }).map((_, cardIndex) => (
                                <div
                                    key={cardIndex}
                                    className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="size-10 rounded-lg shrink-0" />
                                        <div className="flex flex-col gap-1.5 flex-1">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-5 w-full rounded" />
                                    <Skeleton className="h-3 w-40" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </LoadingRegion>
    );
}
