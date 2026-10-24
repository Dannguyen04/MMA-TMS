import "server-only";

import { createDemoCopy } from "./demo-copy";
import { cookies } from "next/headers";
import { cache } from "react";

import { LOCALE_COOKIE, parseLocale, type Locale } from "./config";
import { createTranslator, type Translator } from "./translate";

/** The viewer's language for this request, from the `mma_locale` cookie (Vietnamese when unset). */
export const getLocale = cache(async (): Promise<Locale> => parseLocale((await cookies()).get(LOCALE_COOKIE)?.value));

/** The viewer's language and its translator, for Server Components and Server Actions. */
export async function getTranslator(): Promise<{ locale: Locale; t: Translator }> {
    const locale = await getLocale();
    return { locale, t: createTranslator(locale) };
}

export async function getDemoCopy() {
    return createDemoCopy(await getLocale());
}
