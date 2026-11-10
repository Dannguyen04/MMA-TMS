import type { Metadata } from "next";

import { NewInjuryView } from "@/components/doctor/views/new-injury-view";

export const metadata: Metadata = { title: "Ghi nhận chấn thương" };

export default async function Page({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/injuries/new">) {
    const [p, query] = await Promise.all([params, searchParams]);
    return <NewInjuryView query={{ ...query, fighter: p.fighterId }} scoped />;
}
