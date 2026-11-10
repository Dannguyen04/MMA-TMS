import type { Metadata } from "next";

import { InjuriesView } from "@/components/doctor/views/injuries-view";

export const metadata: Metadata = { title: "Chấn thương" };

export default async function FighterInjuriesPage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/injuries">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <InjuriesView query={query} fighterId={fighterId} />;
}
