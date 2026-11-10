import { ArrowLeft, Ban, Check, X } from "lucide-react";
import Link from "next/link";

import type { MedicalEligibility } from "@/lib/domain/medical-contract";
import type { Fighter } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import type { BoardItem, Triage } from "@/lib/services/doctor-board";
import { FighterActions, FighterTabs } from "./fighter-nav";
import { fmeta } from "./labels";
import { reasonsText } from "./ui";

const WORD: Record<Triage, string> = { red: "Chặn", amber: "Theo dõi", green: "Thông qua" };

export type GateTone = "ok" | "block" | "warn";

export interface HeaderGate {
    key: "training" | "competition" | "suspension";
    label: string;
    tone: GateTone;
    text: string;
}

/**
 * Dòng điều kiện ở đầu hồ sơ: tập luyện, thi đấu, và đình chỉ khi còn cần xử lý.
 * Màu đình chỉ lấy từ cùng quy tắc với thẻ phân loại, nên đầu hồ sơ không bao giờ trái với màu thẻ.
 */
export function headerGates(training: MedicalEligibility | null, competition: MedicalEligibility | null, items: readonly BoardItem[] = []): HeaderGate[] {
    const gates: HeaderGate[] = [];
    for (const [key, label, e] of [["training", "Tập luyện", training], ["competition", "Thi đấu", competition]] as const) {
        if (e) gates.push({ key, label, tone: e.eligible ? "ok" : "block", text: e.eligible ? "Đủ điều kiện" : reasonsText(e).join(" · ") });
    }
    const suspension = items.find((item) => item.kind === "suspension");
    if (suspension) gates.push({ key: "suspension", label: "Đình chỉ", tone: suspension.tone === "red" ? "block" : "warn", text: suspension.text });
    return gates;
}

const GATE_ICON = { ok: Check, block: X, warn: Ban } as const;

export { fighterTabs, type FighterSection, type FighterTab } from "./fighter-sections";

/**
 * The fighter's header: card, name and gates are rendered once by the profile layout; the tabs and form buttons are
 * small client components that only follow the URL.
 */
export function FighterHead({
    fighter,
    training,
    competition,
    tag,
    items = [],
}: {
    fighter: Fighter;
    training: MedicalEligibility | null;
    competition: MedicalEligibility | null;
    tag: Triage;
    /** Việc mở của võ sĩ trên bảng phân loại; dùng để hiện đình chỉ. */
    items?: readonly BoardItem[];
}) {
    const gates = headerGates(training, competition, items);
    return (
        <>
            <Link href={routes.doctor.fighters} className="yt-back">
                <ArrowLeft aria-hidden />
                Võ sĩ
            </Link>
            <div className="hs-top" data-shot="header">
                <div className="hs-id">
                    <div className="hs-tag" data-tag={tag} role="img" aria-label={`Thẻ ${WORD[tag]}`}>
                        <span className="yt-hole" aria-hidden />
                        <b>{WORD[tag]}</b>
                        <small>Thẻ hôm nay</small>
                    </div>
                    <div>
                        <h1>{fighter.name}</h1>
                        <p>
                            {fmeta(fighter)}
                            {fighter.heightCm ? ` · ${fighter.heightCm} cm` : ""}
                            {fighter.reachCm ? ` · sải tay ${fighter.reachCm} cm` : ""}
                        </p>
                        {gates.length > 0 && (
                            <ul className="hs-gates">
                                {gates.map((g) => {
                                    const Icon = GATE_ICON[g.tone];
                                    return (
                                        <li key={g.key} data-tone={g.tone}>
                                            <Icon aria-hidden />
                                            <b>{g.label}</b>
                                            {g.text}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
                <FighterActions fighterId={fighter.id} />
            </div>
            <FighterTabs fighterId={fighter.id} />
        </>
    );
}
