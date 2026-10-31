import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionStatusBadge } from "@/components/domain/status-badges";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { addDaysToDate, suggestRescheduleDate, type TrainingBlockingSuspension } from "@/lib/domain/suspension-rules";
import type { TrainingSession, User } from "@/lib/domain/types";
import { dayKey, formatShortDate, formatTime } from "@/lib/format";
import { db } from "@/lib/mocks/db";
import { TODAY_KEY } from "@/lib/mocks/time";
import { getSessionClearanceConflicts, listSessions, updateSession } from "@/lib/services/training.demo";

import { ActionDialog } from "@/components/ui/action-dialog";
import type { ActionForm } from "@/components/ui/use-action-form";
import type { ActionState } from "@/lib/actions/state";
import { rescheduleSession, updateSession as updateSessionAction, type SessionFormResult } from "@/lib/actions/training";
import * as apiClient from "@/lib/api/client";
import { createTranslator } from "@/lib/i18n/translate";
import { RescheduleFields, RescheduleSessionButton, SessionCoachActions } from "./session-coach-actions";
import { SuspensionBlockCard } from "./suspension-block-card";
import { WeekSummary } from "./week-summary";

const { mockActor } = vi.hoisted(() => {
    const actor: User = {
        id: "user-coach-1",
        name: "Coach Marcus",
        email: "marcus@gym.test",
        role: "coach",
        status: "active",
        title: "Coach",
        phone: null,
        profileId: "coach-marcus",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastActiveAt: null,
        effectiveCapabilities: ["training:write", "training:read", "fighters:read"],
    };
    return { mockActor: actor };
});

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    redirect: vi.fn((href: string) => {
        throw new Error(`redirect:${href}`);
    }),
}));

vi.mock("@/lib/auth/session", () => ({
    authorizeAction: vi.fn(async () => ({ ok: true, user: mockActor })),
    getCurrentUser: vi.fn(async () => mockActor),
    hasPermission: () => true,
}));

vi.mock("@/lib/auth/access", () => ({
    canAccessFighter: () => true,
    accessibleFighterIds: () => "all",
}));

vi.mock("@/lib/i18n/server", async () => {
    const { createTranslator } = await import("@/lib/i18n/translate");
    return { getTranslator: async () => ({ locale: "vi", t: createTranslator("vi") }) };
});

const IDLE_SESSION: ActionState<SessionFormResult> = { status: "idle" };



function createMockSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
    return {
        id: "sess-test-1",
        fighterId: "f-tariq-haddad",
        coachId: "user-coach-1",
        planId: null,
        title: "Kỹ thuật đòn tay",
        type: "pad_work",
        scheduledAt: "2026-11-01T10:00:00.000Z",
        durationMin: 60,
        status: "pending",
        targetRpe: 7,
        location: "Ring 1",
        notes: null,
        exercises: [],
        result: null,
        videoIds: [],
        cancellationReason: null,
        ...overrides,
    };
}

describe("T-030 B5: Lịch tập (Training schedule & suspensions sync)", () => {
    beforeEach(() => {
        // Reset in-memory mock db to pristine seed state before each test
        delete (globalThis as unknown as { __mmaMockDb?: unknown }).__mmaMockDb;
    });

    // ─── B5-1 ──────────────────────────────────────────────────────────────────
    it("B5-1: Buổi pending -> Badge 'Chờ xếp lại'; có nút 'Xếp lại'; không có nút 'Bắt đầu'", () => {
        // 1. SessionStatusBadge pending rendering
        const badgeVi = renderToStaticMarkup(createElement(SessionStatusBadge, { status: "pending", locale: "vi" }));
        expect(badgeVi).toContain("Chờ xếp lại");

        const badgeEn = renderToStaticMarkup(createElement(SessionStatusBadge, { status: "pending", locale: "en" }));
        expect(badgeEn).toContain("To reschedule");

        // 2. Action buttons for pending session
        const session = createMockSession({ status: "pending" });
        const html = renderToStaticMarkup(
            createElement(
                ToastProvider,
                null,
                createElement(SessionCoachActions, {
                    session,
                    fighterName: "Tariq Haddad",
                    locale: "vi",
                }),
            ),
        );
        expect(html).toContain("Xếp lại");
        expect(html).not.toContain("Bắt đầu");
    });

    // ─── B5-2 ──────────────────────────────────────────────────────────────────
    it("B5-2: Xếp lại vào ngày sau khi hết đình chỉ -> Buổi thành scheduled", async () => {
        const tariqSession = db().trainingSessions.find(
            (s) => s.fighterId === "f-tariq-haddad" && s.status === "pending",
        );
        expect(tariqSession).toBeDefined();

        const susp = db().suspensions.find(
            (s) => s.fighterId === "f-tariq-haddad" && s.reason === "MANDATORY_REST",
        );
        expect(susp).toBeDefined();

        // Reschedule to day after suspension ends
        const dayAfterEndsOn = addDaysToDate(susp!.endsOn, 1);
        const newScheduledAt = `${dayAfterEndsOn}T09:00:00.000Z`;

        const result = await updateSession(
            tariqSession!.id,
            {
                ...tariqSession!,
                coachId: tariqSession!.coachId || mockActor.id,
                durationMin: tariqSession!.durationMin ?? 60,
                exercises: tariqSession!.exercises.map((e) => ({
                    exerciseId: e.exerciseId,
                    rounds: e.rounds,
                    roundSec: e.roundSec,
                    sets: e.sets,
                    reps: e.reps,
                    notes: e.notes,
                })),
                scheduledAt: newScheduledAt,
                acknowledgeWarnings: true,
            },
            mockActor,
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.session.status).toBe("scheduled");
            expect(result.session.scheduledAt).toBe(newScheduledAt);
        }

        // Verify session in db is now scheduled
        const updatedDbSession = db().trainingSessions.find((s) => s.id === tariqSession!.id);
        expect(updatedDbSession?.status).toBe("scheduled");
    });

    // ─── B5-3 ──────────────────────────────────────────────────────────────────
    it("B5-3: Xếp lại vào ngày còn đình chỉ -> Thẻ giải thích 409 có lý do, ngày, thang bậc; buổi vẫn pending", async () => {
        const tariqSession = db().trainingSessions.find(
            (s) => s.fighterId === "f-tariq-haddad" && s.status === "pending",
        );
        expect(tariqSession).toBeDefined();

        const susp = db().suspensions.find(
            (s) => s.fighterId === "f-tariq-haddad" && s.reason === "MANDATORY_REST",
        );
        expect(susp).toBeDefined();

        // Target a date squarely within the suspension range
        const withinSuspension = `${susp!.endsOn}T10:00:00.000Z`;

        let thrownError: unknown = null;
        try {
            await updateSession(
                tariqSession!.id,
                {
                    ...tariqSession!,
                    coachId: tariqSession!.coachId || mockActor.id,
                    durationMin: tariqSession!.durationMin ?? 60,
                    exercises: tariqSession!.exercises.map((e) => ({
                        exerciseId: e.exerciseId,
                        rounds: e.rounds,
                        roundSec: e.roundSec,
                        sets: e.sets,
                        reps: e.reps,
                        notes: e.notes,
                    })),
                    scheduledAt: withinSuspension,
                },
                mockActor,
            );
        } catch (err) {
            thrownError = err;
        }

        expect(thrownError).toBeInstanceOf(ApiError);
        const apiErr = thrownError as ApiError;
        expect(apiErr.status).toBe(409);
        expect(apiErr.code).toBe("TRAINING_SUSPENSION_ACTIVE");

        const details = apiErr.details as { suspensions: TrainingBlockingSuspension[] };
        expect(details?.suspensions).toHaveLength(1);
        expect(details.suspensions[0].reason).toBe("MANDATORY_REST");

        // The session must still remain pending in the database
        const dbSession = db().trainingSessions.find((s) => s.id === tariqSession!.id);
        expect(dbSession?.status).toBe("pending");

        // Render explanation card with 409 details: verify reason, date, and ladder
        const cardHtml = renderToStaticMarkup(
            createElement(SuspensionBlockCard, {
                suspensions: details.suspensions,
                locale: "vi",
            }),
        );
        expect(cardHtml).toContain("Nghỉ bắt buộc");
        expect(cardHtml).toContain(formatShortDate(details.suspensions[0].endsOn, "vi"));
        expect(cardHtml).toContain("Xem đình chỉ");
    });

    // ─── B5-4 ──────────────────────────────────────────────────────────────────
    it("B5-4: Lọc 'Chờ xếp lại' -> Chỉ còn buổi pending", async () => {
        const pendingSessions = await listSessions({ status: "pending" });
        expect(pendingSessions.length).toBeGreaterThan(0);
        for (const s of pendingSessions) {
            expect(s.status).toBe("pending");
        }
    });

    // ─── B5-5 ──────────────────────────────────────────────────────────────────
    it("B5-5: render hành động của buổi pending: có 'Xếp lại' và 'Huỷ buổi', không có 'Bắt đầu'/'Vắng'", () => {
        const session = createMockSession({ status: "pending" });
        const html = renderToStaticMarkup(
            createElement(
                ToastProvider,
                null,
                createElement(SessionCoachActions, {
                    session,
                    fighterName: "Tariq Haddad",
                    locale: "vi",
                }),
            ),
        );

        expect(html).toContain("Xếp lại");
        expect(html).toContain("Huỷ buổi");
        expect(html).not.toContain("Bắt đầu");
        expect(html).not.toContain("Vắng");
    });

    // ─── B5-6 ──────────────────────────────────────────────────────────────────
    it("B5-6: demo: buổi pending của Tariq (dữ liệu mẫu) xếp lại vào ngày sau endsOn của đình chỉ nghỉ bắt buộc -> scheduled; xếp vào ngày trong khoảng -> lỗi 409 TRAINING_SUSPENSION_ACTIVE, buổi vẫn pending", async () => {
        const tariqSession = db().trainingSessions.find(
            (s) => s.fighterId === "f-tariq-haddad" && s.status === "pending",
        );
        expect(tariqSession).toBeDefined();

        const susp = db().suspensions.find(
            (s) => s.fighterId === "f-tariq-haddad" && s.reason === "MANDATORY_REST",
        );
        expect(susp).toBeDefined();

        // 1. Reschedule within suspension -> 409 error, session stays pending
        const sessionUpdateTemplate = {
            ...tariqSession!,
            coachId: tariqSession!.coachId || mockActor.id,
            durationMin: tariqSession!.durationMin ?? 60,
            exercises: tariqSession!.exercises.map((e) => ({
                exerciseId: e.exerciseId,
                rounds: e.rounds,
                roundSec: e.roundSec,
                sets: e.sets,
                reps: e.reps,
                notes: e.notes,
            })),
        };

        const insideDate = `${susp!.startsOn}T14:00:00.000Z`;
        await expect(
            updateSession(tariqSession!.id, { ...sessionUpdateTemplate, scheduledAt: insideDate }, mockActor),
        ).rejects.toMatchObject({
            status: 409,
            code: "TRAINING_SUSPENSION_ACTIVE",
        });

        expect(db().trainingSessions.find((s) => s.id === tariqSession!.id)?.status).toBe("pending");

        // 2. Reschedule to the day after endsOn -> succeeds and transitions to scheduled
        const safeDate = `${addDaysToDate(susp!.endsOn, 1)}T14:00:00.000Z`;
        const res = await updateSession(tariqSession!.id, { ...sessionUpdateTemplate, scheduledAt: safeDate, acknowledgeWarnings: true }, mockActor);
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.session.status).toBe("scheduled");
        }
        expect(db().trainingSessions.find((s) => s.id === tariqSession!.id)?.status).toBe("scheduled");
    });

    // ─── B5-7 ──────────────────────────────────────────────────────────────────
    it("B5-7: gợi ý ngày xếp lại: đình chỉ không cần xác nhận hết ngày E -> gợi ý E+1; đình chỉ cần xác nhận chưa xác nhận -> không gợi ý", () => {
        // Case 1: Non-clearance suspension ending on 2026-11-10 -> suggests 2026-11-11
        const nonClearance = suggestRescheduleDate([
            {
                endsOn: "2026-11-10",
                requiresClearance: false,
                clearedAt: null,
            },
        ]);
        expect(nonClearance.suggestedDate).toBe("2026-11-11");
        expect(nonClearance.awaitingClearance).toBe(false);

        // Case 2: Requires clearance and not yet cleared -> does not suggest date, awaitingClearance = true
        const uncleared = suggestRescheduleDate([
            {
                endsOn: "2026-11-10",
                requiresClearance: true,
                clearedAt: null,
            },
        ]);
        expect(uncleared.suggestedDate).toBeNull();
        expect(uncleared.awaitingClearance).toBe(true);

        // Case 3: Requires clearance and ALREADY cleared -> suggests E+1, awaitingClearance = false
        const cleared = suggestRescheduleDate([
            {
                endsOn: "2026-11-10",
                requiresClearance: true,
                clearedAt: "2026-11-09T08:00:00.000Z",
            },
        ]);
        expect(cleared.suggestedDate).toBe("2026-11-11");
        expect(cleared.awaitingClearance).toBe(false);
    });

    // ─── B5-8 ──────────────────────────────────────────────────────────────────
    it("B5-8: render thẻ 409 với gradedReturn {ceiling:3, fullReturnOn}: có câu tập lại theo bậc, có thang (3 được tập, 2 trần), có link tới /coach/bouts/suspensions; với details rỗng -> câu lỗi chung, không vỡ", () => {
        // 1. With gradedReturn
        const gradedHtml = renderToStaticMarkup(
            createElement(SuspensionBlockCard, {
                locale: "vi",
                suspensions: [
                    {
                        suspensionId: "susp-gr-1",
                        reason: "KO",
                        endsOn: "2026-11-10",
                        requiresClearance: true,
                        gradedReturn: {
                            ceiling: 3,
                            fullReturnOn: "2026-11-20",
                        },
                    },
                ],
            }),
        );
        // Explanatory sentence with ceiling & fullReturnOn
        expect(gradedHtml).toContain("tập lại theo bậc");
        expect(gradedHtml).toContain("3");
        expect(gradedHtml).toContain("20 thg 11");

        // Ladder with 3 allowed and 2 ceiling segments
        expect(gradedHtml).toContain("bị chặn hôm nay");
        expect(gradedHtml).toContain("ladder-pattern-ceiling");

        // Link to suspensions page
        expect(gradedHtml).toContain('href="/coach/bouts/suspensions"');
        expect(gradedHtml).toContain("Xem đình chỉ");

        // 2. With empty suspensions details -> generic fallback message, no crash
        const emptyHtml = renderToStaticMarkup(
            createElement(SuspensionBlockCard, {
                locale: "vi",
                suspensions: [],
            }),
        );
        expect(emptyHtml).toContain("Võ sĩ đang bị đình chỉ, buổi tập loại này bị chặn.");

        const undefinedHtml = renderToStaticMarkup(
            createElement(SuspensionBlockCard, {
                locale: "en",
            }),
        );
        expect(undefinedHtml).toContain(
            "The fighter has an active suspension that blocks this training session type.",
        );
    });

    // ─── B5-9 ──────────────────────────────────────────────────────────────────
    it("B5-9: thống kê tuần với 1 buổi pending và 1 buổi cancelled: số đã huỷ = 1; có dòng '1 buổi chờ xếp lại'", () => {
        const pendingSession = createMockSession({
            id: "s-pending",
            status: "pending",
        });
        const cancelledSession = createMockSession({
            id: "s-cancelled",
            status: "cancelled",
        });

        const html = renderToStaticMarkup(
            createElement(WeekSummary, {
                sessions: [pendingSession, cancelledSession],
                locale: "vi",
            }),
        );

        // Cancelled count is strictly 1 ("1 đã hủy")
        expect(html).toContain("1 đã hủy");

        // Pending count line appears as "1 buổi chờ xếp lại"
        expect(html).toContain("1 buổi chờ xếp lại");
    });

    function seedTariqPendingWarnSession(validDate: string): TrainingSession {
        const store = db();
        const warnExercise = store.exercises.find(
            (e) => e.techniques.includes("kick") || e.loadsRegions.includes("left_knee"),
        );
        expect(warnExercise).toBeDefined();
        const otherExercises = store.exercises.filter((e) => e.id !== warnExercise!.id).slice(0, 2);
        expect(otherExercises).toHaveLength(2);
        const threeExercises = [warnExercise!, ...otherExercises];

        const coach = store.coaches.find((c) => c.fighterIds?.includes("f-tariq-haddad")) ?? store.coaches[0];

        const session: TrainingSession = {
            id: "s-test-tariq-pending-warn",
            fighterId: "f-tariq-haddad",
            coachId: coach?.id ?? "c-rafael-costa",
            planId: null,
            title: "Kỹ thuật chân và gối",
            type: "strength_conditioning",
            scheduledAt: `${validDate}T10:00:00+07:00`,
            durationMin: 60,
            status: "pending",
            targetRpe: 7,
            location: "Ring 1",
            notes: "Ghi chú gốc của buổi",
            exercises: threeExercises.map((e) => ({
                exerciseId: e.id,
                rounds: 3,
                roundSec: 180,
                sets: 3,
                reps: 10,
                notes: null,
                completed: false,
            })),
            result: null,
            videoIds: [],
            cancellationReason: null,
        };

        const existingIndex = store.trainingSessions.findIndex((s) => s.id === session.id);
        if (existingIndex >= 0) {
            store.trainingSessions[existingIndex] = session;
        } else {
            store.trainingSessions.push(session);
        }
        return session;
    }

    // ─── B5-10 ─────────────────────────────────────────────────────────────────
    it("B5-10: demo: xếp lại buổi pending có 3 bài tập qua rescheduleSession vào ngày hợp lệ -> status scheduled, exercises vẫn đủ 3 (cùng exerciseId, sets, reps), title, location, notes không đổi", async () => {
        const susp = db().suspensions.find(
            (s) => s.fighterId === "f-tariq-haddad" && s.reason === "MANDATORY_REST",
        );
        expect(susp).toBeDefined();
        const validDate = addDaysToDate(susp!.endsOn, 1);

        const pendingSession = seedTariqPendingWarnSession(validDate);
        expect(pendingSession.exercises).toHaveLength(3);

        const originalExercises = pendingSession.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            sets: e.sets,
            reps: e.reps,
        }));
        const originalTitle = pendingSession.title;
        const originalLocation = pendingSession.location;
        const originalNotes = pendingSession.notes;

        const formData = new FormData();
        formData.set("date", validDate);
        formData.set("time", "15:00");
        formData.set("acknowledgeWarnings", "true");

        const result = await rescheduleSession(pendingSession.id, IDLE_SESSION, formData);
        expect(result.status).toBe("success");

        const updated = db().trainingSessions.find((s) => s.id === pendingSession.id);
        expect(updated).toBeDefined();
        expect(updated!.status).toBe("scheduled");
        expect(updated!.exercises).toHaveLength(3);
        expect(
            updated!.exercises.map((e) => ({
                exerciseId: e.exerciseId,
                sets: e.sets,
                reps: e.reps,
            })),
        ).toEqual(originalExercises);
        expect(updated!.title).toBe(originalTitle);
        expect(updated!.location).toBe(originalLocation);
        expect(updated!.notes).toBe(originalNotes);
    });

    // ─── B5-11 ─────────────────────────────────────────────────────────────────
    it("B5-11: updateSession (form sửa buổi) với notes rỗng trên buổi có notes -> notes thành rỗng/null (không giữ giá trị cũ); location rỗng tương tự", async () => {
        const scheduledSession = db().trainingSessions.find(
            (s) => s.status === "scheduled" && s.fighterId === "f-tariq-haddad",
        );
        expect(scheduledSession).toBeDefined();

        scheduledSession!.notes = "Previous coach notes";
        scheduledSession!.location = "Striking room";

        const origDate = dayKey(scheduledSession!.scheduledAt);
        const origTime = formatTime(scheduledSession!.scheduledAt);

        const baseFormData = () => {
            const fd = new FormData();
            fd.set("fighterId", scheduledSession!.fighterId);
            fd.set("planId", scheduledSession!.planId || "");
            fd.set("title", scheduledSession!.title);
            fd.set("type", scheduledSession!.type);
            fd.set("date", origDate);
            fd.set("time", origTime);
            fd.set("durationMin", String(scheduledSession!.durationMin ?? 60));
            fd.set("location", "Striking room");
            fd.set("targetRpe", String(scheduledSession!.targetRpe ?? 6));
            fd.set("exercises", "[]");
            fd.set("notes", "");
            fd.set("acknowledgeWarnings", "on");
            return fd;
        };

        // 1. Submit with notes: "" -> notes becomes null (does not retain "Previous coach notes")
        const fdWithEmptyNotes = baseFormData();
        fdWithEmptyNotes.set("notes", "");
        const actionRes = await updateSessionAction(scheduledSession!.id, IDLE_SESSION, fdWithEmptyNotes).catch((e: Error) => e);
        expect(actionRes.message).toContain("redirect:");

        const afterNotesUpdate = db().trainingSessions.find((s) => s.id === scheduledSession!.id);
        expect(afterNotesUpdate?.notes).toBeNull();

        // 2. Submit with location: "" -> schema validation fails on location (does not retain old location)
        const fdWithEmptyLocation = baseFormData();
        fdWithEmptyLocation.set("location", "");
        const locationErrResult = await updateSessionAction(scheduledSession!.id, IDLE_SESSION, fdWithEmptyLocation);
        expect(locationErrResult.status).toBe("error");
        expect(locationErrResult.fieldErrors?.location).toBeDefined();

        const afterLocationAttempt = db().trainingSessions.find((s) => s.id === scheduledSession!.id);
        expect(afterLocationAttempt?.location).toBe("Striking room");
    });

    // ─── B5-12 ─────────────────────────────────────────────────────────────────
    it("B5-12: API mode rescheduleSession gửi body chỉ có scheduledAt (spy client), không có exercises", async () => {
        const prevAppMode = process.env.APP_DATA_MODE;
        process.env.APP_DATA_MODE = "api";

        const targetDate = addDaysToDate(TODAY_KEY, 15);

        const apiSession = {
            id: "sess-api-test-1",
            fighterId: "f-tariq-haddad",
            coachId: "user-coach-1",
            planId: null,
            title: "Technique sparring",
            sessionType: "PAD_WORK",
            scheduledAt: `${TODAY_KEY}T10:00:00.000Z`,
            plannedDurationSec: 3600,
            status: "PENDING",
            location: "Ring 1",
            coachNotes: "Pre-existing notes",
            reportedRpe: null,
            actualDurationSec: null,
            completedAt: null,
            cancellationReason: null,
        };

        const apiRequestSpy = vi.spyOn(apiClient, "authenticatedApiRequest").mockResolvedValue(apiSession);
        const mutableSpy = vi.spyOn(apiClient, "authenticatedMutableApiRequest").mockResolvedValue({
            ...apiSession,
            scheduledAt: `${targetDate}T09:00:00.000Z`,
            status: "SCHEDULED",
        });

        try {
            const formData = new FormData();
            formData.set("date", targetDate);
            formData.set("time", "09:00");
            formData.set("acknowledgeWarnings", "true");

            const result = await rescheduleSession("sess-api-test-1", IDLE_SESSION, formData);
            expect(result.status).toBe("success");

            expect(mutableSpy).toHaveBeenCalledTimes(1);
            const [path, , init] = mutableSpy.mock.calls[0];
            expect(path).toBe("/training-sessions/sess-api-test-1");
            expect(init?.method).toBe("PATCH");

            const sentBody = JSON.parse(init?.body as string);
            expect(sentBody).toEqual({
                scheduledAt: expect.stringContaining(targetDate),
            });
            expect(sentBody.exercises).toBeUndefined();
            expect(sentBody.title).toBeUndefined();
            expect(sentBody.location).toBeUndefined();
            expect(sentBody.coachNotes).toBeUndefined();
            expect(sentBody.notes).toBeUndefined();
        } finally {
            process.env.APP_DATA_MODE = prevAppMode;
            apiRequestSpy.mockRestore();
            mutableSpy.mockRestore();
        }
    });

    // ─── B5-13 ─────────────────────────────────────────────────────────────────
    it("B5-13: dialog xếp lại khi action trả lỗi có suspensions -> chỉ một lần câu lỗi xuất hiện trong markup", () => {
        const blockingSuspension: TrainingBlockingSuspension = {
            suspensionId: "susp-block-1",
            reason: "MANDATORY_REST",
            endsOn: "2026-11-03",
            requiresClearance: false,
        };

        const errorSentence = "Võ sĩ đang bị đình chỉ (Nghỉ bắt buộc), buổi tập loại này bị chặn đến ngày 3 thg 11.";
        const errorState: ActionState<SessionFormResult> = {
            status: "error",
            message: errorSentence,
            data: {
                conflicts: [],
                suspensions: [blockingSuspension],
            },
        };

        const html = renderToStaticMarkup(
            createElement(
                ToastProvider,
                null,
                // eslint-disable-next-line react/no-children-prop
                createElement(
                    ActionDialog<SessionFormResult>,
                    {
                        open: true,
                        onClose: () => {},
                        title: "Xếp lại buổi tập",
                        action: async () => errorState,
                        initialState: errorState,
                        submitLabel: "Lưu",
                        showMessage: ((state: ActionState<unknown>) => !((state.data as SessionFormResult | undefined)?.suspensions?.length)),
                        children: (form: ActionForm<SessionFormResult>) =>
                            createElement(RescheduleFields, {
                                form,
                                suggestion: { suggestedDate: "2026-11-04", awaitingClearance: false },
                                initialDate: "2026-11-04",
                                initialTime: "10:00",
                                t: createTranslator("vi"),
                                locale: "vi",
                                acknowledged: false,
                                onAcknowledgedChange: () => {},
                            }),
                    },
                ),
            ),
        );

        // SuspensionBlockCard renders the explanation
        expect(html).toContain(errorSentence);

        // Count occurrences of errorSentence in the whole dialog markup
        const occurrences = html.split(errorSentence).length - 1;
        expect(occurrences).toBe(1);
    });

    // ─── B5-14 ─────────────────────────────────────────────────────────────────
    it("B5-14: dialog có gợi ý ngày -> ô ngày có value bằng ngày gợi ý; có nút 'Dùng ngày …'", () => {
        const session = createMockSession({
            status: "pending",
            scheduledAt: "2026-11-01T10:00:00.000Z",
        });

        const suspensions = [
            {
                endsOn: "2026-11-03",
                requiresClearance: false,
                clearedAt: null,
            },
        ];

        const html = renderToStaticMarkup(
            createElement(
                ToastProvider,
                null,
                createElement(RescheduleSessionButton, {
                    session,
                    suspensions,
                    defaultOpen: true,
                }),
            ),
        );

        // 1. Date input prefilled with suggested date (2026-11-04)
        expect(html).toContain('name="date"');
        expect(html).toContain('value="2026-11-04"');

        // 2. Contains button "Dùng ngày 4 thg 11"
        expect(html).toContain("Dùng ngày 4 thg 11");
        expect(html).toContain("<button");
    });

    // ─── B5-15 ─────────────────────────────────────────────────────────────────
    it("B5-15: demo: rescheduleSession buổi pending có bài vướng cảnh báo cấp phép vào ngày hợp lệ có cảnh báo cấp phép, không xác nhận -> trả lỗi kèm conflicts (không đổi buổi); có acknowledgeWarnings -> status scheduled, exercises vẫn đủ 3", async () => {
        const susp = db().suspensions.find(
            (s) => s.fighterId === "f-tariq-haddad" && s.reason === "MANDATORY_REST",
        );
        expect(susp).toBeDefined();
        const validDate = addDaysToDate(susp!.endsOn, 1);

        const tariqSession = seedTariqPendingWarnSession(validDate);
        const sessionId = tariqSession.id;
        expect(tariqSession.exercises).toHaveLength(3);
        const originalScheduledAt = tariqSession.scheduledAt;

        const conflicts = getSessionClearanceConflicts({
            fighterId: tariqSession.fighterId,
            type: tariqSession.type,
            targetRpe: tariqSession.targetRpe,
            scheduledAt: `${validDate}T15:00:00+07:00`,
            exercises: tariqSession.exercises,
        });
        expect(conflicts.some((c) => c.severity === "warn")).toBe(true);
        expect(conflicts.some((c) => c.severity === "block")).toBe(false);

        // 1. Without acknowledgeWarnings: error with conflicts, session unchanged
        const formWithoutAck = new FormData();
        formWithoutAck.set("date", validDate);
        formWithoutAck.set("time", "15:00");

        const resWithoutAck = await rescheduleSession(sessionId, IDLE_SESSION, formWithoutAck);
        expect(resWithoutAck.status).toBe("error");
        expect(resWithoutAck.data?.conflicts).toBeDefined();
        expect(resWithoutAck.data!.conflicts!.length).toBeGreaterThan(0);

        const sessionAfterFail = db().trainingSessions.find((s) => s.id === sessionId);
        expect(sessionAfterFail!.status).toBe("pending");
        expect(sessionAfterFail!.scheduledAt).toBe(originalScheduledAt);
        expect(sessionAfterFail!.exercises).toHaveLength(3);

        // 2. With acknowledgeWarnings: status becomes scheduled, exercises still has 3
        const formWithAck = new FormData();
        formWithAck.set("date", validDate);
        formWithAck.set("time", "15:00");
        formWithAck.set("acknowledgeWarnings", "on");

        const resWithAck = await rescheduleSession(sessionId, IDLE_SESSION, formWithAck);
        expect(resWithAck.status).toBe("success");

        const sessionAfterSuccess = db().trainingSessions.find((s) => s.id === sessionId);
        expect(sessionAfterSuccess!.status).toBe("scheduled");
        expect(sessionAfterSuccess!.exercises).toHaveLength(3);
    });

    // ─── B5-16 ─────────────────────────────────────────────────────────────────
    it("B5-16: thông báo yêu cầu xác nhận cảnh báo ở locale vi không chứa chữ tiếng Anh 'Review the Medical Clearance'", async () => {
        const susp = db().suspensions.find(
            (s) => s.fighterId === "f-tariq-haddad" && s.reason === "MANDATORY_REST",
        );
        expect(susp).toBeDefined();
        const validDate = addDaysToDate(susp!.endsOn, 1);

        const tariqSession = seedTariqPendingWarnSession(validDate);
        const sessionId = tariqSession.id;

        const conflicts = getSessionClearanceConflicts({
            fighterId: tariqSession.fighterId,
            type: tariqSession.type,
            targetRpe: tariqSession.targetRpe,
            scheduledAt: `${validDate}T15:00:00+07:00`,
            exercises: tariqSession.exercises,
        });
        expect(conflicts.some((c) => c.severity === "warn")).toBe(true);
        expect(conflicts.some((c) => c.severity === "block")).toBe(false);

        const formData = new FormData();
        formData.set("date", validDate);
        formData.set("time", "15:00");

        const result = await rescheduleSession(sessionId, IDLE_SESSION, formData);
        expect(result.status).toBe("error");
        expect(result.message).toBeDefined();
        expect(result.message).not.toContain("Review the Medical Clearance");
        expect(result.message).toContain("xác nhận");
    });

    // ─── B5-17 ─────────────────────────────────────────────────────────────────
    it("B5-17: dialog xếp lại với conflicts kiểu warn -> có ô xác nhận; với kiểu block -> nút Xếp lại bị vô hiệu", () => {
        const session = createMockSession({
            id: "sess-test-conflicts",
            status: "pending",
            scheduledAt: "2026-11-05T10:00:00.000Z",
        });

        // 1. warn conflict -> has confirmation checkbox with "Vẫn xếp lịch"
        const warnConflicts = [
            {
                code: "protected_region" as const,
                severity: "warn" as const,
                label: "Knee",
                message: "Fighter has restricted knee clearance; avoid high-load pivoting.",
            },
        ];

        const htmlWarn = renderToStaticMarkup(
            createElement(
                ToastProvider,
                null,
                createElement(RescheduleSessionButton, {
                    session,
                    defaultOpen: true,
                    conflicts: warnConflicts,
                }),
            ),
        );

        expect(htmlWarn).toContain('name="acknowledgeWarnings"');
        expect(htmlWarn).toContain("Vẫn xếp lịch");
        expect(htmlWarn).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Xếp lại[\s\S]*?<\/button>/);

        // 2. block conflict -> submit button is disabled and NO acknowledge checkbox
        const blockConflicts = [
            {
                code: "blocked_type" as const,
                severity: "block" as const,
                message: "Fighter is blocked from contact sessions.",
            },
        ];

        const htmlBlock = renderToStaticMarkup(
            createElement(
                ToastProvider,
                null,
                createElement(RescheduleSessionButton, {
                    session,
                    defaultOpen: true,
                    conflicts: blockConflicts,
                }),
            ),
        );

        expect(htmlBlock).not.toContain('name="acknowledgeWarnings"');
        expect(htmlBlock).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Xếp lại[\s\S]*?<\/button>/);
    });

    // ─── B5-18 ─────────────────────────────────────────────────────────────────
    it("B5-18: suspensions = [{ reason 'MANDATORY_REST', endsOn, requiresClearance false }] không gradedReturn -> có lý do và ngày, KHÔNG có thang (không có phần tử của IntensityLadder, ví dụ role/aria-label của thang). Có gradedReturn { ceiling 3, fullReturnOn } -> có thang, ceiling 3", () => {
        const withoutGraded = [
            {
                reason: "MANDATORY_REST",
                endsOn: "2026-11-20",
                requiresClearance: false,
            },
        ];
        const htmlWithout = renderToStaticMarkup(
            createElement(SuspensionBlockCard, {
                suspensions: withoutGraded,
                locale: "vi",
            }),
        );
        expect(htmlWithout).toContain("Nghỉ bắt buộc");
        expect(htmlWithout).toContain(formatShortDate("2026-11-20", "vi"));
        // Không có phần tử của IntensityLadder (role="img", role="slider", bg-success-solid, ladder-pattern)
        expect(htmlWithout).not.toContain('role="img"');
        expect(htmlWithout).not.toContain('role="slider"');
        expect(htmlWithout).not.toContain("bg-success-solid");
        expect(htmlWithout).not.toContain("ladder-pattern");

        const withGraded = [
            {
                reason: "KO",
                endsOn: "2026-11-20",
                requiresClearance: false,
                gradedReturn: {
                    ceiling: 3 as const,
                    fullReturnOn: "2026-12-04",
                },
            },
        ];
        const htmlWith = renderToStaticMarkup(
            createElement(SuspensionBlockCard, {
                suspensions: withGraded,
                locale: "vi",
            }),
        );
        expect(htmlWith).toContain('role="img"');
        const allowedCount = (htmlWith.match(/bg-success-solid/g) || []).length;
        expect(allowedCount).toBe(3);
        const ceilingCount = (htmlWith.match(/ladder-pattern-ceiling/g) || []).length;
        expect(ceilingCount).toBe(2);
    });

    // ─── B5-19 ─────────────────────────────────────────────────────────────────
    it("B5-19: demo: rescheduleSession buổi pending của Tariq vào một ngày trong đình chỉ -> lỗi, chi tiết suspensions không có khoá maxAllowedTier (đúng hình dạng contract API)", async () => {
        const tariqSession = db().trainingSessions.find(
            (s) => s.fighterId === "f-tariq-haddad" && s.status === "pending",
        );
        expect(tariqSession).toBeDefined();

        const susp = db().suspensions.find(
            (s) => s.fighterId === "f-tariq-haddad" && s.reason === "MANDATORY_REST",
        );
        expect(susp).toBeDefined();

        const withinSuspension = susp!.endsOn;
        const formData = new FormData();
        formData.set("date", withinSuspension);
        formData.set("time", "10:00");

        const result = await rescheduleSession(tariqSession!.id, IDLE_SESSION, formData);
        expect(result.status).toBe("error");

        const suspensions = result.data?.suspensions;
        expect(suspensions).toBeDefined();
        expect(suspensions!.length).toBeGreaterThan(0);

        for (const s of suspensions!) {
            expect(s).not.toHaveProperty("maxAllowedTier");
            expect(Object.prototype.hasOwnProperty.call(s, "maxAllowedTier")).toBe(false);
        }

        // Kiểm tra cả direct call updateSession ném ApiError
        let thrownError: unknown = null;
        try {
            await updateSession(
                tariqSession!.id,
                {
                    ...tariqSession!,
                    coachId: tariqSession!.coachId || mockActor.id,
                    durationMin: tariqSession!.durationMin ?? 60,
                    exercises: tariqSession!.exercises.map((e) => ({
                        exerciseId: e.exerciseId,
                        rounds: e.rounds,
                        roundSec: e.roundSec,
                        sets: e.sets,
                        reps: e.reps,
                        notes: e.notes,
                    })),
                    scheduledAt: `${withinSuspension}T10:00:00.000Z`,
                },
                mockActor,
            );
        } catch (err) {
            thrownError = err;
        }

        expect(thrownError).toBeInstanceOf(ApiError);
        const apiErr = thrownError as ApiError;
        const directSuspensions = (apiErr.details as { suspensions: unknown[] })?.suspensions;
        expect(directSuspensions).toBeDefined();
        for (const s of directSuspensions) {
            expect(s).not.toHaveProperty("maxAllowedTier");
            expect(Object.prototype.hasOwnProperty.call(s, "maxAllowedTier")).toBe(false);
        }
    });

    // ─── I18N-1 ────────────────────────────────────────────────────────────────
    it("I18N-1: render nút huỷ buổi của SessionCoachActions với locale vi và en -> đúng t('training.actions.cancelShort')", () => {
        const session = createMockSession({ status: "pending" });
        const tVi = createTranslator("vi");
        const tEn = createTranslator("en");

        // en:
        const htmlEn = renderToStaticMarkup(
            createElement(
                ToastProvider,
                null,
                createElement(SessionCoachActions, {
                    session,
                    fighterName: "Tariq Haddad",
                    locale: "en",
                }),
            ),
        );
        expect(htmlEn).not.toContain("Huỷ buổi");
        expect(htmlEn).toContain(tEn("training.actions.cancelShort"));
        expect(htmlEn).not.toContain(tEn("training.actions.cancelSession"));

        // vi:
        const htmlVi = renderToStaticMarkup(
            createElement(
                ToastProvider,
                null,
                createElement(SessionCoachActions, {
                    session,
                    fighterName: "Tariq Haddad",
                    locale: "vi",
                }),
            ),
        );
        expect(htmlVi).toContain(tVi("training.actions.cancelShort"));
        expect(htmlVi).not.toContain(tVi("training.actions.cancelSession"));
    });
});
