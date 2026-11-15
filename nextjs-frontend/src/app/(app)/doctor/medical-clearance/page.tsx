import type { Metadata } from "next";

import { ClearanceView } from "@/components/doctor/views/clearance-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.clearance") };
}

export default async function DoctorClearancePage({ searchParams }: PageProps<"/doctor/medical-clearance">) {
    return (
        <div className="yt-page">
            <ClearanceView query={await searchParams} />
        </div>
    );
}
