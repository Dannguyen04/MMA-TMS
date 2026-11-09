import { Check, CircleCheck, ShieldX, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { TabNav } from "@/components/ui/tabs";
import { TONE_SOFT, TONE_TEXT } from "@/components/ui/tone";
import type { MedicalEligibility } from "@/lib/domain/medical-contract";
import type { Fighter } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import type { Triage } from "@/lib/services/doctor-board";
import { cn } from "@/lib/utils";
import { fmeta } from "./labels";
import { reasonsText } from "./ui";

const WORD: Record<Triage, string> = { red: "Chặn", amber: "Theo dõi", green: "Thông" };
const TAG = { red: { tone: "danger", icon: ShieldX }, amber: { tone: "warning", icon: TriangleAlert }, green: { tone: "success", icon: CircleCheck } } as const;

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
        <div className="flex flex-col gap-4">
            <PageHeader
                className="mb-0 sm:mb-0"
                back={{ href: routes.doctor.fighters, label: "Võ sĩ" }}
                title={fighter.name}
                description={`${fmeta(fighter)}${fighter.heightCm ? ` · ${fighter.heightCm} cm` : ""}${fighter.reachCm ? ` · sải tay ${fighter.reachCm} cm` : ""}`}
                actions={actions}
                meta={
                    <>
                        <Badge tone={TAG[tag].tone} icon={TAG[tag].icon}>
                            Thẻ hôm nay: {WORD[tag]}
                        </Badge>
                        {gates.length > 0 && (
                            <ul className="flex flex-wrap gap-2">
                                {gates.map(([l, e]) => {
                                    const tone = e!.eligible ? "success" : "danger";
                                    const Icon = e!.eligible ? Check : X;
                                    return (
                                        <li key={l} className={cn("inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-[13px] ring-1 ring-inset", TONE_SOFT[tone])}>
                                            <Icon aria-hidden className={cn("size-3.5 shrink-0", TONE_TEXT[tone])} strokeWidth={2.25} />
                                            <b className="font-semibold">{l}</b>
                                            <span className="min-w-0">{e!.eligible ? "Đủ điều kiện" : reasonsText(e).join(" · ")}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </>
                }
            />
            <TabNav label="Mục hồ sơ" items={fighterTabs(fighter.id).map((t) => ({ href: t.href, label: t.label, exact: t.key === "overview" }))} />
        </div>
    );
}
