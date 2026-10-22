import type { Locale } from './config';
import { createTranslator, hasMessage } from './translate';
/** Translate known interface labels. User-authored text passes through unchanged. */
export function createDemoCopy(locale: Locale) {
    const t = createTranslator(locale);
    return (source: string, params?: Record<string, string | number>): string => {
        const key = 'demoFlow.' + source;
        return hasMessage(key) ? t(key, params) : source.replace(/\{(\w+)\}/g, (match, name: string) => params && name in params ? String(params[name]) : match);
    };
}
