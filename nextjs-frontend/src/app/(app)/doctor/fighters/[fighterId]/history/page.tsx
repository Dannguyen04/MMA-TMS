import type { Metadata } from "next";

import { HistoryView } from "@/components/doctor/views/history-view";

export const metadata: Metadata = { title: "Lịch sử" };

export default async function FighterHistoryPage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/history">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <HistoryView query={query} fighterId={fighterId} />;
}
