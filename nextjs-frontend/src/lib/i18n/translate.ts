import { createHash } from "node:crypto";

import type { Locale } from "./config";
import { en } from "./messages/en";
import { vi } from "./messages/vi";
import { registerServerDictionaries, type Dictionary, type MessageKey, type MessageParams, type Translator } from "./translate-client";

/**
 * The server translator: loads both dictionaries. Client Components and the shared modules they import use
 * `./translate-client` instead (A6 of docs/PERFORMANCE-PLAN.md), so the browser never downloads both.
 */

export type { Dictionary, MessageKey, MessageParams, Translator } from "./translate-client";

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, vi };

// Shared modules translate through `./translate-client`; on the server they read these.
registerServerDictionaries(DICTIONARIES);

export function createTranslator(locale: Locale): Translator {
    const dictionary = DICTIONARIES[locale];
    const translate: Translator = (key, params) => {
        const template = dictionary[key] ?? en[key] ?? key;
        if (!params) return template;
        return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
    };
    translate.locale = locale;
    return translate;
}

/** The message for `count`: `${key}.one` when it is 1 and that key exists, otherwise `key`. `{n}` is the count. */
export function plural(t: Translator, key: MessageKey, count: number, params: MessageParams = {}): string {
    const one = `${key}.one` as MessageKey;
    return t(count === 1 && one in en ? one : key, { n: count, ...params });
}

/** Whether a message exists, for text that only some screens translate yet (e.g. navigation labels). */
export function hasMessage(key: string): key is MessageKey {
    return key in en;
}

/** A navigation label (`navigation.ts` keeps the English one) in the viewer's language. */
export function navLabel(t: Translator, label: string): string {
    const key = `nav.${label}`;
    return hasMessage(key) ? t(key) : label;
}

/** The whole dictionary of one language, as the browser gets it (`app/i18n/[file]/route.ts`). */
export function getMessages(locale: Locale): Dictionary {
    return DICTIONARIES[locale];
}

/** The script that hands the browser one language: its dictionary and, for other languages, the English subset. */
export function dictionaryScript(locale: Locale): string {
    const bundle = { messages: DICTIONARIES[locale], english: getClientEnglishMessages(locale) };
    return `(self.__MMA_I18N__=self.__MMA_I18N__||{})[${JSON.stringify(locale)}]=${JSON.stringify(bundle)};`;
}

/** Changes whenever a dictionary does, so the browser can keep the script for good under a versioned URL. */
export const DICTIONARY_VERSION = createHash("sha256").update(JSON.stringify(DICTIONARIES)).digest("hex").slice(0, 12);

/**
 * English messages client code needs whatever the viewer's language: stored and pipeline labels arrive in English
 * and `video-copy.ts` maps them back (technique names, movement review statuses, finding categories).
 */
const CLIENT_ENGLISH_PREFIXES = ["technique.", "screens.video.movementReview.status.", "screens.video.findingCategory."];

/** The English subset above, sent next to a non-English dictionary; `undefined` when the viewer reads English. */
export function getClientEnglishMessages(locale: Locale): Dictionary | undefined {
    if (locale === "en") return undefined;
    return Object.fromEntries(Object.entries(en).filter(([key]) => CLIENT_ENGLISH_PREFIXES.some((prefix) => key.startsWith(prefix))));
}
