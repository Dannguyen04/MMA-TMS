import { describe, expect, it } from "vitest";

import { PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import { GENERATED_PASSWORD_LENGTH, generatePassword, type RandomSource } from "./password-generator";

/** A predictable source that walks through the given values, for checking the rejection sampling. */
function sequence(values: number[]): RandomSource {
    let index = 0;
    return (buffer) => {
        for (let position = 0; position < buffer.length; position++) buffer[position] = values[index++ % values.length];
        return buffer;
    };
}

describe("generatePassword", () => {
    it("makes 16 characters with a lower-case letter, a capital, a digit and a symbol", () => {
        for (let run = 0; run < 200; run++) {
            const password = generatePassword();
            expect(password).toHaveLength(GENERATED_PASSWORD_LENGTH);
            expect(password).toMatch(/[a-z]/);
            expect(password).toMatch(/[A-Z]/);
            expect(password).toMatch(/[0-9]/);
            expect(password).toMatch(/[^a-zA-Z0-9]/);
        }
    });

    it("never uses look-alike characters", () => {
        const sample = Array.from({ length: 200 }, () => generatePassword()).join("");
        expect(sample).not.toMatch(/[0O1lI]/);
    });

    it("keeps the length inside the auth service's rule", () => {
        expect(generatePassword(3)).toHaveLength(PASSWORD_LENGTH.min);
        expect(generatePassword(500)).toHaveLength(PASSWORD_LENGTH.max);
    });

    it("draws again rather than favouring low characters", () => {
        // 0xFFFFFFFF lies past the last whole multiple of most alphabet sizes, so it is drawn again and the next value is used.
        expect(generatePassword(8, sequence([0xffffffff, 0]))).toHaveLength(8);
    });

    it("differs from one call to the next", () => {
        expect(new Set(Array.from({ length: 50 }, () => generatePassword())).size).toBe(50);
    });
});
