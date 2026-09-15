"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input, Select } from "./form";
import { Spinner } from "./spinner";

export type FilterDefinition =
    | { type: "search"; name: string; label: string; placeholder?: string }
    | { type: "select"; name: string; label: string; options: { value: string; label: string }[]; allLabel?: string }
    | { type: "date"; name: string; label: string };

export interface FilterBarProps {
    filters: FilterDefinition[];
    /** Accessible name of the search landmark; give each bar a distinct one when a page has several. */
    label?: string;
    className?: string;
}

/**
 * URL-driven filter row. Writes filters to searchParams so lists are server-rendered,
 * shareable and survive reloads. Changing any filter resets pagination.
 */
export function FilterBar({ filters, label, className }: FilterBarProps) {
    const router = useRouter();
    const rootRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, startTransition] = useTransition();
    const baseId = useId();

    const searchFilter = filters.find((f) => f.type === "search");
    const urlSearch = searchFilter ? (searchParams.get(searchFilter.name) ?? "") : "";
    const [searchText, setSearchText] = useState(urlSearch);
    const [syncedSearch, setSyncedSearch] = useState(urlSearch);

    // Keep the input in sync with back/forward navigation without an effect.
    if (urlSearch !== syncedSearch) {
        setSyncedSearch(urlSearch);
        setSearchText(urlSearch);
    }

    const update = (name: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) params.set(name, value);
        else params.delete(name);
        params.delete("page");
        const qs = params.toString();
        startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    };

    useEffect(() => {
        if (!searchFilter || searchText === urlSearch) return;
        const timer = window.setTimeout(() => update(searchFilter.name, searchText.trim()), 300);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce only on text changes
    }, [searchText]);

    const activeCount = filters.filter((f) => searchParams.get(f.name)).length;

    const clearAll = () => {
        // The Clear button disappears once nothing is filtered, so focus the first control first.
        rootRef.current?.querySelector<HTMLElement>("input, select")?.focus();
        const params = new URLSearchParams(searchParams.toString());
        filters.forEach((f) => params.delete(f.name));
        params.delete("page");
        setSearchText("");
        const qs = params.toString();
        startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    };

    return (
        <div ref={rootRef} role="search" aria-label={label} className={cn("flex flex-wrap items-center gap-3", className)}>
            {filters.map((filter) => {
                const id = `${baseId}-${filter.name}`;
                if (filter.type === "search") {
                    return (
                        <div key={filter.name} className="relative w-full sm:w-72">
                            <label htmlFor={id} className="sr-only">
                                {filter.label}
                            </label>
                            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
                            <Input
                                id={id}
                                type="search"
                                value={searchText}
                                onChange={(event) => setSearchText(event.target.value)}
                                placeholder={filter.placeholder ?? filter.label}
                                className="pl-9"
                                autoComplete="off"
                            />
                        </div>
                    );
                }
                if (filter.type === "select") {
                    return (
                        <div key={filter.name} className="w-[calc(50%-0.375rem)] sm:w-auto sm:min-w-40">
                            <label htmlFor={id} className="sr-only">
                                {filter.label}
                            </label>
                            <Select id={id} value={searchParams.get(filter.name) ?? ""} onChange={(event) => update(filter.name, event.target.value)}>
                                <option value="">{filter.allLabel ?? `All ${filter.label.toLowerCase()}`}</option>
                                {filter.options.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    );
                }
                return (
                    <DateFilter
                        key={filter.name}
                        id={id}
                        label={filter.label}
                        value={searchParams.get(filter.name) ?? ""}
                        onChange={(value) => update(filter.name, value)}
                    />
                );
            })}
            {activeCount > 0 && (
                <Button variant="ghost" size="md" onClick={clearAll}>
                    <X aria-hidden />
                    Clear filters
                </Button>
            )}
            <span aria-live="polite" className="contents">
                {pending && <Spinner className="text-fg-subtle" label="Updating results" />}
            </span>
        </div>
    );
}

/** Date input with its label drawn inside the control, so it lines up with the selects in the same row. */
function DateFilter({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
    const style = { "--date-label-width": `calc(${label.length}ch + 1.25rem)` } as CSSProperties;
    return (
        <div style={style} className="relative w-full sm:w-[calc(var(--date-label-width)+7.5rem)]">
            <label htmlFor={id} className="sr-only">
                {label}
            </label>
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-fg-subtle">
                {label}
            </span>
            <Input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} className="pl-(--date-label-width)" />
        </div>
    );
}
