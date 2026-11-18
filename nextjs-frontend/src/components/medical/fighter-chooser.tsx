import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";

import { HealthStatusBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import type { Fighter } from "@/lib/domain/types";
import { getTranslator } from "@/lib/i18n/server";

import { badgeLocale } from "./examination-presets";

export interface FighterChooserProps {
    fighters: Fighter[];
    /** Link for a chosen fighter, e.g. the same form with ?fighter=. */
    hrefFor: (fighterId: string) => string;
    /** The question the form asks, e.g. "Who did you examine?". */
    title: string;
    /** A fighter was chosen but their medical record couldn't be read: the chooser asks again and says why. */
    unreadable?: Fighter;
}

/**
 * First step of a clinical form: pick the fighter. Every clinical read is audited, so a form loads one fighter's
 * record after this choice instead of every assigned fighter's up front.
 */
export async function FighterChooser({ fighters, hrefFor, title, unreadable }: FighterChooserProps) {
    const { t } = await getTranslator();
    return (
        <Card className="max-w-2xl overflow-hidden">
            <CardHeader
                title={unreadable ? t("doctorMedical.chooser.unreadableTitle", { name: unreadable.name }) : title}
                description={unreadable ? t("doctorMedical.chooser.unreadableDesc") : t("doctorMedical.chooser.desc")}
                icon={<Users />}
            />
            {fighters.length === 0 ? (
                <EmptyState compact icon={<Users />} title={t("doctorMedical.chooser.emptyTitle")} description={t("doctorMedical.chooser.emptyDesc")} className="border-t border-border" />
            ) : (
                <ul className="divide-y divide-border border-t border-border">
                    {[...fighters]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((fighter) => (
                            <li key={fighter.id}>
                                <Link href={hrefFor(fighter.id)} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover">
                                    <Avatar name={fighter.name} shape="octagon" size="sm" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-fg">{fighter.name}</span>
                                        <span className="block text-[13px] text-fg-muted">{t(`weightClass.${fighter.weightClass}`)}</span>
                                    </span>
                                    <HealthStatusBadge locale={badgeLocale(t)} status={fighter.healthStatus} size="sm" />
                                    <ChevronRight aria-hidden className="size-4 text-fg-subtle" />
                                </Link>
                            </li>
                        ))}
                </ul>
            )}
        </Card>
    );
}
