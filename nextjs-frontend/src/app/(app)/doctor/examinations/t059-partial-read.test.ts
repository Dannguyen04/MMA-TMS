import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MedicalExamination, User } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import * as medicalService from "@/lib/services/medical";
import * as peopleService from "@/lib/services/people";
import { ExaminationsView } from "@/components/doctor/views/examinations-view";

/** T-059 (on Fon's ExaminationsView since the 10/11 merge): a medical service that fails for one read must not take /doctor/examinations down. */

const doctor: User = {
    id: "u-doctor-d",
    email: "thu.le@example.com",
    name: "BS. Thu Lê",
    role: "doctor",
    title: "Bác sĩ thể thao",
    phone: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    lastActiveAt: null,
    profileId: "d-doctor-d",
    effectiveCapabilities: ["fighters:read", "medical:read", "medical:write"],
    assignmentScope: { fighterIds: ["f-1", "f-2"] },
};

vi.mock("@/lib/auth/session", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/auth/session")>()), requireRole: vi.fn(async () => doctor) }));
vi.mock("@/lib/services/people", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/services/people")>()), listFighters: vi.fn() }));
vi.mock("@/lib/services/medical", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/services/medical")>()), listExaminations: vi.fn() }));

function exam(id: string, fighterId: string, date: string): MedicalExamination {
    return {
        id,
        fighterId,
        doctorId: "d-doctor-d",
        date,
        type: "routine",
        vitals: null,
        assessments: [],
        outcome: "fit",
        summary: "Bình thường",
        recommendations: "",
        followUpDate: null,
        scope: "TRAINING",
        validUntil: null,
    };
}

async function serviceDown() {
    const { ApiError } = await import("@/lib/api/client");
    return new ApiError({ message: "Service unavailable", kind: "http", status: 503, code: "SERVICE_UNAVAILABLE" });
}

/** Each fighter's examinations, by the fighter asked for; `Error` values reject. */
function examinationsBy(byFighter: Record<string, MedicalExamination[] | Error>) {
    vi.mocked(medicalService.listExaminations).mockImplementation(async (filter) => {
        const ids = filter?.fighterIds === "all" || !filter?.fighterIds ? Object.keys(byFighter) : filter.fighterIds;
        const answers = ids.map((id) => byFighter[id] ?? []);
        const failure = answers.find((answer) => answer instanceof Error);
        if (failure) throw failure;
        return answers.flatMap((answer) => answer as MedicalExamination[]);
    });
}

async function render(query: Record<string, string> = {}) {
    return renderToStaticMarkup(await ExaminationsView({ query }));
}

const rows = (html: string) => html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1].match(/<tr[\s\S]*?<\/tr>/g) ?? [];

describe("T-059 /doctor/examinations reads", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(peopleService.listFighters).mockResolvedValue([
            { id: "f-1", name: "Nguyễn Văn A" },
            { id: "f-2", name: "Trần Văn B" },
        ] as Awaited<ReturnType<typeof peopleService.listFighters>>);
    });

    it("lists every assigned fighter's examinations, newest first, asking only for assigned fighters", async () => {
        examinationsBy({ "f-1": [exam("e-old", "f-1", "2026-11-01T08:00:00Z")], "f-2": [exam("e-new", "f-2", "2026-11-05T08:00:00Z")] });
        const html = await render();
        const list = rows(html);
        expect(list).toHaveLength(2);
        expect(list[0]).toContain(routes.doctor.fighterExamination("f-2", "e-new"));
        expect(list[1]).toContain(routes.doctor.fighterExamination("f-1", "e-old"));
        const asked = vi.mocked(medicalService.listExaminations).mock.calls.flatMap(([filter]) => filter?.fighterIds ?? []);
        expect(asked.sort()).toEqual(["f-1", "f-2"]);
        expect(html).not.toContain('data-tone="amber"');
    });

    it("keeps the other fighters' examinations and says the list may be incomplete when one fighter's read fails", async () => {
        examinationsBy({ "f-1": [exam("e-1", "f-1", "2026-11-01T08:00:00Z")], "f-2": await serviceDown() });
        const html = await render();
        expect(rows(html)).toHaveLength(1);
        expect(html).toContain("Không đọc được phiếu khám của 1 võ sĩ");
    });

    it("still lists the examinations, without names or the fighter filter, when the fighter list fails", async () => {
        vi.mocked(peopleService.listFighters).mockRejectedValue(await serviceDown());
        examinationsBy({ "f-1": [exam("e-1", "f-1", "2026-11-01T08:00:00Z")] });
        const html = await render();
        expect(rows(html)).toHaveLength(1);
        expect(html).toContain("Không đọc được danh sách võ sĩ");
        expect(html).not.toContain("Tất cả võ sĩ");
    });

    it("shows an error box with a reload link, not the empty state, when every read fails", async () => {
        examinationsBy({ "f-1": await serviceDown(), "f-2": await serviceDown() });
        const html = await render();
        expect(html).toContain('role="alert"');
        expect(html).toContain("Không đọc được phiếu khám");
        expect(html).not.toContain("Chưa có phiếu khám");
    });

    it("still throws when the session has lapsed", async () => {
        const { ApiError } = await import("@/lib/api/client");
        vi.mocked(peopleService.listFighters).mockRejectedValue(new ApiError({ message: "expired", kind: "unauthorized", status: 401, code: "UNAUTHORIZED" }));
        examinationsBy({ "f-1": [] });
        await expect(render()).rejects.toThrow("expired");
    });

    it("reads only the requested fighter when the filter names an assigned one, and ignores an unassigned one", async () => {
        examinationsBy({ "f-1": [exam("e-1", "f-1", "2026-11-01T08:00:00Z")], "f-2": [exam("e-2", "f-2", "2026-11-02T08:00:00Z")], "f-9": [exam("e-9", "f-9", "2026-11-03T08:00:00Z")] });
        expect(rows(await render({ fighter: "f-1" }))).toHaveLength(1);
        vi.mocked(medicalService.listExaminations).mockClear();
        const html = await render({ fighter: "f-9" });
        expect(html).not.toContain(routes.doctor.fighterExamination("f-9", "e-9"));
        const asked = vi.mocked(medicalService.listExaminations).mock.calls.flatMap(([filter]) => filter?.fighterIds ?? []);
        expect(asked).not.toContain("f-9");
    });
});
