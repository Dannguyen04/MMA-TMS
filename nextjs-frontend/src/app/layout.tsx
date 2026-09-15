import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";

import { ToastProvider } from "@/components/ui/toast";
import { THEME_COOKIE, parseTheme } from "@/lib/auth/constants";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin", "latin-ext", "vietnamese"],
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
        { media: "(prefers-color-scheme: light)", color: "#f5f4f0" },
        { media: "(prefers-color-scheme: dark)", color: "#0c0d0f" },
    ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

    return (
        <html lang="en" data-theme={theme} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
            <body className="min-h-full bg-bg text-fg">
                <ToastProvider>{children}</ToastProvider>
            </body>
        </html>
    );
}
