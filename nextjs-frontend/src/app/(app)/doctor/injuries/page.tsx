import type { Metadata } from "next";

import { InjuriesView } from "@/components/doctor/views/injuries-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.injuries") };
}

export default async function DoctorInjuriesPage({ searchParams }: PageProps<"/doctor/injuries">) {
    return (
        <div className="yt-page">
            <InjuriesView query={await searchParams} />
        </div>
    );
}
