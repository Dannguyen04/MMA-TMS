import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { UploadWizard } from "@/components/video/upload-wizard";
import { loadUploadWizardData } from "@/components/video/upload-wizard-data";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.video.page.uploadVideo") };
}

export default async function FighterUploadVideoPage({ searchParams }: PageProps<"/fighter/videos/upload">) {
    const { t } = await getTranslator();
    const user = await requireRole("fighter");
    const params = await searchParams;
    const data = await loadUploadWizardData(user);

    return (
        <>
            <PageHeader
                back={{ href: routes.fighter.videos, label: t("screens.video.page.film") }}
                title={t("screens.video.page.uploadTitle")}
                description={t("screens.video.page.uploadDescFighter")}
            />
            <UploadWizard
                role="fighter"
                viewerId={user.id}
                {...data}
                initialFighterId={user.profileId}
                initialSessionId={param(params.session) ?? null}
                cancelHref={routes.fighter.videos}
            />
        </>
    );
}
