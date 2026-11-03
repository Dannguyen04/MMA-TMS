import "server-only";

import { cache } from "react";

import { accessibleFighterIds } from "@/lib/auth/access";
import type { MedicalEligibility } from "@/lib/domain/medical-contract";
import type { AbnormalMovementAlert, Fighter, User } from "@/lib/domain/types";
import { getSettings } from "./admin";
import { listAlerts } from "./ai";
import { nullIfServiceFails } from "./api-helpers";
import { getClearanceStatus, getClinicalDossier, getFighterHealthSummary, type ClinicalDossier, type FighterHealthSummary } from "./medical";
import { medicalFeatureAvailable } from "./medical-features";
import { listFighters } from "./people";

/*
 * Bảng phân loại của bác sĩ, ghép từ chính các lệnh đọc mà màn hình Bác sĩ đang dùng: danh sách võ sĩ được giao
 * (`GET /users/me` → `GET /doctors/:profileId/fighters`), hồ sơ y tế từng võ sĩ (`GET /fighters/:id/medical`, qua
 * `getFighterHealthSummary`/`getClearanceStatus`/`getClinicalDossier`, cùng một lần đọc nhờ React `cache`) và quan sát AI
 * (`GET /jobs/impairments`). Backend chưa có `/doctors/:id/medical-overview`, nên mọi số đếm ở đây được suy ra.
 * Chế độ demo đi qua đúng các hàm service này, chỉ khác nguồn dữ liệu.
 */

export type Triage = "red" | "amber" | "green";
export type BoardItemKind = "review" | "expiry" | "followup";

export interface BoardItem {
    kind: BoardItemKind;
    text: string;
    /** Ngày của việc (YYYY-MM-DD hoặc ISO), để xếp vào lịch 7 ngày. */
    date: string | null;
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

/** Đỏ: chưa đủ điều kiện tập. Vàng: tập được nhưng có giới hạn, chấn thương mở hoặc việc mở. Xanh: còn lại. */
function triageOf(summary: FighterHealthSummary, training: MedicalEligibility | null, items: BoardItem[]): Triage {
    const blockedState = summary.clearanceState === "not_cleared" || summary.clearanceState === "expired";
    if (training ? !training.eligible : blockedState) return "red";
    if (summary.clearanceState === "restricted" || summary.activeInjuries.length > 0 || items.length > 0) return "amber";
    return "green";
}

async function loadRow(fighter: Fighter, warningDays: number, now: string): Promise<BoardRow | null> {
    const [summary, status, dossier] = await Promise.all([getFighterHealthSummary(fighter.id, now), getClearanceStatus(fighter.id, now), getClinicalDossier(fighter.id)]);
    if (!summary) return null;
    const training = dossier?.eligibility.TRAINING ?? status.eligibility;
    const items = itemsFor(summary, warningDays, Date.parse(now));
    return { fighter: summary.fighter, summary, training, competition: dossier?.eligibility.COMPETITION ?? null, dossier, tag: triageOf(summary, training, items), items };
}

/** Đọc một lần cho mỗi request: layout (huy hiệu thanh bên) và trang dùng chung. */
export const loadDoctorBoard = cache(async function loadDoctorBoard(user: User): Promise<DoctorBoard> {
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);
    const [fighters, settings, alerts] = await Promise.all([
        listFighters(user),
        getSettings(),
        medicalFeatureAvailable("aiObservations") ? nullIfServiceFails(listAlerts({ fighterIds: scope })) : Promise.resolve(null),
    ]);
    const warningDays = settings.clearanceExpiryWarningDays;
    const rows = (await Promise.all(fighters.map((fighter) => loadRow(fighter, warningDays, now)))).filter((row): row is BoardRow => row !== null);
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
    const settings = await getSettings();
    return loadRow(fighter, settings.clearanceExpiryWarningDays, new Date().toISOString());
}
