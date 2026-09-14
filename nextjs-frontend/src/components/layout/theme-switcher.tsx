"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useId, useSyncExternalStore, useTransition } from "react";

import { setThemePreference } from "@/lib/actions/auth";
import { parseTheme, type ThemePreference } from "@/lib/auth/constants";
import { cn } from "@/lib/utils";

export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
];

function subscribeToTheme(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
}

/**
 * The theme applied to the page and a setter that applies a new one instantly, then persists it in a
 * cookie. Every control reading this stays in sync, wherever the theme was changed.
 */
export function useThemePreference(initial: ThemePreference): [ThemePreference, (value: ThemePreference) => void] {
    const theme = useSyncExternalStore(
        subscribeToTheme,
        () => parseTheme(document.documentElement.getAttribute("data-theme") ?? undefined),
        () => initial,
    );
    const [, startTransition] = useTransition();

    const choose = (value: ThemePreference) => {
        document.documentElement.setAttribute("data-theme", value);
        const data = new FormData();
        data.set("theme", value);
        startTransition(() => setThemePreference(data));
    };

    return [theme, choose];
}

/** Segmented theme control built from native radios: one tab stop, arrow keys change the theme. */
export function ThemeSwitcher({ initial, className }: { initial: ThemePreference; className?: string }) {
    const [theme, choose] = useThemePreference(initial);
    const name = useId();

    return (
        <fieldset className={cn("grid grid-cols-3 gap-1 rounded-lg bg-surface-muted p-1", className)}>
            <legend className="sr-only">Theme</legend>
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                const selected = theme === value;
                return (
                    <label
                        key={value}
                        className={cn(
                            "flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors",
                            "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                            selected ? "bg-surface text-fg shadow-card ring-1 ring-border" : "text-fg-muted hover:text-fg",
                        )}
                    >
                        <input type="radio" name={name} value={value} checked={selected} onChange={() => choose(value)} className="sr-only" />
                        <Icon aria-hidden className="size-3.5" />
                        {label}
                    </label>
                );
            })}
        </fieldset>
    );
}
