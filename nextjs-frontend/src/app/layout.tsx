import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";

import { LocaleProvider } from "@/components/i18n/locale-provider";
import { ToastProvider } from "@/components/ui/toast";
import { THEME_COOKIE, parseTheme } from "@/lib/auth/constants";
import { LOCALE_COOKIE, parseLocale } from "@/lib/i18n/config";
import "./globals.css";

// Only Latin is preloaded; the Vietnamese subset is still self-hosted and loads when a page needs it.
const beVietnam = Be_Vietnam_Pro({
    variable: "--font-be-vietnam",
    weight: ["400", "500", "600", "700"],
    subsets: ["latin"],
});

const barlow = Barlow_Condensed({
    variable: "--font-barlow",
    weight: ["600", "700", "800"],
    style: ["normal", "italic"],
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: {
        default: "MMA-TMS — Fighter Training & Health Management",
        template: "%s · MMA-TMS",
    },
    description:
        "MMA fighter training, AI-assisted video analysis, performance tracking and sports medicine in one platform. Hệ thống Quản lý Huấn luyện và Theo dõi Sức khỏe Võ sĩ.",
};

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
                <LocaleProvider locale={locale}>
                    <ToastProvider>{children}</ToastProvider>
                </LocaleProvider>
            </body>
        </html>
    );
}
