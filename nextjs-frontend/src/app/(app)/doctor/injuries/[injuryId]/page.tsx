import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { injuryMetadata, injuryOwner } from "@/components/doctor/views/injury-detail";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/doctor/injuries/[injuryId]">): Promise<Metadata> {
    return injuryMetadata((await params).injuryId);
}

/** Kept for old links and redirects: the record always opens inside its fighter's profile. */
export default async function InjuryDetailPage({ params, searchParams }: PageProps<"/doctor/injuries/[injuryId]">) {
    const [{ injuryId }, query] = await Promise.all([params, searchParams]);
    const fighterId = await injuryOwner(injuryId);
    if (!fighterId) notFound();
    redirect(hrefWith(routes.doctor.fighterInjury(fighterId, injuryId), query, {}));
}
