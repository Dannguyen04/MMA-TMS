import { gzipSync } from "node:zlib";

import { LOCALES, type Locale } from "@/lib/i18n/config";
import { dictionaryScript } from "@/lib/i18n/translate";

/** Built once per language and process: the dictionaries only change with a new build. */
const scripts = new Map<Locale, { plain: string; gzip: Uint8Array<ArrayBuffer> }>();

function scriptFor(locale: Locale) {
    let script = scripts.get(locale);
    if (!script) {
        const plain = dictionaryScript(locale);
        script = { plain, gzip: new Uint8Array(gzipSync(plain)) };
        scripts.set(locale, script);
    }
    return script;
}

/**
 * One language's dictionary as a script (`/i18n/vi.js?v=…`), so the browser downloads only the viewer's language and
 * keeps it in its cache across pages, refreshes and saves instead of receiving it with every server render. The URL
 * carries the dictionary version, so the response can be cached for good. Route handlers aren't compressed for us.
 */
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
    const { file } = await params;
    const locale = file.replace(/\.js$/, "");
    if (!file.endsWith(".js") || !(LOCALES as readonly string[]).includes(locale)) return new Response("Not found", { status: 404 });
    const script = scriptFor(locale as Locale);
    const gzip = /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "");
    return new Response(gzip ? script.gzip : script.plain, {
        headers: {
            "content-type": "text/javascript; charset=utf-8",
            "cache-control": "public, max-age=31536000, immutable",
            vary: "accept-encoding",
            ...(gzip ? { "content-encoding": "gzip" } : {}),
        },
    });
}
