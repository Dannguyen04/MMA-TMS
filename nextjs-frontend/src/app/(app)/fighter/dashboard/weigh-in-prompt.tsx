import { Scale } from "lucide-react";
import Link from "next/link";

import { WeightWarningBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Bout } from "@/lib/domain/types";
import { dayKey, formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";

/** Top of Today during a bout: today's weight status and the one action that keeps it current. */
export function WeighInPrompt({ bout, now }: { bout: Bout; now: string }) {
    const weight = bout.weight;
    const loggedToday = weight?.latestOn === dayKey(now);
    const limitKg = bout.catchweightKg ?? bout.weightLimitKg;

    return (
        <Card className="min-w-0">
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden className="mt-0.5 text-primary-soft-fg [&_svg]:size-5">
                        <Scale />
                    </span>
                    <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-display text-[19px] leading-6 font-bold text-fg">
                            <Link href={routes.fighter.bout} className="hover:underline">
                                {bout.eventName}
                            </Link>
                            <WeightWarningBadge status={weight?.status ?? "GREY"} size="sm" />
                        </p>
                        <p className="mt-0.5 text-sm text-fg-muted">
                            {weight?.latestKg != null ? `${formatNumber(weight.latestKg, 1)} kg` : "No weigh-in yet"} · limit {formatNumber(limitKg, 1)} kg
                            {loggedToday ? " · done today" : ""}
                        </p>
                    </div>
                </div>
                <ButtonLink href={routes.fighter.weighIn} size="lg" variant={loggedToday ? "secondary" : "primary"} className="w-full sm:w-auto">
                    <Scale aria-hidden />
                    Log today&apos;s weight
                </ButtonLink>
            </div>
        </Card>
    );
}
