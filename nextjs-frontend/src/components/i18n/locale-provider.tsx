"use client";

import { createContext, use, useContext, useMemo, type ReactNode } from "react";

import { createDemoCopy } from "@/lib/i18n/demo-copy";
import { DEFAULT_LOCALE, dictionaryScriptSrc, type Locale } from "@/lib/i18n/config";
import { createTranslatorFrom, registerDictionary, type Dictionary, type Translator } from "@/lib/i18n/translate-client";

const LocaleContext = createContext<{ locale: Locale; messages?: Dictionary }>({ locale: DEFAULT_LOCALE });

/** What `/i18n/<locale>.js` leaves on `self`: the language's dictionary and, for other languages, the English subset. */
interface DictionaryBundle {
    messages: Dictionary;
    english?: Dictionary;
}

declare global {
    var __MMA_I18N__: Partial<Record<Locale, DictionaryBundle>> | undefined;
}

const loading = new Map<string, Promise<DictionaryBundle>>();

/**
 * The language's dictionary in the browser: already there when the root layout's script has run, otherwise loaded
 * (once per version) by adding the same script. A language switch loads the new one the same way.
 */
function bundleFor(locale: Locale, version: string): DictionaryBundle | Promise<DictionaryBundle> {
    const ready = globalThis.__MMA_I18N__?.[locale];
    if (ready) return ready;
    const src = dictionaryScriptSrc(locale, version);
    let pending = loading.get(src);
    if (!pending) {
        pending = new Promise<DictionaryBundle>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = () => {
                const bundle = globalThis.__MMA_I18N__?.[locale];
                if (bundle) resolve(bundle);
                else reject(new Error(`Dictionary ${locale} did not load`));
            };
            script.onerror = () => {
                loading.delete(src);
                reject(new Error(`Dictionary ${locale} did not load`));
            };
            document.head.appendChild(script);
        });
        loading.set(src, pending);
    }
    return pending;
}

/**
 * Makes the viewer's language available to Client Components. The browser gets only that language's dictionary, as a
 * cached script (`/i18n/<locale>.js`), not inside every server render. Until it has run, rendering waits (React keeps
 * the server's HTML meanwhile), so nothing is ever shown untranslated. On the server the full dictionaries are loaded.
 */
export function LocaleProvider({ locale, version, children }: { locale: Locale; version: string; children: ReactNode }) {
    let messages: Dictionary | undefined;
    if (typeof window !== "undefined") {
        const found = bundleFor(locale, version);
        const bundle = found instanceof Promise ? use(found) : found;
        // Registered while rendering, before any child translates: shared modules call `createTranslator(locale)`.
        registerDictionary(locale, bundle.messages);
        if (bundle.english) registerDictionary("en", bundle.english, true);
        messages = bundle.messages;
    }
    const value = useMemo(() => ({ locale, messages }), [locale, messages]);
    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
    return useContext(LocaleContext).locale;
}

/** The translator for Client Components. Server Components use `getTranslator()` instead. */
export function useT(): Translator {
    const { locale, messages } = useContext(LocaleContext);
    return useMemo(() => createTranslatorFrom(locale, messages), [locale, messages]);
}

export function useDemoCopy() {
    const locale = useLocale();
    return useMemo(() => createDemoCopy(locale), [locale]);
}
