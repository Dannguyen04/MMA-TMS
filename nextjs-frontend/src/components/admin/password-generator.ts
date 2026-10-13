import { PASSWORD_LENGTH } from "@/lib/auth/password-rules";

/*
 * First passwords an administrator hands to a new account holder. Easy to read aloud or copy: no look-alike
 * characters (0/O, 1/l/I) and only symbols that survive chat apps and spreadsheets.
 */

const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!#$%*+-=?@";
const GROUPS = [LOWER, UPPER, DIGITS, SYMBOLS];
const ALL = GROUPS.join("");

export const GENERATED_PASSWORD_LENGTH = 16;

/** Fills an array with random 32-bit values; `crypto.getRandomValues` in the browser and on the server. */
export type RandomSource = (values: Uint32Array) => Uint32Array;

const cryptoRandom: RandomSource = (values) => crypto.getRandomValues(values);

/** An unbiased index below `size`: values past the last whole multiple of `size` are drawn again. */
function randomIndex(size: number, random: RandomSource): number {
    const limit = Math.floor(0x1_0000_0000 / size) * size;
    const buffer = new Uint32Array(1);
    for (;;) {
        const [value] = random(buffer);
        if (value < limit) return value % size;
    }
}

/**
 * A random password within the auth service's length rule, with at least one lower-case letter, capital, digit and
 * symbol, so it passes a provider that asks for each. Never logged or stored; the form sends it once.
 */
export function generatePassword(length: number = GENERATED_PASSWORD_LENGTH, random: RandomSource = cryptoRandom): string {
    const size = Math.min(Math.max(length, PASSWORD_LENGTH.min, GROUPS.length), PASSWORD_LENGTH.max);
    const characters = GROUPS.map((group) => group[randomIndex(group.length, random)]);
    while (characters.length < size) characters.push(ALL[randomIndex(ALL.length, random)]);
    // Shuffle (Fisher–Yates) so the guaranteed characters don't always lead.
    for (let index = characters.length - 1; index > 0; index--) {
        const swap = randomIndex(index + 1, random);
        [characters[index], characters[swap]] = [characters[swap], characters[index]];
    }
    return characters.join("");
}
