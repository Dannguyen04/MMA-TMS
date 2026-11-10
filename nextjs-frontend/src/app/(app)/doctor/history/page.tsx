import type { Metadata } from "next";

import { HistoryView } from "@/components/doctor/views/history-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.medicalHistory") };
}

export default async function DoctorHistoryPage({ searchParams }: PageProps<"/doctor/history">) {
    return (
        <div className="yt-page">
            <HistoryView query={await searchParams} />
        </div>
    );
}
