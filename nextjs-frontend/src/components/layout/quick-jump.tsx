"use client";

import { CornerDownLeft, FileText, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Dialog } from "@/components/ui/dialog";
import { quickJumpFighters, type QuickJumpPerson } from "@/lib/actions/quick-jump";
import { matchItems } from "@/lib/domain/quick-jump";
import type { Role } from "@/lib/domain/types";
import { navLabel } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { NAVIGATION } from "./navigation";

interface JumpItem {
    key: string;
    label: string;
    href: string;
    hint: string | null;
    kind: "page" | "person";
}

/**
 * Ctrl+K (⌘K on a Mac) or the header button: type part of a page or a fighter's name, then Enter. Opening is
 * instant (a keyboard action is never animated); fighters load the first time it opens.
 */
export function QuickJump({ role }: { role: Role }) {
    const t = useT();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const [people, setPeople] = useState<QuickJumpPerson[] | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const listId = useId();

    const pages = useMemo<JumpItem[]>(() => {
        const seen = new Set<string>();
        return NAVIGATION[role]
            .flatMap((section) => section.items)
            .flatMap((item) => [
                { label: navLabel(t, item.label), href: item.href, hint: null as string | null },
                ...(item.tabs ?? []).map((tab) => ({ label: navLabel(t, tab.label), href: tab.href, hint: navLabel(t, item.label) })),
            ])
            .filter((item) => !seen.has(item.href) && seen.add(item.href))
            .map((item) => ({ ...item, key: `page:${item.href}`, kind: "page" as const }));
    }, [role, t]);

    const results = useMemo(() => {
        const persons: JumpItem[] = (people ?? []).map((person) => ({ key: `person:${person.href}`, label: person.name, href: person.href, hint: person.hint, kind: "person" }));
        return [...matchItems(pages, query, 8), ...matchItems(persons, query, 8)];
    }, [pages, people, query]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setOpen((current) => !current);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
        if (!open || people !== null || role === "fighter") return;
        let cancelled = false;
        quickJumpFighters().then(
            (list) => !cancelled && setPeople(list),
            () => !cancelled && setPeople([]),
        );
        return () => {
            cancelled = true;
        };
    }, [open, people, role]);

    const close = () => {
        setOpen(false);
        setQuery("");
        setActive(0);
    };
    const go = (item: JumpItem | undefined) => {
        if (!item) return;
        close();
        router.push(item.href);
    };
    const current = Math.min(active, Math.max(0, results.length - 1));

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg sm:border sm:border-border sm:bg-surface sm:pr-1.5"
                aria-keyshortcuts="Control+K Meta+K"
            >
                <Search aria-hidden className="size-[18px]" />
                <span className="max-sm:sr-only">{t("ux.jump.open")}</span>
                <kbd aria-hidden className="rounded border border-border bg-surface-muted px-1.5 font-mono text-[11px] leading-5 text-fg-subtle max-sm:hidden">
                    Ctrl K
                </kbd>
            </button>
            <Dialog open={open} onClose={close} title={t("ux.jump.title")} size="md" initialFocusRef={input} className="animate-none!">
                <input
                    ref={input}
                    type="text"
                    role="combobox"
                    aria-expanded
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={results[current] ? `${listId}-${current}` : undefined}
                    aria-label={t("ux.jump.inputLabel")}
                    placeholder={role === "fighter" ? t("ux.jump.placeholderPages") : t("ux.jump.placeholder")}
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActive(0);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setActive((current + 1) % Math.max(1, results.length));
                        } else if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setActive((current - 1 + results.length) % Math.max(1, results.length));
                        } else if (event.key === "Enter") {
                            event.preventDefault();
                            go(results[current]);
                        }
                    }}
                    className="h-11 w-full rounded-lg border border-control-border bg-surface px-3 text-[15px] text-fg placeholder:text-fg-subtle focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/40"
                />
                <ul id={listId} role="listbox" aria-label={t("ux.jump.results")} className="mt-3 flex max-h-[min(60vh,420px)] flex-col gap-0.5 overflow-y-auto">
                    {results.map((item, index) => {
                        const Icon = item.kind === "page" ? FileText : UserRound;
                        return (
                            <li
                                key={item.key}
                                id={`${listId}-${index}`}
                                role="option"
                                aria-selected={index === current}
                                onMouseMove={() => setActive(index)}
                                onClick={() => go(item)}
                                className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm", index === current ? "bg-primary-soft text-primary-soft-fg" : "text-fg")}
                            >
                                <Icon aria-hidden className="size-4 shrink-0 opacity-70" />
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                {item.hint && <span className="truncate text-xs text-fg-subtle">{item.hint}</span>}
                                {index === current && <CornerDownLeft aria-hidden className="size-3.5 shrink-0" />}
                            </li>
                        );
                    })}
                </ul>
                {results.length === 0 && <p className="px-3 py-6 text-center text-sm text-fg-muted">{t("ux.jump.empty", { query })}</p>}
                <p className="mt-3 text-xs text-fg-subtle">{t("ux.jump.help")}</p>
            </Dialog>
        </>
    );
}
