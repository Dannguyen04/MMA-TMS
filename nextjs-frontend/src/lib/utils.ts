type ClassValue = string | number | false | null | undefined | ClassValue[];

/** Joins class names, skipping falsy values. */
export function cn(...values: ClassValue[]): string {
    const out: string[] = [];
    for (const value of values) {
        if (!value) continue;
        if (Array.isArray(value)) {
            const nested = cn(...value);
            if (nested) out.push(nested);
        } else {
            out.push(String(value));
        }
    }
    return out.join(" ");
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function sum(values: number[]): number {
    return values.reduce((acc, v) => acc + v, 0);
}

export function average(values: number[]): number {
    return values.length === 0 ? 0 : sum(values) / values.length;
}

export function round(value: number, decimals = 0): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
    const out = {} as Record<K, T[]>;
    for (const item of items) {
        const k = key(item);
        (out[k] ??= []).push(item);
    }
    return out;
}

export function initials(name: string): string {
    const parts = name.replace(/^(Dr\.?)\s+/i, "").trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
}

/** Reads a single string value from Next.js searchParams. */
export function param(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}
