import { Upload } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PerformanceOverview } from "@/components/performance/performance-overview";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireFighterId } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.performance.title") };
}

export default async function FighterPerformancePage() {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighterId = requireFighterId(user, user.profileId);
    const { t } = await getTranslator();

    return (
        <>
            <PageHeader title={t("screens.performance.title")} description={t("screens.performance.fighterPerformance.desc")} />
            <PerformanceOverview
                fighterId={fighterId}
                fighterName={user.name}
                audience="fighter"
                headingLevel={2}
                techniqueHref={routes.fighter.technique}
                emptyAction={
                    <ButtonLink href={routes.fighter.uploadVideo}>
                        <Upload aria-hidden />
                        {t("screens.performance.uploadVideo")}
                    </ButtonLink>
                }
            />
        </>
    );
}
