import { FilterRowSkeleton, LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

function VideoCardGrid({ count }: { count: number }) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
                    <Skeleton className="aspect-video w-full rounded-none" />
                    <div className="space-y-2.5 p-4">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-5 w-32" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Library page placeholder: header, filters and a grid of video cards. */
export function VideoLibrarySkeleton({ label = "Loading videos", withQueue = false, withHeader = true }: { label?: string; withQueue?: boolean; withHeader?: boolean }) {
    return (
        <LoadingRegion label={label}>
            {withHeader && <PageHeaderSkeleton actions={1} />}
            {withQueue && <Skeleton className="mb-8 h-56 rounded-xl" />}
            <div className="flex flex-col gap-4">
                <FilterRowSkeleton />
                <VideoCardGrid count={8} />
            </div>
        </LoadingRegion>
    );
}

/** Analysis workspace placeholder: summary, player + timeline, side panels. */
export function VideoWorkspaceSkeleton() {
    return (
        <LoadingRegion label="Loading analysis">
            <PageHeaderSkeleton back eyebrow actions={1} />
            <Skeleton className="mb-6 h-24 rounded-xl" />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
                <div className="min-w-0 space-y-6">
                    <Skeleton className="aspect-video w-full rounded-xl" />
                    <Skeleton className="h-72 rounded-xl" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-80 rounded-xl" />
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            </div>
        </LoadingRegion>
    );
}

/** Upload wizard placeholder. */
export function UploadWizardSkeleton() {
    return (
        <LoadingRegion label="Loading upload">
            <PageHeaderSkeleton back />
            <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-border bg-surface">
                <Skeleton className="h-16 rounded-none" />
                <div className="space-y-4 p-6">
                    <Skeleton className="h-6 w-56" />
                    <Skeleton className="h-4 w-80 max-w-full" />
                    <Skeleton className="h-56 rounded-xl" />
                </div>
            </div>
        </LoadingRegion>
    );
}
