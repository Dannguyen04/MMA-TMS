"use client";

import { FilePlus2, HeartPulse, Plus, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";

import { routes } from "@/lib/routes";

import { TAB_ACTIONS, fighterTabs, sectionFromSegments, tabOf, type FighterAction } from "./fighter-sections";

/**
 * The only part of the profile header that follows the URL: which tab is underlined and which actions show. It reads
 * the open segment on the client, so moving between tabs never re-renders or re-fetches the header itself.
 */
function useSection() {
    return sectionFromSegments(useSelectedLayoutSegments());
}

const ACTION: Record<FighterAction, { label: string; href: (fighterId: string) => string; Icon: LucideIcon }> = {
    "new-examination": { label: "Tạo phiếu khám", href: routes.doctor.fighterNewExamination, Icon: FilePlus2 },
    "new-clearance": { label: "Cấp giấy phép", href: routes.doctor.fighterGrantClearance, Icon: ShieldCheck },
    "new-injury": { label: "Ghi nhận chấn thương", href: routes.doctor.fighterNewInjury, Icon: Plus },
    "new-recovery": { label: "Lập kế hoạch phục hồi", href: routes.doctor.fighterNewRecoveryPlan, Icon: HeartPulse },
};

/** The current tab's actions; the one whose form is open shows as pressed. */
export function FighterActions({ fighterId }: { fighterId: string }) {
    const section = useSection();
    return (
        <div className="yt-head-actions">
            {TAB_ACTIONS[tabOf(section)].map((key) => {
                const { label, href, Icon } = ACTION[key];
                const open = section === key;
                return (
                    <Link key={key} href={href(fighterId)} className="yt-btn" data-v={open ? undefined : "primary"} aria-current={open ? "page" : undefined}>
                        <Icon aria-hidden />
                        {label}
                    </Link>
                );
            })}
        </div>
    );
}

export function FighterTabs({ fighterId }: { fighterId: string }) {
    const current = tabOf(useSection());
    return (
        <nav className="hs-tabs" aria-label="Mục hồ sơ">
            {fighterTabs(fighterId).map((t) => (
                <Link key={t.key} href={t.href} aria-current={t.key === current ? "page" : undefined}>
                    {t.label}
                </Link>
            ))}
        </nav>
    );
}
