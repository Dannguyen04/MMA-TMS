import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

import { formatNumber } from "@/lib/format";
import { hrefWith, type SearchParams, type SortDirection } from "@/lib/query";
import { cn } from "@/lib/utils";

/** Scroll container + table. Wide tables scroll horizontally inside the card, never the page. */
export function Table({ className, caption, children, ...props }: ComponentProps<"table"> & { caption?: string }) {
    return (
        <div className="scrollbar-thin w-full overflow-x-auto">
            <table className={cn("w-full border-collapse text-left text-sm", className)} {...props}>
                {caption && <caption className="sr-only">{caption}</caption>}
                {children}
            </table>
        </div>
    );
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
    return <thead className={cn("border-b border-border bg-surface-muted/60", className)} {...props} />;
}

export function TBody({ className, ...props }: ComponentProps<"tbody">) {
    return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
    return <tr className={cn("transition-colors hover:bg-surface-muted/50", className)} {...props} />;
}

export function TH({ className, ...props }: ComponentProps<"th">) {
    return (
        <th
            scope="col"
            className={cn("h-10 px-4 text-xs font-semibold tracking-wide whitespace-nowrap text-fg-muted first:pl-5 last:pr-5", className)}
            {...props}
        />
    );
}

export function TD({ className, ...props }: ComponentProps<"td">) {
    return <td className={cn("px-4 py-3 align-middle text-fg first:pl-5 last:pr-5 tabular-nums", className)} {...props} />;
}

export interface SortableTHProps {
    label: string;
    sortKey: string;
    pathname: string;
    searchParams: SearchParams;
    activeSort?: string;
    direction?: SortDirection;
    className?: string;
    align?: "left" | "right";
}

/** Column header that toggles ?sort=&dir= and exposes aria-sort. */
export function SortableTH({ label, sortKey, pathname, searchParams, activeSort, direction = "asc", className, align = "left" }: SortableTHProps) {
    const isActive = activeSort === sortKey;
    const nextDir: SortDirection = isActive && direction === "asc" ? "desc" : "asc";
    const Icon = !isActive ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
    return (
        <TH aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"} className={className}>
            <Link
                href={hrefWith(pathname, searchParams, { sort: sortKey, dir: nextDir, page: null })}
                scroll={false}
                className={cn(
                    "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-fg",
                    align === "right" && "flex-row-reverse",
                    isActive && "text-fg",
                )}
            >
                {label}
                <Icon aria-hidden className={cn("size-3.5", !isActive && "opacity-50")} />
            </Link>
        </TH>
    );
}

export interface PaginationProps {
    page: number;
    pageCount: number;
    total: number;
    pageSize: number;
    pathname: string;
    searchParams: SearchParams;
    itemLabel?: string;
}

export function Pagination({ page, pageCount, total, pageSize, pathname, searchParams, itemLabel = "results" }: PaginationProps) {
    if (total === 0) return null;
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    const linkClass =
        "inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-[13px] font-medium text-fg shadow-card hover:bg-surface-hover";
    const disabledClass = "pointer-events-none opacity-40";

    return (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
            <p role="status" aria-live="polite" aria-atomic="true" className="text-[13px] text-fg-muted">
                <span className="font-medium text-fg">
                    {formatNumber(from)}–{formatNumber(to)}
                </span>{" "}
                of {formatNumber(total)} {itemLabel}
            </p>
            {pageCount > 1 && (
                <div className="flex items-center gap-2">
                    <Link
                        href={hrefWith(pathname, searchParams, { page: page - 1 })}
                        aria-disabled={page <= 1}
                        tabIndex={page <= 1 ? -1 : undefined}
                        className={cn(linkClass, page <= 1 && disabledClass)}
                        scroll={false}
                    >
                        <ChevronLeft aria-hidden className="size-4" />
                        <span className="max-sm:sr-only">Previous</span>
                    </Link>
                    <span className="text-[13px] text-fg-muted tabular-nums">
                        {page} / {pageCount}
                    </span>
                    <Link
                        href={hrefWith(pathname, searchParams, { page: page + 1 })}
                        aria-disabled={page >= pageCount}
                        tabIndex={page >= pageCount ? -1 : undefined}
                        className={cn(linkClass, page >= pageCount && disabledClass)}
                        scroll={false}
                    >
                        <span className="max-sm:sr-only">Next</span>
                        <ChevronRight aria-hidden className="size-4" />
                    </Link>
                </div>
            )}
        </nav>
    );
}
