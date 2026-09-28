import { describe, expect, it } from "vitest";

import { routes } from "@/lib/routes";
import { NAVIGATION, hubForPath, hubTabsFor, isNavItemActive, mobilePrimaryItems } from "./navigation";

const labels = (role: Parameters<typeof mobilePrimaryItems>[0]) => mobilePrimaryItems(role).map((item) => item.label);

describe("hubForPath", () => {
    it("finds the hub from any of its tabs", () => {
        expect(hubForPath("fighter", routes.fighter.schedule)?.label).toBe("Training");
        expect(hubForPath("fighter", routes.fighter.training)?.label).toBe("Training");
        expect(hubForPath("fighter", routes.fighter.history)?.label).toBe("Training");
        expect(hubForPath("fighter", routes.fighter.goals)?.label).toBe("Progress");
        expect(hubForPath("coach", routes.coach.plans)?.label).toBe("Training");
        expect(hubForPath("doctor", routes.doctor.clearance)?.label).toBe("Clinical");
    });

    it("keeps the hub for detail pages under a tab", () => {
        expect(hubForPath("fighter", routes.fighter.plan("p-1"))?.label).toBe("Training");
        expect(hubForPath("fighter", routes.fighter.session("s-1"))?.label).toBe("Training");
        expect(hubForPath("fighter", routes.fighter.technique("jab"))?.label).toBe("Progress");
        expect(hubForPath("coach", routes.coach.fighter("f-1"))?.label).toBe("Roster");
        expect(hubForPath("doctor", routes.doctor.grantClearance)?.label).toBe("Clinical");
    });

    it("returns nothing for single-page destinations and shared pages", () => {
        expect(hubForPath("fighter", routes.fighter.dashboard)).toBeNull();
        expect(hubForPath("fighter", routes.fighter.videos)).toBeNull();
        expect(hubForPath("coach", routes.coach.videoAnalysis)).toBeNull();
        expect(hubForPath("fighter", routes.notifications)).toBeNull();
    });
});

describe("hubTabsFor", () => {
    it("shows the tabs only on the hub's own tab pages", () => {
        expect(hubTabsFor("fighter", routes.fighter.history)).toEqual({
            label: "Training",
            tabs: [
                { label: "Schedule", href: routes.fighter.schedule },
                { label: "Plans", href: routes.fighter.training },
                { label: "History", href: routes.fighter.history },
            ],
        });
        expect(hubTabsFor("coach", routes.coach.performance)?.label).toBe("Roster");
    });

    it("hides them on detail pages, which keep their back link and own tabs", () => {
        expect(hubTabsFor("fighter", routes.fighter.plan("p-1"))).toBeNull();
        expect(hubTabsFor("fighter", routes.fighter.technique("jab"))).toBeNull();
        expect(hubTabsFor("coach", routes.coach.fighter("f-1"))).toBeNull();
        expect(hubTabsFor("coach", routes.coach.fighterGoals("f-1"))).toBeNull();
        expect(hubTabsFor("doctor", routes.doctor.newExamination)).toBeNull();
    });
});

describe("isNavItemActive", () => {
    const items = NAVIGATION.fighter.flatMap((section) => section.items);
    const training = items.find((item) => item.label === "Training")!;
    const today = items.find((item) => item.label === "Today")!;

    it("keeps a hub current across its tabs and their detail pages", () => {
        expect(isNavItemActive(training, routes.fighter.schedule)).toBe(true);
        expect(isNavItemActive(training, routes.fighter.history)).toBe(true);
        expect(isNavItemActive(training, routes.fighter.session("s-1"))).toBe(true);
        expect(isNavItemActive(training, routes.fighter.videos)).toBe(false);
    });

    it("matches a plain item by prefix", () => {
        expect(isNavItemActive(today, routes.fighter.dashboard)).toBe(true);
        expect(isNavItemActive(today, routes.fighter.schedule)).toBe(false);
    });
});

describe("mobilePrimaryItems", () => {
    it("lists every hub for roles built on hubs", () => {
        expect(labels("fighter")).toEqual(["Today", "Training", "Film", "Progress", "Health"]);
        expect(labels("coach")).toEqual(["Today", "Roster", "Training", "Film room", "Clearance"]);
        expect(labels("doctor")).toEqual(["Triage", "Patients", "Clinical", "Observations"]);
    });

    it("keeps admin's four most-used pages", () => {
        expect(labels("admin")).toEqual(["Dashboard", "Users", "AI jobs", "Audit logs"]);
    });
});
