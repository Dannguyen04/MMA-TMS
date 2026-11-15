import type { Metadata } from "next";

import { NewInjuryView } from "@/components/doctor/views/new-injury-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.recordInjury") };
}

export default async function Page({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/injuries/new">) {
    const [p, query] = await Promise.all([params, searchParams]);
    return <NewInjuryView query={{ ...query, fighter: p.fighterId }} scoped />;
}
