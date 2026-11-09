import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * T-025 §3, as a ratchet: English typed straight into JSX (text, or a visible attribute such as `aria-label`) must
 * come from the dictionaries instead. Files that still have some are listed in `hardcoded-english.baseline.json`
 * with their count; a file may only go down. When you translate strings, refresh the baseline with
 * `UPDATE_I18N_BASELINE=1 pnpm --filter nextjs-frontend exec vitest run src/lib/i18n/hardcoded-english.test.ts`.
 */

const ROOT = join(__dirname, "..", "..", "..");
const SCAN = ["src/app", "src/components"];
const BASELINE = join(__dirname, "hardcoded-english.baseline.json");

/** Attributes a person reads or hears. */
const VISIBLE_ATTRIBUTES = new Set(["aria-label", "aria-description", "title", "placeholder", "alt", "label", "description", "hint", "pendingLabel"]);

/** Words that stay as they are in both languages: brand, units, sport and medical codes. */
const ALLOWED_WORDS = new Set(
    "mma tms ctrl kg cm min sec rpe ai id ok vs ko tko scat scat6 mri ct ecg url pdf csv glb webgl jab cross hook teep uppercut bjj ufc one aiba vmmaf cc by harshit prajapati fight night".split(" "),
);

/** Folders that are English on purpose: the developer-only lab and the concept prototypes. */
const SKIPPED = [/^src\/app\/\(app\)\/lab\//, /^src\/app\/concept\//, /^src\/components\/lab\//];

function files(dir: string): string[] {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return files(path);
        return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [path] : [];
    });
}

function isEnglish(text: string): boolean {
    // HTML entities (`&nbsp;`) are not words.
    const words = text.replace(/&[a-z]+;/gi, " ").match(/[A-Za-z][A-Za-z']+/g) ?? [];
    return words.some((word) => !ALLOWED_WORDS.has(word.toLowerCase()));
}

/** Hard-coded English strings in one file, in source order. */
function hardcodedEnglish(source: string, fileName = "file.tsx"): string[] {
    const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const found: string[] = [];
    const visit = (node: ts.Node) => {
        if (ts.isJsxText(node)) {
            const text = node.text.replace(/\s+/g, " ").trim();
            if (text && isEnglish(text)) found.push(text);
        } else if (ts.isJsxAttribute(node) && VISIBLE_ATTRIBUTES.has(node.name.getText(sourceFile))) {
            const value = node.initializer;
            const literal = value && ts.isJsxExpression(value) ? value.expression : value;
            if (literal && (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal)) && isEnglish(literal.text)) {
                found.push(`${node.name.getText(sourceFile)}="${literal.text}"`);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return found;
}

function scan(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const file of SCAN.flatMap(files)) {
        const key = relative(ROOT, join(ROOT, file)).split(sep).join("/");
        if (SKIPPED.some((pattern) => pattern.test(key))) continue;
        const strings = hardcodedEnglish(readFileSync(join(ROOT, file), "utf8"), key);
        if (strings.length > 0) result[key] = strings;
    }
    return result;
}

describe("hard-coded English (T-025 ratchet)", () => {
    it("finds JSX text and visible attributes, and lets allowed words and expressions through", () => {
        const found = hardcodedEnglish(
            `export const A = () => (
                <div aria-label="Close dialog" className="flex">
                    <p>Hello world</p>
                    <p>{t("shell.title")}</p>
                    <span>12&nbsp;kg</span>
                    <span title={label}>MMA</span>
                    <p>Hồ sơ võ sĩ</p>
                </div>
            );`,
        );
        expect(found).toEqual(['aria-label="Close dialog"', "Hello world"]);
    });

    it("adds no English to any file beyond the baseline", () => {
        const current = scan();
        const counts = Object.fromEntries(Object.entries(current).map(([file, strings]) => [file, strings.length]));
        if (process.env.UPDATE_I18N_BASELINE) {
            writeFileSync(BASELINE, `${JSON.stringify(Object.fromEntries(Object.entries(counts).sort()), null, 4)}\n`);
            return;
        }
        const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<string, number>;
        const grown = Object.entries(current)
            .filter(([file, strings]) => strings.length > (baseline[file] ?? 0))
            .map(([file, strings]) => `${file}: ${baseline[file] ?? 0} → ${strings.length}\n    ${strings.join("\n    ")}`);
        expect(grown, "Put these strings in the dictionaries (screens*.ts / *.en.ts + *.vi.ts) and render them with t()").toEqual([]);
    });
});
