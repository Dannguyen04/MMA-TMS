import type { Metadata } from "next";

import { NewRecoveryView } from "@/components/doctor/views/new-recovery-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.newRecoveryPlan") };
}

export default async function Page({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/recovery/new">) {
    const [p, query] = await Promise.all([params, searchParams]);
    return <NewRecoveryView query={{ ...query, fighter: p.fighterId }} />;
}
