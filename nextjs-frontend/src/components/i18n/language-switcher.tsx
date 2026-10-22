"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";

import { setLocalePreference } from "@/lib/actions/locale";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "./locale-provider";

/** VI / EN control built from native radios, like the theme switch: saves the cookie, then re-renders the page. */
export function LanguageSwitcher({ className }: { className?: string }) {
    const locale = useLocale();
    const t = useT();
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const name = useId();

    const choose = (value: Locale) => {
        const data = new FormData();
        data.set("locale", value);
        startTransition(async () => {
            await setLocalePreference(data);
            router.refresh();
        });
    };

    return (
        <fieldset aria-busy={pending || undefined} className={cn("grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-1", className)}>
            <legend className="sr-only">{t("shell.language")}</legend>
            {LOCALES.map((value) => {
                const selected = locale === value;
                return (
                    <label
                        key={value}
                        lang={value}
                        className={cn(
                            "flex h-8 cursor-pointer items-center justify-center rounded-md text-[13px] font-medium transition-colors",
                            "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                            selected ? "bg-surface text-fg shadow-card ring-1 ring-border" : "text-fg-muted hover:text-fg",
                        )}
                    >
                        <input type="radio" name={name} value={value} checked={selected} disabled={pending} onChange={() => choose(value)} className="sr-only" />
                        {LOCALE_NAMES[value]}
                    </label>
                );
            })}
        </fieldset>
    );
}
