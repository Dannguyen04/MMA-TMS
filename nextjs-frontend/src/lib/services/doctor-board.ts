import "server-only";

import { cache } from "react";

import { accessibleFighterIds } from "@/lib/auth/access";
import { SUSPENSION_REASON_LABELS } from "@/lib/domain/labels";
import type { MedicalEligibility } from "@/lib/domain/medical-contract";
import { academyDateOf, addDaysToDate, isInForceOn, REHAB_TRIGGER_SUSPENSION_REASONS } from "@/lib/domain/suspension-rules";
import type { AbnormalMovementAlert, Fighter, GradedReturn, Suspension, SuspensionReason, User } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import { getSettings } from "./admin";
import { listAlerts } from "./ai";
import { nullIfServiceFails } from "./api-helpers";
import { getClearanceStatus, getClinicalDossier, getFighterHealthSummary, primeMedicalDossiers, type ClinicalDossier, type FighterHealthSummary } from "./medical";
import { medicalFeatureAvailable } from "./medical-features";
import { listFighters } from "./people";
import { listSuspensions } from "./suspensions";

/*
 * Bảng phân loại của bác sĩ, ghép từ chính các lệnh đọc mà màn hình Bác sĩ đang dùng: danh sách võ sĩ được giao
 * (`GET /users/me` → `GET /doctors/:profileId/fighters`), hồ sơ y tế từng võ sĩ (`GET /fighters/:id/medical`, qua
 * `getFighterHealthSummary`/`getClearanceStatus`/`getClinicalDossier`, cùng một lần đọc nhờ React `cache`), đình chỉ
 * (`listSuspensions`) và quan sát AI (`GET /jobs/impairments`). Backend chưa có `/doctors/:id/medical-overview`, nên
 * mọi số đếm ở đây được suy ra. Chế độ demo đi qua đúng các hàm service này, chỉ khác nguồn dữ liệu.
 */

export type Triage = "red" | "amber" | "green";
export type BoardItemKind = "review" | "expiry" | "followup" | "suspension";

export interface BoardItem {
    kind: BoardItemKind;
    text: string;
    /** Ngày của việc (YYYY-MM-DD hoặc ISO), để xếp vào lịch 7 ngày. */
    date: string | null;
    /** Thuộc lộ trình tập lại theo bậc. */
    graded?: true;
    /** Với đình chỉ: đỏ khi chặn tập, vàng khi tập được có giới hạn (cùng quy tắc với màu thẻ). */
    tone?: "red" | "amber";
}

export interface BoardRow {
    fighter: Fighter;
    summary: FighterHealthSummary;
    /** Điều kiện tập luyện từ hồ sơ (API) hoặc dữ liệu demo. */
    training: MedicalEligibility | null;
    /** Điều kiện thi đấu: chỉ có khi đọc được hồ sơ của dịch vụ y tế (chế độ API). */
    competition: MedicalEligibility | null;
    dossier: ClinicalDossier | null;
    tag: Triage;
    items: BoardItem[];
}

export interface DoctorBoard {
    rows: BoardRow[];
    alerts: AbnormalMovementAlert[];
    /** Có đọc được quan sát AI không (null khi dịch vụ không trả lời). */
    alertsAvailable: boolean;
    warningDays: number;
    counts: { blocked: number; reviews: number; alerts: number };
    now: string;
}

const FOLLOW_UP_WINDOW = 7;

const REASON_LABELS: Record<SuspensionReason, string> = {
    ...SUSPENSION_REASON_LABELS,
    MEDICAL: "Y tế",
    MANDATORY_REST: "Nghỉ bắt buộc",
    DQ: "Truất quyền",
    OTHER: "Khác",
};

export interface SuspensionBoardInput {
    reason: SuspensionReason;
    startsOn: string;
    endsOn: string;
    requiresClearance?: boolean;
    clearedAt?: Date | string | null;
    maxAllowedTier?: number | null;
    gradedReturn?: GradedReturn | null;
}

export function suspensionBoardState(
    suspensions: readonly SuspensionBoardInput[],
    today: string,
): { tag: "red" | "amber" | null; item: { text: string; date: string; graded?: true } | null } {
    if (!suspensions.length) return { tag: null, item: null };

    const inForceRed: SuspensionBoardInput[] = [];
    const inForceAmber: SuspensionBoardInput[] = [];
    const gradedAmber: SuspensionBoardInput[] = [];

    for (const s of suspensions) {
        const inForce = isInForceOn(
            { startsOn: s.startsOn, endsOn: s.endsOn, requiresClearance: Boolean(s.requiresClearance), clearedAt: s.clearedAt ?? null },
            today,
        );
        if (inForce) {
            if (REHAB_TRIGGER_SUSPENSION_REASONS.includes(s.reason)) {
                inForceRed.push(s);
            } else {
                inForceAmber.push(s);
            }
        } else if (s.gradedReturn && s.gradedReturn.fullReturnOn >= today) {
            gradedAmber.push(s);
        }
    }

    const formatInForce = (s: SuspensionBoardInput) => {
        const awaiting = today > s.endsOn && Boolean(s.requiresClearance) && (s.clearedAt === null || s.clearedAt === undefined);
        const text = awaiting
            ? `Đình chỉ ${REASON_LABELS[s.reason]} đã hết hạn, chờ xác nhận tập lại`
            : `Đình chỉ ${REASON_LABELS[s.reason]} đến ${formatShortDate(s.endsOn, "vi")} · tối đa bậc ${s.maxAllowedTier ?? 2}`;
        return { text, date: s.endsOn };
    };

    if (inForceRed.length > 0) {
        inForceRed.sort((a, b) => b.endsOn.localeCompare(a.endsOn));
        return { tag: "red", item: formatInForce(inForceRed[0]!) };
    }

    if (inForceAmber.length > 0) {
        inForceAmber.sort((a, b) => b.endsOn.localeCompare(a.endsOn));
        return { tag: "amber", item: formatInForce(inForceAmber[0]!) };
    }

    if (gradedAmber.length > 0) {
        gradedAmber.sort((a, b) => b.gradedReturn!.fullReturnOn.localeCompare(a.gradedReturn!.fullReturnOn));
        const s = gradedAmber[0]!;
        const untilDate = addDaysToDate(s.gradedReturn!.fullReturnOn, -1);
        const text = `Đang tập lại theo bậc: tối đa bậc ${s.gradedReturn!.ceiling} đến ${formatShortDate(untilDate, "vi")}`;
        return { tag: "amber", item: { text, date: untilDate, graded: true } };
    }

    return { tag: null, item: null };
}

function itemsFor(summary: FighterHealthSummary, warningDays: number, now: number): BoardItem[] {
    const items: BoardItem[] = [];
    for (const request of summary.openReviewRequests) items.push({ kind: "review", text: request.reason, date: null });
    const clearance = summary.clearance;
    if (clearance?.validUntil && clearance.status === "active" && clearance.isCurrentlyValid !== false) {
        const days = Math.ceil((Date.parse(clearance.validUntil) - now) / 86_400_000);
        if (days >= 0 && days <= warningDays) items.push({ kind: "expiry", text: `Giấy phép hết hạn sau ${days} ngày`, date: clearance.validUntil });
    }
    const followUp = summary.nextFollowUp;
    if (followUp && followUp.daysUntil <= FOLLOW_UP_WINDOW) {
        items.push({
            kind: "followup",
            text: followUp.daysUntil < 0 ? `Tái khám quá hạn ${-followUp.daysUntil} ngày` : followUp.daysUntil === 0 ? "Tái khám hôm nay" : `Tái khám sau ${followUp.daysUntil} ngày`,
            date: followUp.date,
        });
    }
    return items;
}

/** Đỏ: chưa đủ điều kiện tập hoặc đình chỉ đỏ. Vàng: tập được nhưng có giới hạn, chấn thương mở hoặc việc mở. Xanh: còn lại. */
export function triageOf(
    summary: FighterHealthSummary,
    training: MedicalEligibility | null,
    items: BoardItem[],
    suspensions: readonly SuspensionBoardInput[] = [],
    today?: string,
): Triage {
    if (suspensionBoardState(suspensions, today ?? academyDateOf()).tag === "red") return "red";
    const blockedState = summary.clearanceState === "not_cleared" || summary.clearanceState === "expired";
    if (training ? !training.eligible : blockedState) return "red";
    if (summary.clearanceState === "restricted" || summary.activeInjuries.length > 0 || items.length > 0) return "amber";
    return "green";
}

async function loadRow(
    fighter: Fighter,
    warningDays: number,
    now: string,
    suspensions: readonly Suspension[] = [],
): Promise<BoardRow | null> {
    const [summary, status, dossier] = await Promise.all([getFighterHealthSummary(fighter.id, now, fighter), getClearanceStatus(fighter.id, now), getClinicalDossier(fighter.id)]);
    if (!summary) return null;
    const today = academyDateOf(now);
    const training = dossier?.eligibility.TRAINING ?? status.eligibility;
    const items = itemsFor(summary, warningDays, Date.parse(now));
    const susp = suspensionBoardState(suspensions, today);
    if (susp.item) {
        items.push({
            kind: "suspension",
            text: susp.item.text,
            date: susp.item.date,
            ...(susp.tag ? { tone: susp.tag } : {}),
            ...(susp.item.graded ? { graded: true } : {}),
        });
    }
    return { fighter: summary.fighter, summary, training, competition: dossier?.eligibility.COMPETITION ?? null, dossier, tag: triageOf(summary, training, items, suspensions, today), items };
}

/** Đọc một lần cho mỗi request: layout (huy hiệu thanh bên) và trang dùng chung. */
export const loadDoctorBoard = cache(async function loadDoctorBoard(user: User): Promise<DoctorBoard> {
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);
    const suspensionFilter = scope === "all" ? {} : { fighterIds: scope };
    const [fighters, settings, alerts, suspensions] = await Promise.all([
        listFighters(user),
        getSettings(),
        medicalFeatureAvailable("aiObservations") ? nullIfServiceFails(listAlerts({ fighterIds: scope })) : Promise.resolve(null),
        nullIfServiceFails(listSuspensions(suspensionFilter, user)),
    ]);
    const warningDays = settings.clearanceExpiryWarningDays;
    const byFighter = new Map<string, Suspension[]>();
    if (suspensions) {
        for (const s of suspensions) {
            const list = byFighter.get(s.fighterId);
            if (list) list.push(s);
            else byFighter.set(s.fighterId, [s]);
        }
    }
    primeMedicalDossiers(fighters.map((fighter) => fighter.id));
    const rows = (await Promise.all(fighters.map((fighter) => loadRow(fighter, warningDays, now, byFighter.get(fighter.id) ?? [])))).filter((row): row is BoardRow => row !== null);
    const visible = alerts ?? [];
    return {
        rows,
        alerts: visible,
        alertsAvailable: alerts !== null,
        warningDays,
        now,
        counts: {
            blocked: rows.filter((row) => row.tag === "red").length,
            reviews: rows.reduce((sum, row) => sum + row.summary.openReviewRequests.length, 0),
            alerts: visible.filter((alert) => alert.status === "new").length,
        },
    };
});

/** Số đếm cho thanh bên; thanh bên vẫn hiện khi một dịch vụ không trả lời (khi đó không có huy hiệu). */
export async function doctorShellCounts(user: User): Promise<DoctorBoard["counts"]> {
    try {
        return (await loadDoctorBoard(user)).counts;
    } catch {
        return { blocked: 0, reviews: 0, alerts: 0 };
    }
}

export const TRIAGE_ORDER: Record<Triage, number> = { red: 0, amber: 1, green: 2 };

/** Thẻ phân loại của một võ sĩ (trang hồ sơ), từ cùng các lệnh đọc như bảng phân loại. */
export async function loadDoctorRow(fighter: Fighter): Promise<BoardRow | null> {
    const now = new Date().toISOString();
    const [settings, suspensions] = await Promise.all([
        getSettings(),
        nullIfServiceFails(listSuspensions({ fighterIds: [fighter.id] })),
    ]);
    return loadRow(fighter, settings.clearanceExpiryWarningDays, now, suspensions ?? []);
}
