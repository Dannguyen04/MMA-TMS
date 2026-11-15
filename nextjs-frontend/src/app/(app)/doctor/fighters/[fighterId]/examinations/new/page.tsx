import type { Metadata } from "next";

import { NewExaminationView } from "@/components/doctor/new-examination-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.createExamination") };
}

export default async function FighterNewExaminationPage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/examinations/new">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <NewExaminationView query={query} fighterId={fighterId} />;
}
