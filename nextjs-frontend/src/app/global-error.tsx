"use client";

import "./globals.css";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
    return (
        <html lang="en" data-theme="system">
            <body className="flex min-h-dvh items-center justify-center bg-bg px-6 text-fg">
                <main className="max-w-md text-center">
                    <h1 className="text-2xl font-semibold tracking-tight">MMA-TMS is temporarily unavailable</h1>
                    <p className="mt-2 text-[15px] text-fg-muted">An unexpected error stopped the app from loading. Please try again.</p>
                    <button
                        type="button"
                        onClick={() => retry()}
                        className="mt-6 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-hover"
                    >
                        Try again
                    </button>
                </main>
            </body>
        </html>
    );
}
