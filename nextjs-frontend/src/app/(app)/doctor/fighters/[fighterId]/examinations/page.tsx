import type { Metadata } from "next";

import { ExaminationsView } from "@/components/doctor/views/examinations-view";

export const metadata: Metadata = { title: "Phiếu khám" };

export default async function FighterExaminationsPage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/examinations">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <ExaminationsView query={query} fighterId={fighterId} />;
}
