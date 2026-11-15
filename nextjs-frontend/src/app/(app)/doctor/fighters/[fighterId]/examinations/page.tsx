import type { Metadata } from "next";

import { ExaminationsView } from "@/components/doctor/views/examinations-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.examinations") };
}

export default async function FighterExaminationsPage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/examinations">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <ExaminationsView query={query} fighterId={fighterId} />;
}
