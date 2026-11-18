import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { recoveryPlanMetadata, recoveryPlanOwner } from "@/components/doctor/views/recovery-plan-detail";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/doctor/recovery/[planId]">): Promise<Metadata> {
    return recoveryPlanMetadata((await params).planId);
}

/** Kept for old links and redirects: the record always opens inside its fighter's profile. */
export default async function RecoveryPlanPage({ params, searchParams }: PageProps<"/doctor/recovery/[planId]">) {
    const [{ planId }, query] = await Promise.all([params, searchParams]);
    const fighterId = await recoveryPlanOwner(planId);
    if (!fighterId) notFound();
    redirect(hrefWith(routes.doctor.fighterRecoveryPlan(fighterId, planId), query, {}));
}
