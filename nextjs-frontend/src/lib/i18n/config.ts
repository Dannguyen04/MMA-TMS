/** Interface languages. Vietnamese is the default; English stays available from the account menu. */
export const LOCALES = ["vi", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "vi";

/** Cookie holding the viewer's language choice. */
export const LOCALE_COOKIE = "mma_locale";

/** BCP 47 tags for `Intl` formatting and `<html lang>`. */
export const INTL_LOCALE: Record<Locale, string> = { vi: "vi-VN", en: "en-GB" };

export const LOCALE_NAMES: Record<Locale, string> = { vi: "Tiếng Việt", en: "English" };

export function parseLocale(value: string | null | undefined): Locale {
    return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : DEFAULT_LOCALE;
}
