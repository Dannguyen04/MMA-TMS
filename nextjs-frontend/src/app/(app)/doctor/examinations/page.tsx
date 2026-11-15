import type { Metadata } from "next";

import { ExaminationsView } from "@/components/doctor/views/examinations-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.examinations") };
}

export default async function DoctorExaminationsPage({ searchParams }: PageProps<"/doctor/examinations">) {
    return (
        <div className="yt-page">
            <ExaminationsView query={await searchParams} />
        </div>
    );
}
