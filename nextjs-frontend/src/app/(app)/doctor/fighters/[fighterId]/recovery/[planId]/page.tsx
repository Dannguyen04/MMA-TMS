import type { Metadata } from "next";

import { RecoveryPlanDetail, recoveryPlanMetadata } from "@/components/doctor/views/recovery-plan-detail";

export async function generateMetadata({ params }: PageProps<"/doctor/fighters/[fighterId]/recovery/[planId]">): Promise<Metadata> {
    return recoveryPlanMetadata((await params).planId);
}

export default async function Page({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/recovery/[planId]">) {
    const [p, query] = await Promise.all([params, searchParams]);
    return <RecoveryPlanDetail planId={p.planId} query={query} fighterId={p.fighterId} />;
}
