import type { Metadata } from "next";

import { NewClearanceView } from "@/components/doctor/new-clearance-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.updateClearance") };
}

export default async function GrantClearancePage({ searchParams }: PageProps<"/doctor/medical-clearance/new">) {
    return <NewClearanceView query={await searchParams} />;
}
