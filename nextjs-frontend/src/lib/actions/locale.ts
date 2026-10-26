"use server";

import { cookies } from "next/headers";

import { LOCALE_COOKIE, parseLocale } from "@/lib/i18n/config";

/** Stores the interface language for a year; the caller refreshes the page so Server Components re-render. */
export async function setLocalePreference(formData: FormData): Promise<void> {
    const store = await cookies();
    store.set(LOCALE_COOKIE, parseLocale(String(formData.get("locale") ?? "")), {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
    });
}
