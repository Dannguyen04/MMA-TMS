import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { createBoutAction } from "@/lib/actions/bouts";
import { requireRole } from "@/lib/auth/session";
import { toDateTimeInputValue } from "@/lib/format";
import { fromToday } from "@/lib/mocks/time";
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

    const requestedFighterId = param(params.fighter);
    const prefilledFighter = fighters.find((f) => f.id === requestedFighterId);

    // Default dates: weigh-in 30 days from now at 09:00, bout 31 days from now at 19:00
    const defaultWeighIn = toDateTimeInputValue(fromToday(30, 9, 0));
    const defaultBout = toDateTimeInputValue(fromToday(31, 19, 0));

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="New bout"
                description="Schedule an upcoming fight for a fighter on your roster and initiate fight camp tracking."
                back={{ href: routes.coach.bouts, label: "Bouts" }}
            />
            <BoutForm
                fighters={fighters.map((f) => ({ id: f.id, name: f.name }))}
                rulesets={rulesets}
                action={createBoutAction}
                defaultFighterId={prefilledFighter?.id ?? ""}
                defaultWeighInAt={defaultWeighIn}
                defaultBoutAt={defaultBout}
            />
        </div>
    );
}
