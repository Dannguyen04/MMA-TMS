"use client";

import { Check } from "lucide-react";
import { useId } from "react";

import { THEME_OPTIONS, useThemePreference } from "@/components/layout/theme-switcher";
import type { ThemePreference } from "@/lib/auth/constants";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "./use-media-query";

/**
 * Theme choice as preview cards. Each card is a native radio (one tab stop, arrow keys switch), and
 * the selection follows the theme applied to the page, so changes made from the account menu show here too.
 */
export function AppearanceSettings({ initial }: { initial: ThemePreference }) {
    const [theme, choose] = useThemePreference(initial);
    const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
    const name = useId();

    return (
        <div className="flex max-w-xl flex-col gap-4">
            <fieldset className="grid grid-cols-3 gap-3">
                <legend className="sr-only">Theme</legend>
                {THEME_OPTIONS.map((option) => {
                    const active = theme === option.value;
                    return (
                        <label key={option.value} className="group min-w-0 cursor-pointer">
                            <input
                                type="radio"
                                name={name}
                                value={option.value}
                                checked={active}
                                onChange={() => choose(option.value)}
                                className="sr-only"
                            />
                            <span
                                aria-hidden
                                className={cn(
                                    "relative block aspect-[4/3] overflow-hidden rounded-lg transition-shadow",
                                    "group-has-focus-visible:outline-2 group-has-focus-visible:outline-offset-4 group-has-focus-visible:outline-ring",
                                    active ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : "ring-1 ring-border group-hover:ring-border-strong",
                                )}
                            >
                                {option.value === "system" ? (
                                    <>
                                        <ThemeMock variant="light" />
                                        <ThemeMock variant="dark" className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
                                    </>
                                ) : (
                                    <ThemeMock variant={option.value} />
                                )}
                            </span>
                            <span className={cn("mt-2 flex items-center justify-center gap-1 text-[13px]", active ? "font-medium text-fg" : "text-fg-muted")}>
                                {active && <Check aria-hidden className="size-3.5 text-primary-soft-fg" />}
                                {option.label}
                            </span>
                        </label>
                    );
                })}
            </fieldset>
            <p className="text-[13px] text-fg-muted" aria-live="polite">
                {theme === "system"
                    ? `Following your device${systemDark === null ? "" : ` — currently ${systemDark ? "dark" : "light"}`}.`
                    : `Always ${theme}, whatever your device uses.`}{" "}
                Applies instantly and is remembered on this browser.
            </p>
        </div>
    );
}

/**
 * Miniature app screen. Drawn with the navigation tokens, which keep the same values in every
 * theme, so a light preview still looks light while the page itself is dark (and vice versa).
 */
function ThemeMock({ variant, className }: { variant: "light" | "dark"; className?: string }) {
    const light = variant === "light";
    const card = light ? "bg-nav-fg-active ring-nav-fg/50" : "bg-nav-surface ring-nav-border";
    const line = light ? "bg-nav-bg/35" : "bg-nav-fg/35";

    return (
        <span className={cn("flex size-full", light ? "bg-nav-fg/20" : "bg-nav-bg", className)}>
            <span className={cn("flex w-1/4 flex-col gap-1 bg-nav-bg p-1.5", !light && "border-r border-nav-border")}>
                <span className="h-1.5 w-3/4 rounded-full bg-nav-accent" />
                <span className="mt-1 h-1 w-full rounded-full bg-nav-fg/50" />
                <span className="h-1 w-5/6 rounded-full bg-nav-fg/25" />
                <span className="h-1 w-2/3 rounded-full bg-nav-fg/25" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
                <span className={cn("h-1.5 w-1/2 rounded-full", light ? "bg-nav-bg/70" : "bg-nav-fg-active/80")} />
                <span className="grid grid-cols-2 gap-1.5">
                    {[0, 1].map((index) => (
                        <span key={index} className={cn("flex flex-col gap-1 rounded-[4px] p-1 ring-1", card)}>
                            <span className={cn("h-1 w-2/3 rounded-full", line)} />
                            <span className={cn("h-1.5 w-1/2 rounded-full", index === 0 ? "bg-nav-accent" : line)} />
                        </span>
                    ))}
                </span>
                <span className={cn("flex flex-1 flex-col gap-1 rounded-[4px] p-1 ring-1", card)}>
                    <span className={cn("h-1 w-3/4 rounded-full", line)} />
                    <span className={cn("h-1 w-1/2 rounded-full", line)} />
                </span>
            </span>
        </span>
    );
}
