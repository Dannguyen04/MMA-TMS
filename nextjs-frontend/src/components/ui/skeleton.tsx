import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * Loading placeholders. Each building block mirrors the real component's box (PageHeader, CardHeader,
 * the KPI grid, FilterBar), so the page doesn't jump when content streams in.
 */

export function Skeleton({ className }: { className?: string }) {
    return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-hover", className)} />;
}

/** Announces a loading state once and marks the region busy until the real content replaces it. */
export function LoadingRegion({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
    return (
        <div role="status" aria-live="polite" aria-busy="true" className={className}>
            <span className="sr-only">{label}</span>
            {children}
        </div>
    );
}

export interface PageHeaderSkeletonProps {
    /** Small label above the title (detail and create pages). */
    eyebrow?: boolean;
    /** Back link above the header (detail and create pages). */
    back?: boolean;
    /** Extra row under the description (badges, key facts). */
    meta?: boolean;
    /** Number of action buttons on the right. */
    actions?: number;
}

/** Matches `PageHeader`: optional back link and eyebrow, title, description, meta row and actions. */
export function PageHeaderSkeleton({ eyebrow = false, back = false, meta = false, actions = 0 }: PageHeaderSkeletonProps) {
    return (
        <div className="mb-6 flex flex-col gap-4 sm:mb-8">
            {back && <Skeleton className="h-6 w-24" />}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0 flex-1">
                    {eyebrow && <Skeleton className="mb-2.5 h-3 w-24" />}
                    <Skeleton className="h-8 w-72 max-w-full" />
                    <Skeleton className="mt-2.5 h-4 w-[28rem] max-w-full" />
                    {meta && <Skeleton className="mt-3.5 h-5 w-80 max-w-full" />}
                </div>
                {actions > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {Array.from({ length: actions }, (_, i) => (
                            <Skeleton key={i} className="h-9 w-32 rounded-lg" />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/** Heading and description of a section inside a page (tabs, grouped lists). */
export function SectionHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
    return (
        <div className="flex items-end justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            {withAction && <Skeleton className="h-9 w-36 shrink-0 rounded-lg" />}
        </div>
    );
}

/** Row of `StatCard`s in the shared KPI grid. */
export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: count }, (_, i) => (
                <Skeleton key={i} className="h-[112px] rounded-xl" />
            ))}
        </div>
    );
}

/** Matches `FilterBar`: an optional search field followed by `selects` dropdowns. */
export function FilterRowSkeleton({ search = true, selects = 2 }: { search?: boolean; selects?: number }) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            {search && <Skeleton className="h-9 w-full rounded-lg sm:w-72" />}
            {Array.from({ length: selects }, (_, i) => (
                <Skeleton key={i} className="h-9 w-[calc(50%-0.375rem)] rounded-lg sm:w-40" />
            ))}
        </div>
    );
}

const GRID_COLUMNS = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
} as const;

export interface CardGridSkeletonProps {
    columns?: keyof typeof GRID_COLUMNS;
    count?: number;
    /** Height class of each card, e.g. "h-56". */
    height?: string;
}

/** Grid of equal cards (roster, plan and goal cards). */
export function CardGridSkeleton({ columns = 3, count = 6, height = "h-56" }: CardGridSkeletonProps) {
    return (
        <div className={cn("grid gap-4", GRID_COLUMNS[columns])}>
            {Array.from({ length: count }, (_, i) => (
                <Skeleton key={i} className={cn("rounded-xl", height)} />
            ))}
        </div>
    );
}

/** Matches `WeekAgenda` inside its card: header with week navigation, then seven day columns. */
export function WeekAgendaSkeleton() {
    return (
        <div className="rounded-xl border border-border bg-surface shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
                <div className="flex items-start gap-3">
                    <Skeleton className="size-8 rounded-lg" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-44" />
                        <Skeleton className="h-4 w-56" />
                    </div>
                </div>
                <Skeleton className="h-8 w-40 rounded-lg" />
            </div>
            <div className="grid gap-2 px-5 pb-5 lg:grid-cols-7 lg:gap-2.5">
                {Array.from({ length: 7 }, (_, i) => (
                    <Skeleton key={i} className="h-20 rounded-lg lg:h-56" />
                ))}
            </div>
        </div>
    );
}

/** Table card: optional card header, the column header row and body rows with an avatar, text and a badge. */
export function TableCardSkeleton({ rows, withHeader = false }: { rows: number; withHeader?: boolean }) {
    return (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {withHeader && (
                <div className="flex items-start gap-3 px-5 pt-4 pb-3">
                    <Skeleton className="size-8 rounded-lg" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-56 max-w-full" />
                    </div>
                </div>
            )}
            <Skeleton className="h-11 rounded-none" />
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-4 border-t border-border px-4 py-3.5">
                    <Skeleton className="size-9 rounded-full" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/6" />
                    <Skeleton className="ml-auto h-5 w-20" />
                </div>
            ))}
        </div>
    );
}

/** Dashboard placeholder: header, KPI row and two content columns. Role dashboards show the date as an eyebrow. */
export function DashboardSkeleton({ label = "Loading dashboard", eyebrow = false }: { label?: string; eyebrow?: boolean }) {
    return (
        <LoadingRegion label={label}>
            <PageHeaderSkeleton eyebrow={eyebrow} />
            <KpiRowSkeleton />
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Skeleton className="h-80 rounded-xl lg:col-span-2" />
                <Skeleton className="h-80 rounded-xl" />
            </div>
        </LoadingRegion>
    );
}

/** List/table placeholder: header, filter row and rows. */
export function TableSkeleton({ label = "Loading", rows = 8 }: { label?: string; rows?: number }) {
    return (
        <LoadingRegion label={label}>
            <PageHeaderSkeleton />
            <div className="flex flex-col gap-4">
                <FilterRowSkeleton />
                <TableCardSkeleton rows={rows} />
            </div>
        </LoadingRegion>
    );
}

/** Detail page placeholder: back link, eyebrow and title, main column and side column. */
export function DetailSkeleton({ label = "Loading" }: { label?: string }) {
    return (
        <LoadingRegion label={label}>
            <PageHeaderSkeleton back eyebrow />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Skeleton className="h-64 rounded-xl" />
                    <Skeleton className="h-48 rounded-xl" />
                </div>
                <div className="space-y-6">
                    <Skeleton className="h-40 rounded-xl" />
                    <Skeleton className="h-56 rounded-xl" />
                </div>
            </div>
        </LoadingRegion>
    );
}
