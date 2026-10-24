import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";
import { getCurrentUser } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { dashboardPath, routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return {
        title: t("landing.metaTitle"),
        description: t("landing.metaDescription"),
    };
}

export default async function HomePage() {
    // The landing page is public: if the session can't be checked (API down), show it signed out.
    const [user, { t }] = await Promise.all([getCurrentUser().catch(() => null), getTranslator()]);
    return (
        <LandingPage
            primaryHref={user ? dashboardPath(user.role) : routes.login}
            primaryLabel={user ? t("landing.primaryOpenDashboard") : t("landing.primaryEnterArena")}
        />
    );
}
