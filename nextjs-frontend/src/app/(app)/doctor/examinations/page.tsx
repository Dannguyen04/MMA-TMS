import { FilePlus2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { examKind } from "@/components/doctor/exam-meta";
import { OUTCOME, SCOPE, fmtDate } from "@/components/doctor/labels";
import { Empty, FighterFilter, PageHead, Panel, Pill } from "@/components/doctor/ui";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import type { ExaminationScope } from "@/lib/domain/medical-contract";
import { routes } from "@/lib/routes";
import { listExaminations } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Phiếu khám" };

/** Phiếu khám của mọi võ sĩ được giao: ghép `GET /fighters/:id/medical-examinations` từng võ sĩ (chưa có danh sách theo bác sĩ). */
export default async function DoctorExaminationsPage({ searchParams }: PageProps<"/doctor/examinations">) {
    const user = await requireRole("doctor");
    const query = await searchParams;
    const requested = param(query.fighter);
    const fighterId = requested && canAccessFighter(user, requested) ? requested : undefined;
    const scopeParam = param(query.scope);
    const scope: ExaminationScope | undefined = scopeParam === "TRAINING" || scopeParam === "COMPETITION" ? scopeParam : undefined;
    const [fighters, all] = await Promise.all([listFighters(user), listExaminations({ fighterIds: fighterId ? [fighterId] : accessibleFighterIds(user) })]);
    const nameOf = new Map(fighters.map((f) => [f.id, f.name]));
    const list = all.filter((e) => !scope || e.scope === scope);
    // "Hiện hành": phiếu mới nhất của mỗi võ sĩ trong cùng phạm vi (như findCurrentExamination của backend).
    const current = new Set<string>();
    const seen = new Set<string>();
    for (const e of all) {
        const key = `${e.fighterId}:${e.scope ?? "-"}`;
        if (!seen.has(key)) {
            seen.add(key);
            current.add(e.id);
        }
    }
    const hasScopes = all.some((e) => e.scope);
    const seg = (k: string | undefined, l: string) => (
        <Link href={`${routes.doctor.examinations}?${new URLSearchParams({ ...(fighterId && { fighter: fighterId }), ...(k && { scope: k }) })}`} aria-current={scope === k ? "page" : undefined}>
            {l}
        </Link>
    );
    const newHref = `${routes.doctor.newExamination}${fighterId ? `?fighter=${fighterId}` : ""}`;

    return (
        <div className="yt-page">
            <PageHead
                title="Phiếu khám"
                sub={`${list.length} phiếu · mới nhất trước`}
                actions={
                    <Link href={newHref} className="yt-btn" data-v="primary">
                        <FilePlus2 aria-hidden />
                        Tạo phiếu khám
                    </Link>
                }
            />
            <div className="yt-filters">
                <FighterFilter base={routes.doctor.examinations} fighters={fighters} current={fighterId} extra={{ scope }} />
                {hasScopes && (
                    <nav className="yt-segs" aria-label="Phạm vi">
                        {seg(undefined, "Mọi phạm vi")}
                        {seg("TRAINING", "Tập luyện")}
                        {seg("COMPETITION", "Thi đấu")}
                    </nav>
                )}
            </div>
            <Panel id="bang">
                {list.length === 0 ? (
                    <Empty
                        title="Chưa có phiếu khám"
                        action={
                            <Link href={newHref} className="yt-btn" data-v="primary">
                                Tạo phiếu khám đầu tiên
                            </Link>
                        }
                    >
                        Không có phiếu khám nào khớp bộ lọc này.
                    </Empty>
                ) : (
                    <div className="yt-tablewrap">
                        <table className="yt-table">
                            <thead>
                                <tr>
                                    <th>Ngày khám</th>
                                    <th>Võ sĩ</th>
                                    <th>Loại khám</th>
                                    {hasScopes && <th className="yt-hide-sm">Phạm vi</th>}
                                    <th>Kết luận</th>
                                    <th className="yt-hide-sm">Hiệu lực đến</th>
                                    <th className="yt-hide-sm">Tái khám</th>
                                    <th className="yt-hide-sm">Tình trạng</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((e, i) => (
                                    <tr key={e.id} style={{ ["--i" as string]: i }}>
                                        <td>
                                            <Link className="yt-rowlink" href={routes.doctor.examination(e.id)}>
                                                {fmtDate(e.date)}
                                            </Link>
                                        </td>
                                        <td>
                                            <Link className="yt-sublink" href={routes.doctor.fighter(e.fighterId)}>{nameOf.get(e.fighterId) ?? "Võ sĩ"}</Link>
                                        </td>
                                        <td>{e.type ? examKind(e) : "Không có chi tiết"}</td>
                                        {hasScopes && <td className="yt-hide-sm">{e.scope ? SCOPE[e.scope] : "—"}</td>}
                                        <td>
                                            <Pill tone={OUTCOME[e.outcome].tone}>{OUTCOME[e.outcome].label}</Pill>
                                        </td>
                                        <td className="yt-hide-sm">{e.validUntil ? fmtDate(e.validUntil) : <span className="yt-muted">Không giới hạn</span>}</td>
                                        <td className="yt-hide-sm">{e.followUpDate ? fmtDate(e.followUpDate) : <span className="yt-muted">Không</span>}</td>
                                        <td className="yt-hide-sm">{current.has(e.id) ? "Hiện hành" : <span className="yt-muted">Đã có phiếu mới hơn</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    );
}
