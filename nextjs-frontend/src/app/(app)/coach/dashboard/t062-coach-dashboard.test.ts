import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TodaySchedule } from "@/components/dashboard/today-schedule";
import type { CoachTodo, Suspension, TrainingSession, User } from "@/lib/domain/types";
import { createTranslator } from "@/lib/i18n/translate";
import { mockCoaches, mockUsers } from "@/lib/mocks/people";
import { listSuspensions } from "@/lib/services/suspensions";
import CoachSuspensionsPage from "../bouts/suspensions/page";
import { activeSuspensionLines, CoachTodoCard, coachTodoText, type ActiveSuspensionLine } from "./coach-todo-card";

const baseRafael = mockUsers.find((u) => u.id === "u-rafael-costa")!;
const rafaelCoach = mockCoaches.find((c) => c.userId === "u-rafael-costa")!;
const mockRafaelCoach: User = {
    ...baseRafael,
    effectiveCapabilities: ["fighters:read", "fighters:write", "training:read", "training:write"],
    assignmentScope: { fighterIds: [...rafaelCoach.fighterIds] },
};

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
    redirect: vi.fn((url: string) => {
        throw new Error(`REDIRECT:${url}`);
    }),
}));

vi.mock("@/lib/auth/session", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/auth/session")>();
    return {
        ...actual,
        requireUser: vi.fn(async () => mockRafaelCoach),
        getCurrentUser: vi.fn(async () => mockRafaelCoach),
        requireRole: vi.fn(async () => mockRafaelCoach),
    };
});

vi.mock("@/lib/i18n/server", async () => {
    const { createTranslator: makeT } = await import("@/lib/i18n/translate");
    return {
        getTranslator: async () => ({
            locale: "vi" as const,
            t: makeT("vi"),
        }),
    };
});

vi.mock("@/components/ui/toast", async (orig) => {
    const actual = await orig<typeof import("@/components/ui/toast")>();
    return {
        ...actual,
        useToast: () => vi.fn(),
    };
});

const TODAY = "2026-11-10";
const tVi = createTranslator("vi");
const tEn = createTranslator("en");

function makeSuspension(overrides: Partial<Suspension> & Pick<Suspension, "reason" | "startsOn" | "endsOn">): Suspension {
    return {
        id: overrides.id ?? "s-1",
        fighterId: overrides.fighterId ?? "A",
        boutId: null,
        lossOfConsciousness: null,
        suggestedDays: null,
        overrideReason: null,
        blockedSessionTypes: [],
        maxAllowedTier: 1,
        requiresClearance: false,
        clearedAt: null,
        clearedById: null,
        clearanceNote: null,
        createdById: "u-rafael-costa",
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "2026-11-01T00:00:00Z",
        status: "ACTIVE",
        gradedReturn: null,
        issuedBy: "CLUB",
        issuerReference: null,
        earlyEndExaminationId: null,
        liftReference: null,
        ...overrides,
    };
}

function renderTodoCard(props: {
    todo: CoachTodo | null;
    suspensions?: ActiveSuspensionLine[];
    fighterNames?: Map<string, string>;
    t?: ReturnType<typeof createTranslator>;
    locale?: "vi" | "en";
}): string {
    const element = CoachTodoCard({
        todo: props.todo,
        suspensions: props.suspensions ?? [],
        fighterNames: props.fighterNames ?? new Map(),
        t: props.t ?? tVi,
        locale: props.locale ?? "vi",
    });
    expect(element).not.toBeNull();
    return renderToStaticMarkup(element);
}

describe("T-062: Coach dashboard fight camp & active suspensions", () => {
    beforeEach(() => {
        delete (globalThis as Record<string, unknown>).__mmaMockDb;
    });

    it("S1", () => {
        const res = activeSuspensionLines(
            [makeSuspension({ id: "s-1", fighterId: "A", reason: "MEDICAL", startsOn: "2026-11-08", endsOn: "2026-11-20" })],
            TODAY,
        );
        expect(res).toEqual([
            {
                suspensionId: "s-1",
                fighterId: "A",
                reason: "MEDICAL",
                endsOn: "2026-11-20",
                daysLeft: 11,
                maxAllowedTier: 1,
            },
        ]);
    });

    it("S2", () => {
        const res = activeSuspensionLines(
            [makeSuspension({ reason: "KO", startsOn: "2026-11-03", endsOn: "2026-11-10" })],
            TODAY,
        );
        expect(res).toHaveLength(1);
        expect(res[0]?.daysLeft).toBe(1);
    });

    it("S3", () => {
        const res = activeSuspensionLines(
            [makeSuspension({ reason: "DQ", startsOn: "2026-11-12", endsOn: "2026-11-20" })],
            TODAY,
        );
        expect(res).toEqual([]);
    });

    it("S4", () => {
        const res = activeSuspensionLines(
            [makeSuspension({ reason: "KO", startsOn: "2026-10-20", endsOn: "2026-11-05", requiresClearance: true })],
            TODAY,
        );
        expect(res).toEqual([]);
    });

    it("S5", () => {
        const res = activeSuspensionLines(
            [makeSuspension({ reason: "MEDICAL", startsOn: "2026-11-08", endsOn: "2026-11-20", clearedAt: "2026-11-09T03:00:00Z" })],
            TODAY,
        );
        expect(res).toEqual([]);
    });

    it("S6", () => {
        const res = activeSuspensionLines(
            [makeSuspension({ reason: "DQ", startsOn: "2026-10-20", endsOn: "2026-11-01" })],
            TODAY,
        );
        expect(res).toEqual([]);
    });

    it("S7", () => {
        const res = activeSuspensionLines(
            [
                makeSuspension({ id: "s-1", fighterId: "A", reason: "MANDATORY_REST", startsOn: "2026-11-05", endsOn: "2026-11-15" }),
                makeSuspension({ id: "s-2", fighterId: "A", reason: "KO", startsOn: "2026-11-05", endsOn: "2026-11-25" }),
            ],
            TODAY,
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({ endsOn: "2026-11-25", reason: "KO" });
    });

    it("S8", () => {
        const res = activeSuspensionLines(
            [
                makeSuspension({ id: "s-a", fighterId: "A", reason: "KO", startsOn: "2026-11-05", endsOn: "2026-11-25" }),
                makeSuspension({ id: "s-b", fighterId: "B", reason: "MEDICAL", startsOn: "2026-11-05", endsOn: "2026-11-12" }),
            ],
            TODAY,
        );
        expect(res.map((r) => r.fighterId)).toEqual(["B", "A"]);
    });

    it("S9", () => {
        expect(activeSuspensionLines([], TODAY)).toEqual([]);
    });

    it("S10", () => {
        const res = activeSuspensionLines(
            [makeSuspension({ reason: "DQ", startsOn: "2026-10-20", endsOn: "2026-11-01", status: "ACTIVE" })],
            TODAY,
        );
        expect(res).toEqual([]);
    });

    it("R1", () => {
        const html = renderTodoCard({ todo: null, suspensions: [] });
        expect(html).toContain(tVi("coachTodo.unavailable"));
    });

    it("R2", () => {
        const html = renderTodoCard({ todo: { items: [], truncated: false }, suspensions: [] });
        expect(html).toContain(tVi("coachTodo.empty"));
    });

    it("R3", () => {
        const html = renderTodoCard({
            todo: { items: [], truncated: false },
            suspensions: [
                {
                    suspensionId: "s-1",
                    fighterId: "f-hoang-long",
                    reason: "MEDICAL",
                    endsOn: "2026-11-20",
                    daysLeft: 11,
                    maxAllowedTier: 1,
                },
            ],
            fighterNames: new Map([["f-hoang-long", "Hoàng Long"]]),
        });
        expect(html).toContain("Sau trận");
        expect(html).toContain("Hoàng Long");
        expect(html).toContain("Đình chỉ");
        expect(html).toContain("20/11");
        expect(html).toContain("11 ngày");
        expect(html).toContain("bậc 1");
        expect(html).toContain('href="/coach/bouts/suspensions#suspension-s-1"');
    });

    it("R4", () => {
        const html = renderTodoCard({
            todo: {
                items: [
                    {
                        source: "SUSPENSION_AWAITING_CLEARANCE",
                        phase: "AFTER",
                        fighterId: "f-linh-pham",
                        boutId: "b-1",
                        eventName: "MMA Cup",
                        dueOn: null,
                        count: null,
                    },
                ],
                truncated: false,
            },
            suspensions: [
                {
                    suspensionId: "s-1",
                    fighterId: "f-hoang-long",
                    reason: "MEDICAL",
                    endsOn: "2026-11-20",
                    daysLeft: 11,
                    maxAllowedTier: 1,
                },
            ],
            fighterNames: new Map([
                ["f-hoang-long", "Hoàng Long"],
                ["f-linh-pham", "Linh Phạm"],
            ]),
        });
        expect(html.indexOf("Hoàng Long")).toBeGreaterThan(-1);
        expect(html.indexOf("Linh Phạm")).toBeGreaterThan(html.indexOf("Hoàng Long"));
    });

    it("R5", () => {
        const html = renderTodoCard({
            todo: {
                items: [
                    {
                        source: "WEIGHT_OVER_LIMIT",
                        phase: "BEFORE",
                        fighterId: "X",
                        boutId: "b-x",
                        eventName: "Event X",
                        dueOn: null,
                        count: null,
                    },
                    {
                        source: "CAN_ENTER_FIGHT_WEEK",
                        phase: "BEFORE",
                        fighterId: "Y",
                        boutId: "b-y",
                        eventName: "Event Y",
                        dueOn: null,
                        count: null,
                    },
                ],
                truncated: false,
            },
            suspensions: [],
            fighterNames: new Map([
                ["X", "Võ sĩ X"],
                ["Y", "Võ sĩ Y"],
            ]),
        });
        expect(html.match(/Khẩn/g) ?? []).toHaveLength(1);
        const items = html.match(/<li[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const liX = items.find((li) => li.includes("Võ sĩ X")) ?? "";
        const liY = items.find((li) => li.includes("Võ sĩ Y")) ?? "";
        expect(liX).toContain("Khẩn");
        expect(liY).not.toContain("Khẩn");
    });

    it("R6", () => {
        const html = renderTodoCard({
            todo: { items: [], truncated: false },
            suspensions: [
                {
                    suspensionId: "s-1",
                    fighterId: "f-1",
                    reason: "KO",
                    endsOn: "2026-11-10",
                    daysLeft: 1,
                    maxAllowedTier: 1,
                },
                {
                    suspensionId: "s-2",
                    fighterId: "f-2",
                    reason: "MEDICAL",
                    endsOn: "2026-11-20",
                    daysLeft: 11,
                    maxAllowedTier: 1,
                },
            ],
            fighterNames: new Map([
                ["f-1", "Fighter One"],
                ["f-2", "Fighter Two"],
            ]),
            t: tEn,
            locale: "en",
        });
        expect(html).toContain("1 day left");
        expect(html).toContain("11 days left");
        expect(html).not.toMatch(/\b1 days\b/);
    });

    it("R7", () => {
        const html = renderTodoCard({
            todo: null,
            suspensions: [
                {
                    suspensionId: "s-1",
                    fighterId: "f-hoang-long",
                    reason: "MEDICAL",
                    endsOn: "2026-11-20",
                    daysLeft: 11,
                    maxAllowedTier: 1,
                },
            ],
            fighterNames: new Map([["f-hoang-long", "Hoàng Long"]]),
        });
        expect(html).toContain(tVi("coachTodo.unavailable"));
        expect(html).toContain("Hoàng Long");
    });

    it("R8", () => {
        const html = renderTodoCard({
            todo: { items: [], truncated: false },
            suspensions: [
                {
                    suspensionId: "s-1",
                    fighterId: "f-hoang-long",
                    reason: "MEDICAL",
                    endsOn: "2026-11-20",
                    daysLeft: 11,
                    maxAllowedTier: 1,
                },
            ],
            fighterNames: new Map([["f-hoang-long", "Hoàng Long"]]),
        });
        const items = html.match(/<li[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const li = items.find((item) => item.includes("Hoàng Long")) ?? "";
        expect(li).toContain("Khẩn");
    });

    it("R9", () => {
        const html = renderTodoCard({
            todo: {
                items: [
                    {
                        source: "CAN_ENTER_FIGHT_WEEK",
                        phase: "BEFORE",
                        fighterId: "Y",
                        boutId: "b-y",
                        eventName: "Event Y",
                        dueOn: null,
                        count: null,
                    },
                    {
                        source: "WEIGHT_NOT_WEIGHED",
                        phase: "BEFORE",
                        fighterId: "X",
                        boutId: "b-x",
                        eventName: "Event X",
                        dueOn: null,
                        count: null,
                    },
                ],
                truncated: false,
            },
            suspensions: [],
            fighterNames: new Map([
                ["X", "Võ sĩ X"],
                ["Y", "Võ sĩ Y"],
            ]),
        });
        expect(html.indexOf("Võ sĩ X")).toBeGreaterThan(-1);
        expect(html.indexOf("Võ sĩ Y")).toBeGreaterThan(html.indexOf("Võ sĩ X"));
        const items = html.match(/<li[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const liX = items.find((li) => li.includes("Võ sĩ X")) ?? "";
        expect(liX).toContain("Khẩn");
        expect(html).toContain("7 ngày chưa có số cân");
    });

    it("R10", () => {
        const html = renderTodoCard({
            todo: {
                items: [
                    {
                        source: "RESULT_OVERDUE",
                        phase: "DURING",
                        fighterId: "Z",
                        boutId: "b-z",
                        eventName: "Event Z",
                        dueOn: "2026-11-05",
                        count: null,
                    },
                ],
                truncated: false,
            },
            suspensions: [],
            fighterNames: new Map([["Z", "Võ sĩ Z"]]),
        });
        const sections = html.match(/<section[^>]*>[\s\S]*?<\/section>/g) ?? [];
        const afterSection = sections.find((s) => s.includes("Sau trận")) ?? "";
        const duringSection = sections.find((s) => s.includes("Tuần thi đấu và ngày thi")) ?? "";
        expect(afterSection).toContain("Võ sĩ Z");
        expect(duringSection).not.toContain("Võ sĩ Z");
    });

    it("R11", () => {
        const html = renderTodoCard({ todo: null, suspensions: [] });
        expect(html).not.toContain("editorial");
        expect(html.startsWith('<div data-ui="card"')).toBe(true);
    });

    it("T1", () => {
        const baseSession: Omit<TrainingSession, "id" | "fighterId" | "title" | "type" | "scheduledAt"> = {
            coachId: "c-1",
            planId: null,
            status: "scheduled",
            durationMin: 60,
            location: "Main gym",
            targetRpe: null,
            exercises: [],
            result: null,
            videoIds: [],
            cancellationReason: null,
            notes: null,
        };
        const sessions: TrainingSession[] = [
            { ...baseSession, id: "sess-a", fighterId: "A", title: "Buổi tập A", type: "sparring", scheduledAt: "2026-11-10T09:00:00.000Z" },
            { ...baseSession, id: "sess-b", fighterId: "B", title: "Buổi tập B", type: "pad_work", scheduledAt: "2026-11-10T11:00:00.000Z" },
        ];
        const html = renderToStaticMarkup(
            createElement(TodaySchedule, {
                sessions,
                fighters: {
                    A: { name: "Võ sĩ A", clearanceState: "full", suspensionState: "ACTIVE" },
                    B: { name: "Võ sĩ B", clearanceState: "full" },
                },
                t: tVi,
                locale: "vi",
            }),
        );
        const label = tVi("boutLabel.suspensionState.ACTIVE");
        const rows = html.match(/<li[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const rowA = rows.find((r) => r.includes("Võ sĩ A")) ?? "";
        const rowB = rows.find((r) => r.includes("Võ sĩ B")) ?? "";
        expect(rowA).toContain(label);
        expect(rowB).not.toContain(label);
    });

    it("P1", async () => {
        const suspensions = await listSuspensions({}, mockRafaelCoach);
        expect(suspensions.length).toBeGreaterThan(0);
        const page = await CoachSuspensionsPage({
            params: Promise.resolve({}),
            searchParams: Promise.resolve({}),
        });
        const html = renderToStaticMarkup(page);
        for (const s of suspensions) {
            expect(html).toContain(`id="suspension-${s.id}"`);
        }
    });

    it("K1", () => {
        const text = coachTodoText(
            {
                source: "TRAINING_CONFLICTS_WITH_SUSPENSION",
                phase: "AFTER",
                fighterId: "f-1",
                boutId: "b-1",
                eventName: "MMA Cup",
                dueOn: null,
                count: 2,
            },
            tVi,
            "vi",
        );
        expect(text).toBe("2 buổi tập xung đột với đình chỉ");
    });
});
