import { FilePlus2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SegmentMotion } from "@/components/ui/segment-motion";

import { examKind } from "@/components/doctor/exam-meta";
import { OUTCOME, SCOPE, fmtDate } from "@/components/doctor/labels";
import { Empty, ErrorBox, FighterFilter, Flash, PageHead, Panel, Pill } from "@/components/doctor/ui";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import type { ExaminationScope } from "@/lib/domain/medical-contract";
import type { MedicalExamination } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { listExaminations } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctor.examinations.title") };
}

/**
 * Phiếu khám của từng võ sĩ đọc riêng (T-059): dịch vụ y tế lỗi hoặc chậm với một võ sĩ thì chỉ thiếu phiếu của võ sĩ đó,
 * không làm sập cả trang. Phạm vi vẫn là các võ sĩ được giao; phiên hết hạn vẫn ném lỗi như cũ.
 */
async function readExaminations(fighterIds: string[] | "all"): Promise<{ list: MedicalExamination[]; failed: number }> {
    const reads = fighterIds === "all" ? [listExaminations({ fighterIds })] : fighterIds.map((id) => listExaminations({ fighterIds: [id] }));
    const results = await Promise.all(reads.map((read) => nullIfServiceFails(read)));
    // Mới nhất trước, như từng danh sách của dịch vụ; sort ổn định nên phiếu cùng ngày của một võ sĩ giữ thứ tự gốc.
    const list = results.flatMap((result) => result ?? []).sort((a, b) => b.date.localeCompare(a.date));
    return { list, failed: results.filter((result) => result === null).length };
}

/** Phiếu khám của mọi võ sĩ được giao: ghép `GET /fighters/:id/medical-examinations` từng võ sĩ (chưa có danh sách theo bác sĩ). */
export default async function DoctorExaminationsPage({ searchParams }: PageProps<"/doctor/examinations">) {
    const { t } = await getTranslator();
    const user = await requireRole("doctor");
    const query = await searchParams;
    const requested = param(query.fighter);
    const fighterId = requested && canAccessFighter(user, requested) ? requested : undefined;
    const scopeParam = param(query.scope);
    const scope: ExaminationScope | undefined = scopeParam === "TRAINING" || scopeParam === "COMPETITION" ? scopeParam : undefined;
    // Danh sách võ sĩ chỉ để hiện tên và bộ lọc: đọc hỏng thì trang vẫn hiện phiếu khám.
    const [roster, { list: all, failed }] = await Promise.all([nullIfServiceFails(listFighters(user)), readExaminations(fighterId ? [fighterId] : accessibleFighterIds(user))]);
    const fighters = roster ?? [];
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
                title={t("doctor.examinations.title")}
                sub={`${list.length} phiếu · mới nhất trước`}
                actions={
                    <Link href={newHref} className="yt-btn" data-v="primary">
                        <FilePlus2 aria-hidden />
                        Tạo phiếu khám
                    </Link>
                }
            />
            {failed > 0 && all.length > 0 && <Flash tone="amber" text={plural(t, "screens.doctor.examinations.partial", failed)} />}
            {roster === null && <Flash tone="amber" text={t("screens.doctor.examinations.namesUnavailable")} />}
            <div className="yt-filters">
                {roster && <FighterFilter base={routes.doctor.examinations} fighters={fighters} current={fighterId} extra={{ scope }} />}
                {hasScopes && (
                    <SegmentMotion className="yt-segs" aria-label="Phạm vi">
                        {seg(undefined, "Mọi phạm vi")}
                        {seg("TRAINING", "Tập luyện")}
                        {seg("COMPETITION", "Thi đấu")}
                    </SegmentMotion>
                )}
            </div>
            <Panel id="bang">
                {failed > 0 && all.length === 0 ? (
                    <ErrorBox
                        title={t("screens.doctor.examinations.failedTitle")}
                        action={
                            <Link href={`${routes.doctor.examinations}?${new URLSearchParams({ ...(fighterId && { fighter: fighterId }), ...(scope && { scope }) })}`} className="yt-btn">
                                {t("screens.doctor.examinations.reload")}
                            </Link>
                        }
                    >
                        {t("screens.doctor.examinations.failedBody")}
                    </ErrorBox>
                ) : list.length === 0 ? (
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
                        <table className="yt-table xm-table">
                            <thead>
                                <tr>
                                    <th>Ngày khám</th>
                                    <th className="yt-hide-sm">Võ sĩ</th>
                                    <th className="yt-hide-sm">Loại khám</th>
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
                                            {/* Dưới 768 px hai cột Võ sĩ và Loại khám ẩn đi, gộp thành một dòng ở đây để bảng vừa màn hình. */}
                                            <small className="yt-only-sm">{`${nameOf.get(e.fighterId) ?? "Võ sĩ"} · ${e.type ? examKind(e) : "Không có chi tiết"}`}</small>
                                        </td>
                                        <td className="yt-hide-sm">
                                            <Link className="yt-sublink" href={routes.doctor.fighter(e.fighterId)}>{nameOf.get(e.fighterId) ?? "Võ sĩ"}</Link>
                                        </td>
                                        <td className="yt-hide-sm">{e.type ? examKind(e) : "Không có chi tiết"}</td>
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
