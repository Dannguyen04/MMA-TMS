import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function AdminIndex() {
    redirect(routes.admin.dashboard);
}
