import { describe, expect, it } from "vitest";

import { appendSuggestion } from "./suggestion-text";

describe("appendSuggestion", () => {
    it("fills an empty field", () => {
        expect(appendSuggestion("  ", "Good footwork")).toBe("Good footwork");
    });

    it("adds a new sentence after existing text", () => {
        expect(appendSuggestion("Sharp jab", "Good footwork")).toBe("Sharp jab. Good footwork");
        expect(appendSuggestion("Sharp jab.", "Good footwork")).toBe("Sharp jab. Good footwork");
    });

    it("doesn't add the same suggestion twice", () => {
        expect(appendSuggestion("Sharp jab. Good footwork", "good footwork")).toBe("Sharp jab. Good footwork");
    });
});
