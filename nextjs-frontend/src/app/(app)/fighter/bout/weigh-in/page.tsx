import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WeighInForm } from "@/components/domain/weigh-in-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("boutFighter.weighIn.title") };
}

export default async function WeighInPage() {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const { t } = await getTranslator();

    return (
        <>
            <PageHeader
                back={{ href: routes.fighter.bout, label: t("boutFighter.weighIn.back") }}
                title={t("boutFighter.weighIn.title")}
                description={t("boutFighter.weighIn.description")}
            />
            <WeighInForm />
        </>
    );
}
