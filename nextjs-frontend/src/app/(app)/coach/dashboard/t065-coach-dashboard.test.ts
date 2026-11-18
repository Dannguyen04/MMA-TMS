import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CampBout } from "@/lib/domain/bout";
import type { User } from "@/lib/domain/types";
import { createTranslator } from "@/lib/i18n/translate";
import { mockCoaches, mockUsers } from "@/lib/mocks/people";
import { routes } from "@/lib/routes";
import { listSuspensions } from "@/lib/services/suspensions";
import { CoachHero } from "./coach-hero";
import type { ActiveSuspensionLine } from "./coach-todo-card";
import CoachDashboardPage from "./page";

const baseRafael = mockUsers.find((u) => u.id === "u-rafael-costa")!;
const rafaelCoach = mockCoaches.find((c) => c.userId === "u-rafael-costa")!;
const mockRafaelCoach: User = {
    ...baseRafael,
    effectiveCapabilities: ["fighters:read", "fighters:write", "training:read", "training:write"],
    assignmentScope: { fighterIds: [...rafaelCoach.fighterIds] },
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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
    return { getTranslator: async () => ({ locale: "vi" as const, t: makeT("vi") }) };
});

vi.mock("@/lib/services/suspensions", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/services/suspensions")>();
    return { ...actual, listSuspensions: vi.fn(actual.listSuspensions) };
});

const NOW = "2026-11-10T03:00:00Z";
const t = createTranslator("vi");

function bout(phase: CampBout["phase"], weighInOn: string, boutOn: string): CampBout {
    return { id: "b-1", fighterId: "f-1", event: "Lion Championship 25", phase, weighInAt: `${weighInOn}T05:00:00Z`, boutAt: `${boutOn}T05:00:00Z` } as CampBout;
}

function render(props: { bouts?: CampBout[] | null; suspensions?: ActiveSuspensionLine[] | null }): string {
    return renderToStaticMarkup(
        createElement(CoachHero, {
            bouts: props.bouts === undefined ? [] : props.bouts,
            suspensions: props.suspensions === undefined ? [] : props.suspensions,
            roster: [],
            todaySessions: [],
            fighterNames: new Map([["f-1", "Hoàng Long"]]),
            now: NOW,
            t,
            locale: "vi",
        }),
    );
}

/** The figure in the stat cell whose label is `label`. */
function stat(html: string, label: string): string | undefined {
    return html.match(new RegExp(`${label}</span>[\\s\\S]*?tabular-nums">([^<]+)<`))?.[1];
}

describe("T-065: coach dashboard review fixes", () => {
    it("F1a", () => {
        const html = render({ bouts: [bout("FIGHT_WEEK", "2026-11-09", "2026-11-11")] });
        expect(html).toContain("Chưa ghi cân chính thức");
        expect(html).not.toContain("hôm nay cân");
        expect(html).not.toMatch(/<\w+[^>]*class="[^"]*font-display[^"]*">0<\//);
    });

    it("F1b", () => {
        const html = render({ bouts: [bout("WEIGHED_IN", "2026-11-09", "2026-11-11")] });
        expect(html).toContain("đã cân");
        expect(html).not.toContain("Chưa ghi cân chính thức");
    });

    it("F1c", () => {
        const html = render({ bouts: [bout("FIGHT_WEEK", "2026-11-10", "2026-11-11")] });
        expect(html).toContain("hôm nay cân");
    });

    it("F2a", () => {
        const html = render({ bouts: null });
        expect(html).toContain("Không tải được danh sách trận");
        expect(html).not.toContain("Chưa có trận nào trong camp");
        expect(html).not.toContain(`href="${routes.coach.newBout}"`);
        expect(stat(html, "Trận đang chạy")).toBe("—");
    });

    it("F2b", () => {
        const html = render({ suspensions: null });
        expect(stat(html, "Đang đình chỉ")).toBe("—");
        expect(html).toContain("không tải được");
    });

    it("F2c", () => {
        const html = render({ bouts: [], suspensions: [] });
        expect(html).toContain("Chưa có trận nào trong camp");
        expect(stat(html, "Đang đình chỉ")).toBe("0");
        const newBoutLink = html.match(/<a [^>]*>/g)?.find((tag) => tag.includes(`href="${routes.coach.newBout}"`));
        expect(newBoutLink).toMatch(/class="[^"]*focus-visible:outline-white/);
    });

    it("F3a", async () => {
        delete (globalThis as Record<string, unknown>).__mmaMockDb;
        await CoachDashboardPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) } as PageProps<"/coach/dashboard">);
        expect(listSuspensions).toHaveBeenCalledWith(expect.objectContaining({ active: true }), mockRafaelCoach);
    });
});
