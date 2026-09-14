import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { dashboardPath, routes } from "@/lib/routes";

export default async function HomePage() {
    const user = await getCurrentUser();
    redirect(user ? dashboardPath(user.role) : routes.login);
}
