import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";
import { getCurrentUser } from "@/lib/auth/session";
import { dashboardPath, routes } from "@/lib/routes";

export const metadata: Metadata = {
    title: "MMA-TMS | Train harder. Fight cleared.",
    description: "A focused MMA performance platform for technique, training and athlete health.",
};

export default async function HomePage() {
    const user = await getCurrentUser();
    return <LandingPage primaryHref={user ? dashboardPath(user.role) : routes.login} primaryLabel={user ? "Open dashboard" : "Enter the arena"} />;
}
