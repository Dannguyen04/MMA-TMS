import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function CoachIndex() {
    redirect(routes.coach.dashboard);
}
