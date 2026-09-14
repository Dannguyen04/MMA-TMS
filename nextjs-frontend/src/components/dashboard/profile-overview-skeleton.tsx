import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

/** Matches `FighterProfileHeader` on pages that render it themselves: back link, octagon avatar, title and actions. */
export function FighterProfileHeaderSkeleton({ actions = 2, meta = false }: { actions?: number; meta?: boolean }) {
    return (
        <div className="mb-6 flex flex-col gap-4">
            <Skeleton className="h-6 w-24" />
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                    <Skeleton className="octagon size-14 shrink-0 rounded-none sm:size-20" />
                    <div className="min-w-0 flex-1">
                        <Skeleton className="mb-2 h-3 w-24" />
                        <Skeleton className="h-8 w-64 max-w-full" />
                        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
                        <Skeleton className="mt-3 h-6 w-56 max-w-full" />
                        {meta && <Skeleton className="mt-2.5 h-4 w-96 max-w-full" />}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {Array.from({ length: actions }, (_, i) => (
                        <Skeleton key={i} className="h-9 w-36 rounded-lg" />
                    ))}
                </div>
            </div>
        </div>
    );
}

/** Placeholder for the fighter profile Overview tab (the profile layout already shows the header and tabs). */
export function ProfileOverviewSkeleton({ label = "Loading fighter overview" }: { label?: string }) {
    return (
        <LoadingRegion label={label} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-start-3 lg:row-start-1">
                <Skeleton className="h-72 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-56 rounded-xl" />
            </div>
            <div className="flex flex-col gap-6 lg:col-span-2 lg:col-start-1 lg:row-start-1">
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-60 rounded-xl" />
                <Skeleton className="h-72 rounded-xl" />
            </div>
        </LoadingRegion>
    );
}
