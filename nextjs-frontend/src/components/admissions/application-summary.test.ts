import { describe, expect, it } from "vitest";

import { applicationSummary, weightClassLimit } from "./application-summary";

const answers = (values: Record<string, string>) => (name: string) => values[name] ?? null;

describe("applicationSummary", () => {
    it("shows the answers in the form's words, with the weight limit and the account email", () => {
        const [about, experience] = applicationSummary(
            answers({ firstName: " Quang ", lastName: "Hồ", dateOfBirth: "2003-07-19", weightClass: "lightweight", trainingBackground: "Boxing.\nMuay Thai." }),
            "quang@example.test",
        );
        expect(about).toEqual({
            step: "about",
            title: "About you",
            items: [
                { label: "Name", value: "Quang Hồ" },
                { label: "Date of birth", value: "19 Jul 2003" },
                { label: "Weight class", value: "Lightweight · up to 70.3 kg" },
                { label: "Email", value: "quang@example.test" },
            ],
        });
        expect(experience.step).toBe("experience");
        expect(experience.items.find((item) => item.label === "Training background")).toEqual({ label: "Training background", value: "Boxing.\nMuay Thai.", long: true });
    });

    it("marks blank or unreadable answers as not given", () => {
        const [about, experience] = applicationSummary(answers({ firstName: "  ", dateOfBirth: "19/07/2003", weightClass: "catchweight", nationality: " " }), "a@example.test");
        expect(about.items.slice(0, 3).map((item) => item.value)).toEqual([null, null, null]);
        expect(experience.items.every((item) => item.value === null)).toBe(true);
    });
});

describe("weightClassLimit", () => {
    it("states the upper limit in kg", () => {
        expect(weightClassLimit("flyweight")).toBe("Up to 56.7 kg");
        expect(weightClassLimit("heavyweight")).toBe("Up to 120.2 kg");
    });
});
