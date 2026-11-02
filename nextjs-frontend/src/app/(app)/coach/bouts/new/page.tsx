import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { dayKey } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { listRulesets } from "@/lib/services/bouts";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";
import { BoutForm } from "./bout-form";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("coachBouts.new.title") };
}

export default async function NewBoutPage({ searchParams }: PageProps<"/coach/bouts/new">) {
    const user = await requireRole("coach");
    const [params, { t }] = await Promise.all([searchParams, getTranslator()]);
    const [fighters, rulesets] = await Promise.all([listFighters(user), listRulesets()]);
    const requested = param(params.fighter);
    const fighterId = requested && canAccessFighter(user, requested) && fighters.some((fighter) => fighter.id === requested) ? requested : "";

    return (
        <>
            <PageHeader
                eyebrow={t("coachBouts.new.eyebrow")}
                back={{ href: routes.coach.bouts, label: t("coachBouts.new.back") }}
                title={t("coachBouts.new.title")}
                description={t("coachBouts.new.description")}
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
