import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { injuryOwner } from "@/components/doctor/views/injury-detail";
import { NewRecoveryView } from "@/components/doctor/views/new-recovery-view";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Kế hoạch phục hồi mới" };

/** For a known fighter (named, or the owner of the injury) the form opens inside their profile. */
export default async function NewRecoveryPlanPage({ searchParams }: PageProps<"/doctor/recovery/new">) {
    const [user, query] = await Promise.all([requireRole("doctor"), searchParams]);
    const injuryId = param(query.injury);
    const fighterId = param(query.fighter) ?? (injuryId ? await injuryOwner(injuryId) : null);
    if (fighterId && canAccessFighter(user, fighterId)) redirect(hrefWith(routes.doctor.fighterNewRecoveryPlan(fighterId), query, { fighter: null }));
    return <NewRecoveryView query={query} />;
}
