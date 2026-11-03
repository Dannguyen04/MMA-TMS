import { ArrowLeft, Check, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { MedicalEligibility } from "@/lib/domain/medical-contract";
import type { Fighter } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import type { Triage } from "@/lib/services/doctor-board";
import { fmeta } from "./labels";
import { reasonsText } from "./ui";

const WORD: Record<Triage, string> = { red: "Chặn", amber: "Theo dõi", green: "Thông" };

export function fighterTabs(fighterId: string) {
    const q = `?fighter=${fighterId}`;
    return [
        { key: "overview", label: "Tổng quan", href: routes.doctor.fighter(fighterId) },
        { key: "exams", label: "Phiếu khám", href: routes.doctor.examinations + q },
        { key: "injuries", label: "Chấn thương", href: routes.doctor.injuries + q },
        { key: "recovery", label: "Phục hồi", href: routes.doctor.recovery + q },
        { key: "clearance", label: "Giấy phép", href: routes.doctor.clearance + q },
        { key: "history", label: "Lịch sử", href: routes.doctor.history + q },
    ];
}

export function FighterHead({ fighter, training, competition, tag, actions }: { fighter: Fighter; training: MedicalEligibility | null; competition: MedicalEligibility | null; tag: Triage; actions?: ReactNode }) {
    const gates = ([["Tập luyện", training], ["Thi đấu", competition]] as const).filter(([, e]) => e !== null);
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
                                {gates.map(([l, e]) => (
                                    <li key={l} data-ok={e!.eligible}>
                                        {e!.eligible ? <Check aria-hidden /> : <X aria-hidden />}
                                        <b>{l}</b>
                                        {e!.eligible ? "Đủ điều kiện" : reasonsText(e).join(" · ")}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                {actions && <div className="yt-head-actions">{actions}</div>}
            </div>
            <nav className="hs-tabs" aria-label="Mục hồ sơ">
                {fighterTabs(fighter.id).map((t) => (
                    <Link key={t.key} href={t.href} aria-current={t.key === "overview" ? "page" : undefined}>
                        {t.label}
                    </Link>
                ))}
            </nav>
        </>
    );
}
