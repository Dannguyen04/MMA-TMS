import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { en } from "./messages/en";
import { createTranslatorFrom, plural, type Dictionary } from "./translate-client";

/**
 * A6 of docs/PERFORMANCE-PLAN.md: the browser downloads only the active language's dictionary. Client code
 * translates through `translate-client.ts`, which must not import a dictionary, and nothing a Client Component
 * imports may load `translate.ts` (both dictionaries) or a dictionary file.
 */

const SRC = resolve(__dirname, "../..");
const toPosix = (path: string) => relative(SRC, path).split(sep).join("/");

/**
 * Files the A6 change could not switch yet, each with its reason. Remove an entry once the file imports
 * `@/lib/i18n/translate-client`; the test fails if an entry no longer needs to be here.
 */
const KNOWN_LEAKS: Record<string, string> = {};

const FORBIDDEN = /^lib\/i18n\/(translate\.ts|messages\/.+\.ts)$/;

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
    });
}

function resolveImport(from: string, specifier: string): string | null {
    let base: string;
    if (specifier.startsWith("@/")) base = join(SRC, specifier.slice(2));
    else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
    else return null;
    for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const path = base + ext;
        if (existsSync(path) && statSync(path).isFile()) return path;
    }
    return null;
}

/** Imports that survive compilation: type-only imports and exports are erased, so they do not count. */
function runtimeImports(file: string): string[] {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const specifiers: string[] = [];
    const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            const clause = node.importClause;
            const typeOnly =
                clause !== undefined &&
                (clause.isTypeOnly ||
                    (!clause.name &&
                        clause.namedBindings !== undefined &&
                        ts.isNamedImports(clause.namedBindings) &&
                        clause.namedBindings.elements.length > 0 &&
                        clause.namedBindings.elements.every((element) => element.isTypeOnly)));
            if (!typeOnly) specifiers.push(node.moduleSpecifier.text);
        } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            const typeOnly = node.isTypeOnly || (node.exportClause !== undefined && ts.isNamedExports(node.exportClause) && node.exportClause.elements.every((element) => element.isTypeOnly));
            if (!typeOnly) specifiers.push(node.moduleSpecifier.text);
        } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
            specifiers.push(node.arguments[0].text);
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return specifiers;
}

const directive = (file: string, name: string) => new RegExp(`^(?:\\s|//[^\\n]*\\n|/\\*[\\s\\S]*?\\*/)*["']${name}["']`).test(readFileSync(file, "utf8"));

describe("translate-client", () => {
    it("does not import a dictionary or the server translator", () => {
        const file = join(SRC, "lib/i18n/translate-client.ts");
        // Its only imports are types (the dictionary's keys), which compilation erases.
        expect(runtimeImports(file)).toEqual([]);
        expect(readFileSync(file, "utf8")).toMatch(/import type \{ en \} from "\.\/messages\/en";/);
    });

    it("keeps both dictionaries out of everything a Client Component imports", () => {
        const files = sourceFiles(SRC);
        const parent = new Map<string, string | null>();
        const queue = files.filter((file) => directive(file, "use client"));
        for (const file of queue) parent.set(file, null);
        while (queue.length) {
            const file = queue.shift()!;
            // Server Actions run on the server; the client bundle only gets a reference to them.
            if (directive(file, "use server")) continue;
            for (const specifier of runtimeImports(file)) {
                const target = resolveImport(file, specifier);
                if (target && !parent.has(target)) {
                    parent.set(target, file);
                    queue.push(target);
                }
            }
        }

        const leaks = new Map<string, string>();
        for (const [file, from] of parent) {
            if (!FORBIDDEN.test(toPosix(file)) || from === null || FORBIDDEN.test(toPosix(from))) continue;
            const chain: string[] = [];
            for (let at: string | null | undefined = from; at; at = parent.get(at)) chain.push(toPosix(at));
            leaks.set(toPosix(from), `${toPosix(file)} <- ${chain.join(" <- ")}`);
        }
        const unexpected = [...leaks].filter(([importer]) => !(importer in KNOWN_LEAKS)).map(([, chain]) => chain);
        expect(unexpected).toEqual([]);
        expect(Object.keys(KNOWN_LEAKS).filter((importer) => !leaks.has(importer))).toEqual([]);
    });

    it("translates from the dictionary it is given, like the server translator", () => {
        const vi: Dictionary = { "bout.documentsReady": "Đủ {ready}/{total} mục", "bout.versus": "gặp {opponent}" };
        const t = createTranslatorFrom("vi", vi);
        expect(t.locale).toBe("vi");
        expect(t("bout.documentsReady", { ready: 1, total: 2 })).toBe("Đủ 1/2 mục");
        expect(t("bout.versus", {})).toBe("gặp {opponent}");
        // A key missing from this dictionary falls back to English (registered on the server by the test setup).
        expect(t("bout.daysToWeighIn", { n: 3 })).toBe(en["bout.daysToWeighIn"].replace("{n}", "3"));
    });

    it("picks the .one variant through plural()", () => {
        const t = createTranslatorFrom("en", en);
        expect(plural(t, "bout.daysToWeighIn", 1)).toBe("1 day to weigh-in");
        expect(plural(t, "bout.daysToWeighIn", 3)).toBe("3 days to weigh-in");
    });
});
