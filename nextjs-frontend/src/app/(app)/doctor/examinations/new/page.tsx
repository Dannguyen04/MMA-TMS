import type { Metadata } from "next";

import { NewExaminationView } from "@/components/doctor/new-examination-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.newExamination") };
}

export default async function NewExaminationPage({ searchParams }: PageProps<"/doctor/examinations/new">) {
    return <NewExaminationView query={await searchParams} />;
}
