import { describe, expect, it } from "vitest";

import { NAVIGATION } from "@/components/layout/navigation";
import { parseLocale } from "./config";
import { en } from "./messages/en";
import { vi } from "./messages/vi";
import { createTranslator, hasMessage, plural } from "./translate";

describe("createTranslator", () => {
    it("translates and fills placeholders", () => {
        expect(createTranslator("vi")("bout.documentsReady", { ready: 1, total: 2 })).toBe("Đủ 1/2 mục");
        expect(createTranslator("en")("bout.documentsReady", { ready: 1, total: 2 })).toBe("1 of 2 ready");
    });

    it("leaves an unknown placeholder as written", () => {
        expect(createTranslator("en")("bout.versus", {})).toBe("vs {opponent}");
    });
});

describe("plural", () => {
    it("uses the .one variant for a count of 1 and the plain key otherwise", () => {
        const t = createTranslator("en");
        expect(plural(t, "bout.daysToWeighIn", 1)).toBe("1 day to weigh-in");
        expect(plural(t, "bout.daysToWeighIn", 3)).toBe("3 days to weigh-in");
        expect(plural(createTranslator("vi"), "bout.daysToWeighIn", 3)).toBe("Còn 3 ngày đến buổi cân");
    });
});

describe("dictionaries", () => {
    it("define the same keys in both languages, none empty", () => {
        expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort());
        for (const value of [...Object.values(en), ...Object.values(vi)]) expect(value.trim()).not.toBe("");
    });

    it("keep the same placeholders in both languages", () => {
        const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
        for (const key of Object.keys(en) as (keyof typeof en)[]) expect(names(vi[key]), key).toEqual(names(en[key]));
    });

    it("translate every navigation label", () => {
        for (const sections of Object.values(NAVIGATION)) {
            for (const section of sections) {
                const labels = [section.label, ...section.items.flatMap((item) => [item.label, item.shortLabel, ...(item.tabs ?? []).map((tab) => tab.label)])];
                for (const label of labels) if (label) expect(hasMessage(`nav.${label}`), label).toBe(true);
            }
        }
    });
});

describe("parseLocale", () => {
    it("defaults to Vietnamese", () => {
        expect(parseLocale(undefined)).toBe("vi");
        expect(parseLocale("fr")).toBe("vi");
        expect(parseLocale("en")).toBe("en");
    });
});
