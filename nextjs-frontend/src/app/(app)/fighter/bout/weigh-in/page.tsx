import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { activeBout } from "@/lib/domain/weigh-in";
import { formatNumber, formatShortDate } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { listBouts } from "@/lib/services/bouts";
import { WeighInForm } from "./weigh-in-form";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("weighIn.metaTitle") };
}

/** Today's weigh-in, built for a phone: one number, one button. */
export default async function FighterWeighInPage() {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const [fighter, { t, locale }] = await Promise.all([requireFighterAccess(user, user.profileId), getTranslator()]);
    const bouts = await nullIfServiceFails(listBouts({ fighterIds: [fighter.id] }));
    const bout = bouts ? activeBout(bouts) : null;
    const limitKg = bout ? (bout.catchweightKg ?? bout.weightLimitKg) : null;
    const latest = bout?.weight?.latestKg ?? null;
    const facts = [
        latest !== null && bout?.weight?.latestOn
            ? t("weighIn.last", { kg: formatNumber(latest, 1), date: formatShortDate(`${bout.weight.latestOn}T12:00:00+07:00`, locale) })
            : null,
        limitKg !== null ? t("weighIn.limit", { kg: formatNumber(limitKg, 1) }) : null,
    ].filter((fact): fact is string => fact !== null);

    return (
        <div className="mx-auto w-full max-w-md">
            <PageHeader
                back={bout ? { href: routes.fighter.bout, label: t("weighIn.back.bout") } : { href: routes.fighter.dashboard, label: t("weighIn.back.today") }}
                title={t("weighIn.title")}
                description={facts.length > 0 ? facts.join(" · ") : undefined}
            />
            <Card className="min-w-0">
                <CardContent className="pt-4">
                    <WeighInForm />
                </CardContent>
            </Card>
        </div>
    );
}
