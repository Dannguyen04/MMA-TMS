import type { Metadata } from "next";

import { HistoryView } from "@/components/doctor/views/history-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.history") };
}

export default async function FighterHistoryPage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/history">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <HistoryView query={query} fighterId={fighterId} />;
}
