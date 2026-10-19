"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { createTranslator, type Translator } from "@/lib/i18n/translate";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Makes the viewer's language available to Client Components; the root layout reads it from the cookie. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
    return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
    return useContext(LocaleContext);
}

/** The translator for Client Components. Server Components use `getTranslator()` instead. */
export function useT(): Translator {
    const locale = useLocale();
    return useMemo(() => createTranslator(locale), [locale]);
}
