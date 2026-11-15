import type { Metadata } from "next";

import { NewClearanceView } from "@/components/doctor/new-clearance-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.issueClearance") };
}

export default async function FighterGrantClearancePage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/clearance/new">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <NewClearanceView query={query} fighterId={fighterId} />;
}
