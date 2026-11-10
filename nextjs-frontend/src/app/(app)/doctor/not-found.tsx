import Link from "next/link";

import { Empty } from "@/components/doctor/ui";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";

export default async function DoctorNotFound() {
    const { t } = await getTranslator();
    return (
        <div className="yt-page">
            <Empty
                title={t("doctorPages.notFound.title")}
                action={
                    <Link href={routes.doctor.dashboard} className="yt-btn" data-v="primary">
                        {t("doctorPages.notFound.back")}
                    </Link>
                }
            >
                {t("doctorPages.notFound.body")}
            </Empty>
        </div>
    );
}
