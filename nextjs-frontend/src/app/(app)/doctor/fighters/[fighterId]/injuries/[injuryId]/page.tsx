import type { Metadata } from "next";

import { InjuryDetail, injuryMetadata } from "@/components/doctor/views/injury-detail";

export async function generateMetadata({ params }: PageProps<"/doctor/fighters/[fighterId]/injuries/[injuryId]">): Promise<Metadata> {
    return injuryMetadata((await params).injuryId);
}

export default async function Page({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/injuries/[injuryId]">) {
    const [p, query] = await Promise.all([params, searchParams]);
    return <InjuryDetail injuryId={p.injuryId} query={query} fighterId={p.fighterId} />;
}
