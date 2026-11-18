import type { Metadata } from "next";

import { RecoveryView } from "@/components/doctor/views/recovery-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.recovery") };
}

export default async function FighterRecoveryPage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/recovery">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <RecoveryView query={query} fighterId={fighterId} />;
}
