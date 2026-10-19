import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { activeBout } from "@/lib/domain/weigh-in";
import { formatNumber, formatShortDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { listBouts } from "@/lib/services/bouts";
import { WeighInForm } from "./weigh-in-form";

export const metadata: Metadata = { title: "Log weight" };

/** Today's weigh-in, built for a phone: one number, one button. */
export default async function FighterWeighInPage() {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighter = await requireFighterAccess(user, user.profileId);
    const bouts = await nullIfServiceFails(listBouts({ fighterIds: [fighter.id] }));
    const bout = bouts ? activeBout(bouts) : null;
    const limitKg = bout ? (bout.catchweightKg ?? bout.weightLimitKg) : null;
    const latest = bout?.weight?.latestKg ?? null;
    const facts = [
        latest !== null && bout?.weight?.latestOn ? `Last ${formatNumber(latest, 1)} kg on ${formatShortDate(`${bout.weight.latestOn}T12:00:00+07:00`)}` : null,
        limitKg !== null ? `limit ${formatNumber(limitKg, 1)} kg` : null,
    ].filter((fact): fact is string => fact !== null);

    return (
        <div className="mx-auto w-full max-w-md">
            <PageHeader
                back={bout ? { href: routes.fighter.bout, label: "Bout" } : { href: routes.fighter.dashboard, label: "Today" }}
                title="Log today's weight"
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
