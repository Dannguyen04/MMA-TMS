import { Scale } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { activeBout } from "@/lib/domain/weigh-in";
import { formatDate, formatNumber } from "@/lib/format";
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

    return (
        <div className="mx-auto w-full max-w-md">
            <PageHeader
                eyebrow="Weigh-in"
                back={bout ? { href: routes.fighter.bout, label: "Bout" } : { href: routes.fighter.dashboard, label: "Today" }}
                title="Log today's weight"
            />
            <Card className="min-w-0">
                <CardHeader
                    title="Morning weight"
                    description={
                        limitKg !== null
                            ? `Limit ${formatNumber(limitKg, 1)} kg · weigh-in ${formatDate(bout!.weighInAt)}`
                            : "Recorded for today. Logging again today replaces today's number."
                    }
                    icon={<Scale aria-hidden />}
                />
                <CardContent className="flex flex-col gap-4">
                    {latest !== null && bout?.weight?.latestOn && (
                        <p className="text-sm text-fg-muted">
                            Last logged {formatNumber(latest, 1)} kg on {formatDate(`${bout.weight.latestOn}T12:00:00+07:00`)}.
                        </p>
                    )}
                    <WeighInForm />
                </CardContent>
            </Card>
        </div>
    );
}
