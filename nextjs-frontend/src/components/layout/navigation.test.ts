import { describe, expect, it } from "vitest";

import { routes } from "@/lib/routes";
import { NAVIGATION, hubForPath, hubTabsFor, isNavItemActive, mobilePrimaryItems } from "./navigation";

const labels = (role: Parameters<typeof mobilePrimaryItems>[0]) => mobilePrimaryItems(role).map((item) => item.label);

describe("hubForPath", () => {
    it("finds the hub from any of its tabs", () => {
        expect(hubForPath("fighter", routes.fighter.schedule)?.label).toBe("Training");
        expect(hubForPath("fighter", routes.fighter.training)?.label).toBe("Training");
        expect(hubForPath("fighter", routes.fighter.history)?.label).toBe("Training");
        expect(hubForPath("coach", routes.coach.sessions)?.label).toBe("Training");
        expect(hubForPath("coach", routes.coach.plans)?.label).toBe("Training");
        expect(hubForPath("doctor", routes.doctor.injuries)?.label).toBe("Clinical");
        expect(hubForPath("doctor", routes.doctor.clearance)?.label).toBe("Clinical");
    });

    it("keeps the hub for detail pages under a tab", () => {
        expect(hubForPath("fighter", routes.fighter.plan("p-1"))?.label).toBe("Training");
        expect(hubForPath("fighter", routes.fighter.session("s-1"))?.label).toBe("Training");
        expect(hubForPath("coach", routes.coach.plan("p-1"))?.label).toBe("Training");
        expect(hubForPath("coach", routes.coach.bout("b-1"))?.label).toBe("Bouts");
        expect(hubForPath("coach", routes.coach.newBout)?.label).toBe("Bouts");
        expect(hubForPath("coach", routes.coach.session("s-1"))?.label).toBe("Training");
        expect(hubForPath("doctor", routes.doctor.injury("inj-1"))?.label).toBe("Clinical");
        expect(hubForPath("doctor", routes.doctor.grantClearance)?.label).toBe("Clinical");
    });

    it("returns nothing for single-page destinations and shared pages", () => {
        expect(hubForPath("fighter", routes.fighter.dashboard)).toBeNull();
        expect(hubForPath("fighter", routes.fighter.videos)).toBeNull();
        expect(hubForPath("coach", routes.coach.videoAnalysis)).toBeNull();
        expect(hubForPath("coach", routes.coach.fighters)).toBeNull();
        expect(hubForPath("doctor", routes.doctor.fighters)).toBeNull();
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
        expect(hubTabsFor("coach", routes.coach.sessions)).toEqual({
            label: "Training",
            tabs: [
                { label: "Sessions", href: routes.coach.sessions },
                { label: "Plans", href: routes.coach.plans },
            ],
        });
        expect(hubTabsFor("coach", routes.coach.suspensions)).toEqual({
            label: "Bouts",
            tabs: [
                { label: "Upcoming", href: routes.coach.bouts },
                { label: "Suspensions", href: routes.coach.suspensions },
            ],
        });
        expect(hubTabsFor("doctor", routes.doctor.injuries)).toEqual({
            label: "Clinical",
            tabs: [
                { label: "Injuries", href: routes.doctor.injuries },
                { label: "Clearance", href: routes.doctor.clearance },
            ],
        });
    });

    it("hides them on detail pages, which keep their back link and own tabs", () => {
        expect(hubTabsFor("fighter", routes.fighter.plan("p-1"))).toBeNull();
        expect(hubTabsFor("coach", routes.coach.plan("p-1"))).toBeNull();
        expect(hubTabsFor("coach", routes.coach.bout("b-1"))).toBeNull();
        expect(hubTabsFor("doctor", routes.doctor.injury("inj-1"))).toBeNull();
        expect(hubTabsFor("doctor", routes.doctor.grantClearance)).toBeNull();
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
        expect(labels("fighter")).toEqual(["Today", "Bout", "Training", "Film", "Health"]);
        expect(labels("coach")).toEqual(["Today", "Bouts", "Roster", "Training", "Film room", "Clearance"]);
        expect(labels("doctor")).toEqual(["Triage", "Patients", "Clinical"]);
    });

    it("keeps admin's four most-used pages", () => {
        expect(labels("admin")).toEqual(["Dashboard", "Users", "AI jobs", "Audit logs"]);
    });
});

describe("acceptance criteria: frozen navigation removal", () => {
    const HIDDEN_ROUTES = [
        routes.fighter.performance,
        routes.fighter.goals,
        routes.coach.performance,
        routes.coach.goals,
        routes.coach.admissions,
        routes.doctor.records,
        routes.doctor.examinations,
        routes.doctor.recovery,
        routes.doctor.aiAlerts,
        routes.admin.admissions,
        routes.admin.aiModels,
    ];

    it("criterion 1: does not contain any hidden/frozen destination or tab in NAVIGATION", () => {
        const allHrefs: string[] = [];
        for (const role of Object.keys(NAVIGATION) as (keyof typeof NAVIGATION)[]) {
            for (const section of NAVIGATION[role]) {
                for (const item of section.items) {
                    allHrefs.push(item.href);
                    if (item.tabs) {
                        for (const tab of item.tabs) {
                            allHrefs.push(tab.href);
                        }
                    }
                }
            }
        }

        for (const hiddenRoute of HIDDEN_ROUTES) {
            expect(allHrefs).not.toContain(hiddenRoute);
        }
    });

    it("criterion 2: all kept items are present in correct order", () => {
        expect(NAVIGATION.fighter.flatMap((s) => s.items).map((i) => i.label)).toEqual([
            "Today",
            "Bout",
            "Training",
            "Film",
            "Health",
        ]);

        expect(NAVIGATION.coach.flatMap((s) => s.items).map((i) => i.label)).toEqual([
            "Today",
            "Bouts",
            "Roster",
            "Training",
            "Film room",
            "Clearance",
        ]);

        expect(NAVIGATION.doctor.flatMap((s) => s.items).map((i) => i.label)).toEqual([
            "Triage",
            "Patients",
            "Clinical",
        ]);

        const adminSections = NAVIGATION.admin.map((s) => ({
            label: s.label,
            items: s.items.map((i) => i.label),
        }));
        expect(adminSections).toEqual([
            { label: undefined, items: ["Dashboard"] },
            { label: "Access", items: ["Users", "Roles & permissions"] },
            { label: "AI platform", items: ["Videos", "AI jobs"] },
            { label: "Operations", items: ["Audit logs", "Broadcasts", "System settings"] },
        ]);

        const clinical = NAVIGATION.doctor
            .flatMap((s) => s.items)
            .find((i) => i.label === "Clinical")!;
        expect(clinical.href).toBe(routes.doctor.injuries);
        expect(clinical.tabs).toEqual([
            { label: "Injuries", href: routes.doctor.injuries },
            { label: "Clearance", href: routes.doctor.clearance },
        ]);
    });

    it("criterion 3: no hub has exactly one tab", () => {
        for (const role of Object.keys(NAVIGATION) as (keyof typeof NAVIGATION)[]) {
            for (const section of NAVIGATION[role]) {
                for (const item of section.items) {
                    if (item.tabs) {
                        expect(item.tabs.length).toBeGreaterThanOrEqual(2);
                        expect(item.tabs.length).not.toBe(1);
                    }
                }
            }
        }
    });
});
