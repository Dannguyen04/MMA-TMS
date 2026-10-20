import { describe, expect, it } from "vitest";

import { applySessionTemplate, sessionTemplateNotes, SESSION_NOTES_MAX_LENGTH, type SessionTemplate, type TemplateFormFields } from "./session-templates";
import type { TrainingType } from "./types";

const DEFAULT_LOCATION: Record<string, string> = { pad_work: "Striking room", sparring: "Cage", tactical_analysis: "Film room" };
const defaultLocationFor = (type: TrainingType) => DEFAULT_LOCATION[type] ?? "Striking room";

const template: SessionTemplate = {
    id: "t1",
    code: "distance",
    category: "TECHNIQUE",
    type: "pad_work",
    durationMin: 45,
    targetRpe: 5,
    name: "Jab – cross – thoát góc",
    purpose: "Thoát khỏi đường phản công.",
    rationale: "Phù hợp điểm yếu đang theo dõi.",
    steps: [
        { name: "Chuẩn bị", detail: "HLV kiểm tra tư thế." },
        { name: "Bài tập chính", detail: "Jab – cross trên đích." },
        { name: "Kiểm tra cuối buổi", detail: "Ghi số lần đạt." },
    ],
};

interface Values extends TemplateFormFields {
    fighterId: string;
    planId: string;
    date: string;
    time: string;
    exercises: string[];
}

const blank: Values = {
    fighterId: "",
    planId: "",
    title: "",
    type: "shadow_boxing",
    date: "",
    time: "",
    durationMin: "60",
    location: "",
    targetRpe: 6,
    exercises: [],
    notes: "",
};

describe("sessionTemplateNotes", () => {
    it("numbers the steps, one per line", () => {
        expect(sessionTemplateNotes(template.steps)).toBe(
            "1. Chuẩn bị: HLV kiểm tra tư thế.\n2. Bài tập chính: Jab – cross trên đích.\n3. Kiểm tra cuối buổi: Ghi số lần đạt.",
        );
    });

    it("never exceeds what the notes field accepts", () => {
        const long = [{ name: "A", detail: "x".repeat(2000) }];
        expect(sessionTemplateNotes(long)).toHaveLength(SESSION_NOTES_MAX_LENGTH);
    });
});

describe("applySessionTemplate", () => {
    it("fills title, type, duration, RPE, notes and the type's default location on an empty form", () => {
        const next = applySessionTemplate(blank, template, defaultLocationFor);
        expect(next).toMatchObject({
            title: "Jab – cross – thoát góc",
            type: "pad_work",
            durationMin: "45",
            targetRpe: 5,
            location: "Striking room",
        });
        expect(next.notes.split("\n")).toHaveLength(3);
    });

    it("leaves fighter, plan, date, time and exercises untouched", () => {
        const filled: Values = { ...blank, fighterId: "f1", planId: "p1", date: "2026-10-27", time: "16:00", exercises: ["e1"] };
        const next = applySessionTemplate(filled, template, defaultLocationFor);
        expect(next).toMatchObject({ fighterId: "f1", planId: "p1", date: "2026-10-27", time: "16:00", exercises: ["e1"] });
    });

    it("overwrites what the coach typed in the fields the template fills", () => {
        const typed: Values = { ...blank, title: "My title", notes: "My notes", durationMin: "90", targetRpe: 9 };
        const next = applySessionTemplate(typed, template, defaultLocationFor);
        expect(next).toMatchObject({ title: "Jab – cross – thoát góc", durationMin: "45", targetRpe: 5 });
        expect(next.notes).not.toContain("My notes");
    });

    it("keeps a location the coach typed", () => {
        const next = applySessionTemplate({ ...blank, location: "Outdoor track" }, template, defaultLocationFor);
        expect(next.location).toBe("Outdoor track");
    });

    it("moves the location along when it was the default of the previous type", () => {
        const sparring: Values = { ...blank, type: "sparring", location: "Cage" };
        expect(applySessionTemplate(sparring, template, defaultLocationFor).location).toBe("Striking room");
        const tactics: SessionTemplate = { ...template, type: "tactical_analysis" };
        expect(applySessionTemplate({ ...blank, type: "pad_work", location: "Striking room" }, tactics, defaultLocationFor).location).toBe("Film room");
    });
});
