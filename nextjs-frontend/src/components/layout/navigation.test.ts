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

    it("keeps the four admin hubs that stay open (admissions is frozen, T-001)", () => {
        expect(labels("admin")).toEqual(["Today", "People", "AI platform", "System"]);
        expect(mobilePrimaryItems("admin").map((item) => item.shortLabel ?? item.label)).toEqual(["Today", "People", "AI", "System"]);
    });
});

describe("admin hubs", () => {
    const items = NAVIGATION.admin.flatMap((section) => section.items);

    it("groups the admin pages into a handful of hubs", () => {
        expect(items.map((item) => item.label)).toEqual(["Today", "People", "Training", "AI platform", "System"]);
    });

    it("finds each page's hub, including detail pages under a tab", () => {
        expect(hubForPath("admin", routes.admin.roles)?.label).toBe("People");
        expect(hubForPath("admin", routes.admin.user("u-1"))?.label).toBe("People");
        expect(hubForPath("admin", routes.admin.newUser)?.label).toBe("People");
        expect(hubForPath("admin", routes.admin.videos)?.label).toBe("AI platform");
        expect(hubForPath("admin", routes.admin.aiJob("j-1"))?.label).toBe("AI platform");
        // AI models is frozen (T-001): its pages open by URL but belong to no hub.
        expect(hubForPath("admin", routes.admin.aiModel("m-1"))).toBeNull();
        expect(hubForPath("admin", routes.admin.notifications)?.label).toBe("System");
        expect(hubForPath("admin", routes.admin.settings)?.label).toBe("System");
        expect(hubForPath("admin", routes.admin.admissions)).toBeNull();
        expect(hubForPath("admin", routes.admin.dashboard)).toBeNull();
    });

    it("shows tabs on hub pages only, and keeps single-page destinations current", () => {
        expect(hubTabsFor("admin", routes.admin.videos)?.tabs.map((tab) => tab.label)).toEqual(["AI jobs", "Videos"]);
        expect(hubTabsFor("admin", routes.admin.aiModels)).toBeNull();
        expect(hubTabsFor("admin", routes.admin.user("u-1"))).toBeNull();
        const training = items.find((item) => item.label === "Training")!;
        expect(training.href).toBe(routes.admin.exercises);
        expect(isNavItemActive(training, routes.admin.exercises)).toBe(true);
        const people = items.find((item) => item.label === "People")!;
        expect(isNavItemActive(people, routes.admin.admissions)).toBe(false);
    });

    it("carries the failed-jobs count on the AI platform hub", () => {
        expect(items.find((item) => item.badge === "failedJobs")?.label).toBe("AI platform");
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

        // Admin is grouped into hubs since main's PR #22; Admissions and AI models stay out of them.
        const adminHubs = NAVIGATION.admin.flatMap((s) => s.items).map((i) => ({ label: i.label, tabs: i.tabs?.map((tab) => tab.label) }));
        expect(adminHubs).toEqual([
            { label: "Today", tabs: undefined },
            { label: "People", tabs: ["Users", "Roles & permissions"] },
            { label: "Training", tabs: undefined },
            { label: "AI platform", tabs: ["AI jobs", "Videos"] },
            { label: "System", tabs: ["Audit logs", "Broadcasts", "Settings"] },
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
