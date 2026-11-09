import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";

import { LocaleProvider } from "@/components/i18n/locale-provider";
import { GraphicsTierMark } from "@/components/layout/graphics-tier-mark";
import { ToastProvider } from "@/components/ui/toast";
import { THEME_COOKIE, parseTheme } from "@/lib/auth/constants";
import { LOCALE_COOKIE, parseLocale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import "./globals.css";

// Latin is the preload subset. Vietnamese is included so dấu tiếng Việt dùng đúng Be Vietnam Pro và Barlow Condensed.
const beVietnam = Be_Vietnam_Pro({
    variable: "--font-be-vietnam",
    weight: ["400", "500", "600", "700"],
    subsets: ["latin", "vietnamese"],
});

const barlow = Barlow_Condensed({
    variable: "--font-barlow",
    weight: ["600", "700", "800"],
    style: ["normal", "italic"],
    subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return {
        title: {
            default: t("shell.meta.title"),
            template: "%s · MMA-TMS",
        },
        description: t("shell.meta.description"),
    };
}

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#eef1f5" },
        { media: "(prefers-color-scheme: dark)", color: "#0d1626" },
    ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const store = await cookies();
    const theme = parseTheme(store.get(THEME_COOKIE)?.value);
    const locale = parseLocale(store.get(LOCALE_COOKIE)?.value);

    return (
        <html lang={locale} data-theme={theme} className={`${beVietnam.variable} ${barlow.variable} ${geistMono.variable} h-full antialiased`}>
            <body className="min-h-full bg-bg text-fg">
                <GraphicsTierMark />
                <LocaleProvider locale={locale}>
                    <ToastProvider>{children}</ToastProvider>
                </LocaleProvider>
            </body>
        </html>
    );
}
