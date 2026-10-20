"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_LOCALE, LOCALE_COOKIE, parseLocale, type Locale } from "@/lib/i18n/config";
import "./globals.css";

const MESSAGES: Record<Locale, { title: string; description: string; retry: string }> = {
    vi: {
        title: "MMA-TMS tạm thời không khả dụng",
        description: "Đã xảy ra lỗi ngoài dự kiến khiến ứng dụng không thể tải. Vui lòng thử lại.",
        retry: "Thử lại",
    },
    en: {
        title: "MMA-TMS is temporarily unavailable",
        description: "An unexpected error stopped the app from loading. Please try again.",
        retry: "Try again",
    },
};

function noopSubscribe() {
    return () => {};
}

function readCookieLocale(): Locale {
    if (typeof document === "undefined") return DEFAULT_LOCALE;
    const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
    return parseLocale(match ? decodeURIComponent(match[1]) : null);
}

function getServerLocale(): Locale {
    return DEFAULT_LOCALE;
}

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
    const locale = useSyncExternalStore(noopSubscribe, readCookieLocale, getServerLocale);
    const m = MESSAGES[locale];

    return (
        <html lang={locale} data-theme="light">
            <body className="flex min-h-dvh items-center justify-center bg-bg px-6 text-fg">
                <main className="max-w-md text-center">
                    <h1 className="text-2xl font-semibold tracking-tight">{m.title}</h1>
                    <p className="mt-2 text-[15px] text-fg-muted">{m.description}</p>
                    <button
                        type="button"
                        onClick={() => retry()}
                        className="mt-6 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-hover"
                    >
                        {m.retry}
                    </button>
                </main>
            </body>
        </html>
    );
}
