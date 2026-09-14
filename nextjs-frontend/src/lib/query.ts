/** Helpers for URL-driven lists: filtering, sorting and pagination via searchParams. */

export type SearchParams = Record<string, string | string[] | undefined>;

export type SortDirection = "asc" | "desc";

/** Builds a URL from the current params with some keys changed. `null` removes a key. */
export function hrefWith(pathname: string, current: SearchParams, updates: Record<string, string | number | null | undefined>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(current)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
        else params.set(key, value);
    }
    for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") params.delete(key);
        else params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
}

export interface Page<T> {
    items: T[];
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
}

export function paginate<T>(items: T[], page: number | string | undefined, pageSize = 10): Page<T> {
    const total = items.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const requested = Number(page) || 1;
    const current = Math.min(Math.max(1, Math.floor(requested)), pageCount);
    const start = (current - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), page: current, pageSize, pageCount, total };
}

type SortValue = string | number | boolean | null | undefined;

export function sortItems<T>(items: T[], accessor: (item: T) => SortValue, direction: SortDirection = "asc"): T[] {
    const factor = direction === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
        const av = accessor(a);
        const bv = accessor(b);
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
        return String(av).localeCompare(String(bv), "en", { numeric: true }) * factor;
    });
}

export function parseSortDirection(value: string | undefined, fallback: SortDirection = "asc"): SortDirection {
    return value === "asc" || value === "desc" ? value : fallback;
}

/** Narrows a query value to one of the allowed options. */
export function parseEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
    return allowed.includes(value as T) ? (value as T) : undefined;
}

export function matchesSearch(query: string | undefined, ...fields: (string | null | undefined)[]): boolean {
    const q = query?.trim().toLowerCase();
    if (!q) return true;
    return fields.some((field) => field?.toLowerCase().includes(q));
}
