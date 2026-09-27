import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isDateKey } from "@/lib/format";

/*
 * Parsing and follow-up helpers shared by the Server Action modules. They live here because a "use server" module
 * may only export actions.
 */

export const NOT_ASSIGNED = "You aren't assigned to this fighter, so you can't change their medical information.";

/** Clock skew tolerated when checking that a time isn't in the future. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;

/** A form value as a string; "" when it's missing or a file. */
export function text(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
}

/** Every string posted under one name (checkbox groups, multi-selects). */
export function texts(formData: FormData, name: string): string[] {
    return formData.getAll(name).filter((value): value is string => typeof value === "string");
}

/** Whether a checkbox or switch was ticked. */
export function checked(formData: FormData, name: string): boolean {
    return formData.get(name) === "on";
}

/** The keys of a label record, typed for `z.enum`. */
export function keysOf<T extends string>(record: Record<T, string>): [T, ...T[]] {
    return Object.keys(record) as [T, ...T[]];
}

/** A YYYY-MM-DD date, or "" when the field was left empty. */
export const optionalDate = (message: string) =>
    z
        .string()
        .trim()
        .refine((value) => value === "" || isDateKey(value), message);

/** A JSON-encoded array posted from a client-side builder, with optional size bounds. */
export function jsonArray<T extends z.ZodType>(
    item: T,
    label: string,
    bounds: { min?: number; minMessage?: string; max?: number; maxMessage?: string } = {},
) {
    let array = z.array(item);
    if (bounds.min !== undefined) array = array.min(bounds.min, bounds.minMessage);
    if (bounds.max !== undefined) array = array.max(bounds.max, bounds.maxMessage);
    return z
        .string()
        .transform((value, ctx) => {
            try {
                return JSON.parse(value || "[]") as unknown;
            } catch {
                ctx.addIssue({ code: "custom", message: `The ${label} couldn't be read. Reload the page and try again.` });
                return z.NEVER;
            }
        })
        .pipe(array);
}

/** Whether an ISO time lies in the future, allowing for clock skew between browser and server. */
export function isInFuture(iso: string): boolean {
    return Date.parse(iso) > Date.now() + FUTURE_TOLERANCE_MS;
}

/** Clinical changes show up on doctor, fighter and coach screens. */
export function revalidateClinical() {
    revalidatePath("/doctor", "layout");
    revalidatePath("/fighter", "layout");
    revalidatePath("/coach", "layout");
}
