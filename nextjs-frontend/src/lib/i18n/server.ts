import "server-only";

import { createDemoCopy } from "./demo-copy";
import { cookies } from "next/headers";
import { cache } from "react";

import { DEFAULT_LOCALE, LOCALE_COOKIE, parseLocale, type Locale } from "./config";
import { createTranslator, type Translator } from "./translate";

/** Next throws this when `cookies()` runs outside a request, which unit tests do when they render a page. */
function missingRequestStore(error: unknown): boolean {
    return error instanceof Error && error.message.includes("was called outside a request scope");
}

/**
 * The viewer's language for this request, from the `mma_locale` cookie.
 * Unset cookie → Vietnamese. A real request that fails for any other reason still throws,
 * so a bad cookie store is not silently treated as the default language.
 * Unit tests that render a page with no request get Vietnamese, the product default.
 */
export const getLocale = cache(async (): Promise<Locale> => {
    try {
        return parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
    } catch (error) {
        if (missingRequestStore(error)) return DEFAULT_LOCALE;
        throw error;
    }
});

/** The viewer's language and its translator, for Server Components and Server Actions. */
export async function getTranslator(): Promise<{ locale: Locale; t: Translator }> {
    const locale = await getLocale();
    return { locale, t: createTranslator(locale) };
}

export async function getDemoCopy() {
    return createDemoCopy(await getLocale());
}
