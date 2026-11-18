import { FilePlus2 } from "lucide-react";
import Link from "next/link";

import { examKind } from "@/components/doctor/exam-meta";
import { OUTCOME, SCOPE, fmtDate } from "@/components/doctor/labels";
import { Empty, ErrorBox, FighterFilter, Flash, Panel, Pill } from "@/components/doctor/ui";

import { ListHead } from "./list-head";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import type { ExaminationScope } from "@/lib/domain/medical-contract";
import type { MedicalExamination } from "@/lib/domain/types";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { listExaminations } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

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
export async function ExaminationsView({ query, fighterId: scopedId }: { query: Record<string, string | string[] | undefined>; fighterId?: string }) {
    const { t, locale } = await getTranslator();
    const user = await requireRole("doctor");
    const requested = scopedId ?? param(query.fighter);
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
        <Link href={`${base}?${new URLSearchParams({ ...(fighterId && !scopedId && { fighter: fighterId }), ...(k && { scope: k }) })}`} aria-current={scope === k ? "page" : undefined}>
            {l}
        </Link>
    );
    // Inside a fighter's profile the filters, links and new-examination form stay on that fighter.
    const base = scopedId ? routes.doctor.fighterExaminations(scopedId) : routes.doctor.examinations;
    const newHref = scopedId ? routes.doctor.fighterNewExamination(scopedId) : `${routes.doctor.newExamination}${fighterId ? `?fighter=${fighterId}` : ""}`;

    return (
        <>
            <ListHead
                scoped={!!scopedId}
                title={t("doctorViews.exams.title")}
                sub={t("doctorViews.exams.sub", { n: list.length })}
                actions={
                    <Link href={newHref} className="yt-btn" data-v="primary">
                        <FilePlus2 aria-hidden />
                        {t("doctorViews.exams.new")}
                    </Link>
                }
            />
            {failed > 0 && all.length > 0 && <Flash text={plural(t, "screens.doctor.examinations.partial", failed)} />}
            {roster === null && <Flash text={t("screens.doctor.examinations.namesUnavailable")} />}
            <div className="yt-filters">
                {!scopedId && roster && <FighterFilter base={routes.doctor.examinations} fighters={fighters} current={fighterId} extra={{ scope }} t={t} />}
                {hasScopes && (
                    <nav className="yt-segs" aria-label={t("doctorViews.exams.scope")}>
                        {seg(undefined, t("doctorViews.exams.scopeAll"))}
                        {seg("TRAINING", t("doctorViews.exams.scopeTraining"))}
                        {seg("COMPETITION", t("doctorViews.exams.scopeCompetition"))}
                    </nav>
                )}
            </div>
            <Panel id="bang">
                {failed > 0 && all.length === 0 ? (
                    <ErrorBox
                        title={t("screens.doctor.examinations.failedTitle")}
                        action={
                            <Link href={`${base}?${new URLSearchParams({ ...(fighterId && !scopedId && { fighter: fighterId }), ...(scope && { scope }) })}`} className="yt-btn">
                                {t("screens.doctor.examinations.reload")}
                            </Link>
                        }
                    >
                        {t("screens.doctor.examinations.failedBody")}
                    </ErrorBox>
                ) : list.length === 0 ? (
                    <Empty
                        title={t("doctorViews.exams.emptyTitle")}
                        action={
                            <Link href={newHref} className="yt-btn" data-v="primary">
                                {t("doctorViews.exams.newFirst")}
                            </Link>
                        }
                    >
                        {t("doctorViews.exams.emptyBody")}
                    </Empty>
                ) : (
                    <div className="yt-tablewrap">
                        <table className="yt-table">
                            <thead>
                                <tr>
                                    <th>{t("doctorViews.exams.colDate")}</th>
                                    {!scopedId && <th>{t("doctorViews.common.fighter")}</th>}
                                    <th>{t("doctorViews.exams.colType")}</th>
                                    {hasScopes && <th className="yt-hide-sm">{t("doctorViews.exams.scope")}</th>}
                                    <th>{t("doctorViews.exams.colOutcome")}</th>
                                    <th className="yt-hide-sm">{t("doctorViews.exams.colValidUntil")}</th>
                                    <th className="yt-hide-sm">{t("doctorViews.exams.colFollowUp")}</th>
                                    <th className="yt-hide-sm">{t("doctorViews.exams.colStatus")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((e, i) => (
                                    <tr key={e.id} style={{ ["--i" as string]: i }}>
                                        <td>
                                            <Link className="yt-rowlink" href={routes.doctor.fighterExamination(e.fighterId, e.id)}>
                                                {fmtDate(e.date, locale)}
                                            </Link>
                                        </td>
                                        {!scopedId && (
                                            <td>
                                                <Link className="yt-sublink" href={routes.doctor.fighter(e.fighterId)}>{nameOf.get(e.fighterId) ?? t("doctorViews.common.fighter")}</Link>
                                            </td>
                                        )}
                                        <td>{e.type ? examKind(t, e) : t("doctorViews.exams.noDetail")}</td>
                                        {hasScopes && <td className="yt-hide-sm">{e.scope ? t(SCOPE[e.scope]) : "—"}</td>}
                                        <td>
                                            <Pill tone={OUTCOME[e.outcome].tone}>{t(OUTCOME[e.outcome].label)}</Pill>
                                        </td>
                                        <td className="yt-hide-sm">{e.validUntil ? fmtDate(e.validUntil, locale) : <span className="yt-muted">{t("doctorViews.clearance.noLimit")}</span>}</td>
                                        <td className="yt-hide-sm">{e.followUpDate ? fmtDate(e.followUpDate, locale) : <span className="yt-muted">{t("doctorViews.exams.none")}</span>}</td>
                                        <td className="yt-hide-sm">{current.has(e.id) ? t("doctorViews.exams.current") : <span className="yt-muted">{t("doctorViews.exams.superseded")}</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </>
    );
}
