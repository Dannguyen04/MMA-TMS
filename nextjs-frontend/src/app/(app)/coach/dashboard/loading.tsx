import { LoadingRegion, PageHeaderSkeleton, Skeleton, WeekAgendaSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function CoachDashboardLoading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("coachToday.loading")}>
            <PageHeaderSkeleton eyebrow actions={2} />
            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-px lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <Skeleton className="h-64 rounded-none" />
                    <Skeleton className="h-64 rounded-none" />
                </div>
                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
                                <Skeleton className="h-5 w-44" />
                                <Skeleton className="h-8 w-24 rounded-md" />
                            </div>
                            {Array.from({ length: 3 }, (_, i) => (
                                <div key={i} className="space-y-2 border-t border-border px-5 py-3">
                                    <Skeleton className="h-4 w-36" />
                                    <Skeleton className="h-3 w-2/3" />
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                            <div className="space-y-2 px-5 pt-4 pb-3">
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-4 w-56" />
                            </div>
                            <div className="border-t border-border px-5 py-3">
                                <Skeleton className="h-10 w-full max-w-md rounded-xl" />
                            </div>
                            {Array.from({ length: 5 }, (_, i) => (
                                <div key={i} className="flex items-center gap-3 border-t border-border px-5 py-3.5">
                                    <Skeleton className="size-9 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-3 w-24" />
                                        <Skeleton className="h-4 w-3/4" />
                                    </div>
                                    <Skeleton className="h-8 w-28 rounded-lg max-sm:hidden" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                </div>
                <WeekAgendaSkeleton />
            </div>
        </LoadingRegion>
    );
}
