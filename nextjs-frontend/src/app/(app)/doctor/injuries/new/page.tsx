import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewInjuryView } from "@/components/doctor/views/new-injury-view";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Ghi nhận chấn thương" };

/** For a known fighter the form opens inside their profile; without one, the doctor picks the fighter here. */
export default async function NewInjuryPage({ searchParams }: PageProps<"/doctor/injuries/new">) {
    const [user, query] = await Promise.all([requireRole("doctor"), searchParams]);
    const fighterId = param(query.fighter);
    if (fighterId && canAccessFighter(user, fighterId)) redirect(hrefWith(routes.doctor.fighterNewInjury(fighterId), query, { fighter: null }));
    return <NewInjuryView query={query} />;
}
