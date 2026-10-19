import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { dayKey } from "@/lib/format";
import { routes } from "@/lib/routes";
import { listRulesets } from "@/lib/services/bouts";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";
import { BoutForm } from "./bout-form";

export const metadata: Metadata = { title: "New bout" };

export default async function NewBoutPage({ searchParams }: PageProps<"/coach/bouts/new">) {
    const user = await requireRole("coach");
    const params = await searchParams;
    const [fighters, rulesets] = await Promise.all([listFighters(user), listRulesets()]);
    const requested = param(params.fighter);
    const fighterId = requested && canAccessFighter(user, requested) && fighters.some((fighter) => fighter.id === requested) ? requested : "";

    return (
        <>
            <PageHeader
                eyebrow="New bout"
                back={{ href: routes.coach.bouts, label: "Bouts" }}
                title="Create a bout"
                description="When the club accepts a bout. The fighter sees it on their Bout page, and the camp, weight and checklist start from here."
            />
            <BoutForm
                fighters={fighters.map((fighter) => ({ id: fighter.id, name: fighter.name }))}
                rulesets={rulesets}
                todayOn={dayKey(new Date())}
                defaults={{ fighterId, rulesetId: "", weightClassCode: "", weightLimitKg: "", event: "", venue: "", opponent: "", weighInAt: "", boutAt: "" }}
            />
        </>
    );
}
