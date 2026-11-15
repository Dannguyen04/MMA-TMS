import type { Locale } from "./config";
// Type only: erased at build time, so this module never puts a dictionary in a client bundle.
import type { en } from "./messages/en";

/**
 * The translator without the dictionaries (A6 of docs/PERFORMANCE-PLAN.md). Client Components and the shared
 * modules they import use this file, so the browser only downloads the active language's dictionary, as a cached
 * script (`/i18n/<locale>.js`) that `LocaleProvider` registers. Server code keeps importing `./translate`, which
 * loads both dictionaries and registers them here. This file must never import `./translate` or anything under
 * `./messages` at runtime (`translate-client.test.ts` checks it).
 */

/** Every key of the English dictionary; the Vietnamese one must define the same keys (checked by the type). */
export type MessageKey = keyof typeof en;

export type MessageParams = Record<string, string | number>;

/** A whole dictionary (or, for the English fallback on the client, part of one). */
export type Dictionary = Readonly<Partial<Record<MessageKey, string>>>;

/** Looks up a message and fills `{name}` placeholders. */
export interface Translator {
    (key: MessageKey, params?: MessageParams): string;
    locale?: Locale;
}

/** Dictionaries the server loaded (`./translate`). On `globalThis` so every server bundle in the process shares them. */
const SERVER_KEY = "__mmaTmsDictionaries";

type ServerDictionaries = Partial<Record<Locale, Dictionary>>;

function serverDictionaries(): ServerDictionaries | undefined {
    if (typeof window !== "undefined") return undefined;
    return (globalThis as { [SERVER_KEY]?: ServerDictionaries })[SERVER_KEY];
}

/** Called by `./translate` when it loads the full dictionaries on the server. */
export function registerServerDictionaries(dictionaries: Record<Locale, Dictionary>): void {
    (globalThis as { [SERVER_KEY]?: ServerDictionaries })[SERVER_KEY] = dictionaries;
}

/** Dictionaries `LocaleProvider` registered in this bundle (the browser, from the `/i18n/<locale>.js` script). */
const provided: Partial<Record<Locale, Dictionary>> = {};
/** The full dictionary of the viewer's language, the last resort before showing the key. */
let active: Dictionary | undefined;

/**
 * Called by `LocaleProvider` while it renders, before any child translates. Idempotent: the same locale always
 * gets the same dictionary, so concurrent server renders in different languages cannot mix them up.
 * `partial` marks the English subset sent alongside another language; it never replaces a full English dictionary.
 */
export function registerDictionary(locale: Locale, dictionary: Dictionary, partial = false): void {
    if (partial) {
        if (!provided[locale]) provided[locale] = dictionary;
        return;
    }
    provided[locale] = dictionary;
    active = dictionary;
}

function dictionaryFor(locale: Locale): Dictionary | undefined {
    return provided[locale] ?? serverDictionaries()?.[locale];
}

/** The message for `key`: the requested language, then English, then the viewer's language, then the key itself. */
function lookup(locale: Locale, key: MessageKey, own?: Dictionary): string {
    return (own ?? dictionaryFor(locale))?.[key] ?? dictionaryFor("en")?.[key] ?? active?.[key] ?? key;
}

/** Fills `{name}` placeholders; an unknown placeholder stays as written. */
export function fillMessage(template: string, params?: MessageParams): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/**
 * A translator over a dictionary in hand (`useT()` passes the one from `LocaleProvider`).
 * Without one it looks the locale up when it translates, not when it is created, so a module-level
 * `createTranslator("en")` works once the dictionaries are registered.
 */
export function createTranslatorFrom(locale: Locale, dictionary?: Dictionary): Translator {
    const translate: Translator = (key, params) => fillMessage(lookup(locale, key, dictionary), params);
    translate.locale = locale;
    return translate;
}

/** Same call as `./translate`'s `createTranslator`, for code that runs in the browser. */
export function createTranslator(locale: Locale): Translator {
    return createTranslatorFrom(locale);
}

/** Whether a message exists, for text that only some screens translate yet (e.g. navigation labels). */
export function hasMessage(key: string): key is MessageKey {
    const dictionary = serverDictionaries()?.en ?? active ?? provided.en;
    return dictionary !== undefined && key in dictionary;
}

/** The message for `count`: `${key}.one` when it is 1 and that key exists, otherwise `key`. `{n}` is the count. */
export function plural(t: Translator, key: MessageKey, count: number, params: MessageParams = {}): string {
    const one = `${key}.one` as MessageKey;
    return t(count === 1 && hasMessage(one) ? one : key, { n: count, ...params });
}

/** A navigation label (`navigation.ts` keeps the English one) in the viewer's language. */
export function navLabel(t: Translator, label: string): string {
    const key = `nav.${label}`;
    return hasMessage(key) ? t(key) : label;
}
