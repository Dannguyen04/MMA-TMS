import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { getFighter } from "@/lib/services/people";

export const metadata: Metadata = { title: "Fighter" };

/**
 * Notifications about a fighter (a new fighter waiting for a coach or a sports doctor) name the fighter profile, while
 * administrators manage the account. This resolves one to the other and opens the account's care team, which the page
 * reads fresh, so a doctor someone else assigned in the meantime shows instead of an empty slot. The notification
 * grants nothing: the session must be an administrator's, and the fighter service still checks access.
 */
export default async function AdminFighterPage({ params }: PageProps<"/admin/fighters/[fighterId]">) {
    await requireRole("admin");
    const fighter = await getFighter((await params).fighterId);
    if (!fighter) notFound();
    redirect(routes.admin.userCareTeam(fighter.userId));
}
