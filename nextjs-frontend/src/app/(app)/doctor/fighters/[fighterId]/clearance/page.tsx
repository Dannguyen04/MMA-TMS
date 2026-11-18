import type { Metadata } from "next";

import { ClearanceView } from "@/components/doctor/views/clearance-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.clearance") };
}

export default async function FighterClearancePage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/clearance">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <ClearanceView query={query} fighterId={fighterId} />;
}
