import { FilePlus2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { examKind } from "@/components/doctor/exam-meta";
import { OUTCOME, SCOPE, fmtDate } from "@/components/doctor/labels";
import { CELL_SUB, Empty, ErrorBox, FighterFilter, Flash, PageHead, Pill, ROW, ROW_LINK, SUB_LINK } from "@/components/doctor/ui";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
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
import { cn, param } from "@/lib/utils";

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
    const segHref = (k: string | undefined) => `${routes.doctor.examinations}?${new URLSearchParams({ ...(fighterId && { fighter: fighterId }), ...(k && { scope: k }) })}`;
    const newHref = `${routes.doctor.newExamination}${fighterId ? `?fighter=${fighterId}` : ""}`;

    return (
        <div className="flex flex-col gap-6">
            <PageHead
                title={t("doctor.examinations.title")}
                sub={`${list.length} phiếu · mới nhất trước`}
                actions={
                    <ButtonLink href={newHref}>
                        <FilePlus2 aria-hidden />
                        Tạo phiếu khám
                    </ButtonLink>
                }
            />
            {failed > 0 && all.length > 0 && <Flash tone="amber" text={plural(t, "screens.doctor.examinations.partial", failed)} />}
            {roster === null && <Flash tone="amber" text={t("screens.doctor.examinations.namesUnavailable")} />}
            <div className="flex min-w-0 flex-wrap items-center gap-3">
                {roster && <FighterFilter base={routes.doctor.examinations} fighters={fighters} current={fighterId} extra={{ scope }} />}
                {hasScopes && (
                    <SegmentedLinks
                        label="Phạm vi"
                        className="max-w-full"
                        items={[
                            { k: undefined, l: "Mọi phạm vi" },
                            { k: "TRAINING", l: "Tập luyện" },
                            { k: "COMPETITION", l: "Thi đấu" },
                        ].map(({ k, l }) => ({ href: segHref(k), label: l, active: scope === k }))}
                    />
                )}
            </div>
            {failed > 0 && all.length === 0 ? (
                <ErrorBox
                    title={t("screens.doctor.examinations.failedTitle")}
                    action={
                        <ButtonLink href={`${routes.doctor.examinations}?${new URLSearchParams({ ...(fighterId && { fighter: fighterId }), ...(scope && { scope }) })}`} variant="secondary">
                            {t("screens.doctor.examinations.reload")}
                        </ButtonLink>
                    }
                >
                    {t("screens.doctor.examinations.failedBody")}
                </ErrorBox>
            ) : list.length === 0 ? (
                <Empty
                    title="Chưa có phiếu khám"
                    action={
                        <ButtonLink href={newHref}>
                            Tạo phiếu khám đầu tiên
                        </ButtonLink>
                    }
                >
                    Không có phiếu khám nào khớp bộ lọc này.
                </Empty>
            ) : (
                <Card className="overflow-hidden">
                    <Table>
                        <THead>
                            <tr>
                                <TH>Ngày khám</TH>
                                <TH className="max-md:hidden">Võ sĩ</TH>
                                <TH className="max-md:hidden">Loại khám</TH>
                                {hasScopes && <TH className="max-md:hidden">Phạm vi</TH>}
                                <TH>Kết luận</TH>
                                <TH className="max-md:hidden">Hiệu lực đến</TH>
                                <TH className="max-md:hidden">Tái khám</TH>
                                <TH className="max-md:hidden">Tình trạng</TH>
                            </tr>
                        </THead>
                        <TBody>
                            {list.map((e) => (
                                <TR key={e.id} className={ROW}>
                                    <TD>
                                        <Link className={ROW_LINK} href={routes.doctor.examination(e.id)}>
                                            {fmtDate(e.date)}
                                        </Link>
                                        {/* Dưới 768 px hai cột Võ sĩ và Loại khám ẩn đi, gộp thành một dòng ở đây để bảng vừa màn hình. */}
                                        <small className={cn(CELL_SUB, "md:hidden")}>{`${nameOf.get(e.fighterId) ?? "Võ sĩ"} · ${e.type ? examKind(e) : "Không có chi tiết"}`}</small>
                                    </TD>
                                    <TD className="max-md:hidden">
                                        <Link className={SUB_LINK} href={routes.doctor.fighter(e.fighterId)}>
                                            {nameOf.get(e.fighterId) ?? "Võ sĩ"}
                                        </Link>
                                    </TD>
                                    <TD className="max-md:hidden">{e.type ? examKind(e) : "Không có chi tiết"}</TD>
                                    {hasScopes && <TD className="max-md:hidden">{e.scope ? SCOPE[e.scope] : "—"}</TD>}
                                    <TD>
                                        <Pill tone={OUTCOME[e.outcome].tone}>{OUTCOME[e.outcome].label}</Pill>
                                    </TD>
                                    <TD className="max-md:hidden">{e.validUntil ? fmtDate(e.validUntil) : <span className="text-fg-muted">Không giới hạn</span>}</TD>
                                    <TD className="max-md:hidden">{e.followUpDate ? fmtDate(e.followUpDate) : <span className="text-fg-muted">Không</span>}</TD>
                                    <TD className="max-md:hidden">{current.has(e.id) ? "Hiện hành" : <span className="text-fg-muted">Đã có phiếu mới hơn</span>}</TD>
                                </TR>
                            ))}
                        </TBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
