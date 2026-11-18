import type { Metadata } from "next";

import { RecoveryView } from "@/components/doctor/views/recovery-view";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.recoveryPlans") };
}

export default async function DoctorRecoveryPage({ searchParams }: PageProps<"/doctor/recovery">) {
    return (
        <div className="yt-page">
            <RecoveryView query={await searchParams} />
        </div>
    );
}
