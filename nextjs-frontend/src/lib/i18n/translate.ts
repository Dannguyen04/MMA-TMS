import type { Locale } from "./config";
import { en } from "./messages/en";
import { vi } from "./messages/vi";

/** Every key of the English dictionary; the Vietnamese one must define the same keys (checked by the type). */
export type MessageKey = keyof typeof en;

export type MessageParams = Record<string, string | number>;

/** Looks up a message and fills `{name}` placeholders. */
export interface Translator {
    (key: MessageKey, params?: MessageParams): string;
    locale?: Locale;
}

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, vi };

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
