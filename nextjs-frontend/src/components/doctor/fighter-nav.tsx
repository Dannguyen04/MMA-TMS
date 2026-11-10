"use client";

import { FilePlus2, HeartPulse, Plus, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";

import { useT } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

import { TAB_ACTIONS, fighterTabs, sectionFromSegments, tabOf, type FighterAction } from "./fighter-sections";

/**
 * The only part of the profile header that follows the URL: which tab is underlined and which actions show. It reads
 * the open segment on the client, so moving between tabs never re-renders or re-fetches the header itself.
 */
function useSection() {
    return sectionFromSegments(useSelectedLayoutSegments());
}

const ACTION: Record<FighterAction, { label: MessageKey; href: (fighterId: string) => string; Icon: LucideIcon }> = {
    "new-examination": { label: "doctorUi.action.newExamination", href: routes.doctor.fighterNewExamination, Icon: FilePlus2 },
    "new-clearance": { label: "doctorUi.action.newClearance", href: routes.doctor.fighterGrantClearance, Icon: ShieldCheck },
    "new-injury": { label: "doctorUi.action.newInjury", href: routes.doctor.fighterNewInjury, Icon: Plus },
    "new-recovery": { label: "doctorUi.action.newRecovery", href: routes.doctor.fighterNewRecoveryPlan, Icon: HeartPulse },
};

/** The current tab's actions; the one whose form is open shows as pressed. */
export function FighterActions({ fighterId }: { fighterId: string }) {
    const section = useSection();
    const t = useT();
    return (
        <div className="yt-head-actions">
            {TAB_ACTIONS[tabOf(section)].map((key) => {
                const { label, href, Icon } = ACTION[key];
                const open = section === key;
                return (
                    <Link key={key} href={href(fighterId)} className="yt-btn" data-v={open ? undefined : "primary"} aria-current={open ? "page" : undefined}>
                        <Icon aria-hidden />
                        {t(label)}
                    </Link>
                );
            })}
        </div>
    );
}

export function FighterTabs({ fighterId }: { fighterId: string }) {
    const current = tabOf(useSection());
    const t = useT();
    return (
        <nav className="hs-tabs" aria-label={t("doctorUi.tab.nav")}>
            {fighterTabs(fighterId).map((tab) => (
                <Link key={tab.key} href={tab.href} aria-current={tab.key === current ? "page" : undefined}>
                    {t(tab.label)}
                </Link>
            ))}
        </nav>
    );
}
