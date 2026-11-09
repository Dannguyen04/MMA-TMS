import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { LiveFormCheck } from "@/components/video/live-form-check";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.video.page.liveCheck") };
}

export default async function FighterLiveFormCheckPage() {
    await requireRole("fighter");
    const { t } = await getTranslator();
    return (
        <>
            <PageHeader
                back={{ href: routes.fighter.videos, label: t("screens.video.page.film") }}
                eyebrow={t("screens.video.page.beta")}
                title={t("screens.video.page.liveCheck")}
                description={t("screens.video.page.liveCheckDesc")}
            />
            <LiveFormCheck />
        </>
    );
}
