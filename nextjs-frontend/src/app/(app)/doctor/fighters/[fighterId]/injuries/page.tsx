import type { Metadata } from "next";

import { InjuriesView } from "@/components/doctor/views/injuries-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.injuries") };
}

export default async function FighterInjuriesPage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/injuries">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <InjuriesView query={query} fighterId={fighterId} />;
}
