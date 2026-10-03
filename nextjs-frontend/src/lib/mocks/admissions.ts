import type { Applicant, Application, AssessmentCriterion } from "@/lib/domain/admissions";
import { daysAgo } from "./time";

/*
 * Fighter admissions for the demo: self-registered applicants and their applications at every stage. Applicants
 * sign in with the demo password like everyone else; the one without an application is the "Applicant" demo account.
 */

export const mockApplicants: Applicant[] = [
    { id: "a-quang-ho", email: "quang.ho@lotus-combat.test" },
    { id: "a-khoa-vu", email: "khoa.vu@lotus-combat.test" },
    { id: "a-mai-do", email: "mai.do@lotus-combat.test" },
    { id: "a-arjun-patel", email: "arjun.patel@lotus-combat.test" },
    { id: "a-hana-sato", email: "hana.sato@lotus-combat.test" },
    { id: "a-tom-reyes", email: "tom.reyes@lotus-combat.test" },
];

const ARJUN_CRITERIA: AssessmentCriterion[] = [
    {
        criterionName: "Conditioning",
        method: "Three 3-minute pad rounds at competition pace, 1 minute rest",
        observation: "Kept the pace through round three; breathing settled within the rest.",
        value: 3,
        unit: "rounds",
        note: null,
    },
    {
        criterionName: "Striking fundamentals",
        method: "Jab–cross–hook and teep on pads",
        observation: "Guard comes back after each strike and the hips turn through the cross. Drops the right hand on the hook.",
        value: null,
        unit: null,
        note: "Work on the guard during the first block.",
    },
    {
        criterionName: "Takedown defence",
        method: "Five live single-leg entries from a partner",
        observation: "Sprawled in time on four of five; stayed square after the scramble.",
        value: 4,
        unit: "of 5 defended",
        note: null,
    },
];

const details = (email: string, firstName: string, lastName: string, extra: Partial<Application["applicant"]> = {}): Application["applicant"] => ({
    email,
    firstName,
    lastName,
    dateOfBirth: "2003-05-14",
    weightClass: "lightweight",
    nationality: "Vietnamese",
    contactPhone: null,
    trainingBackground: null,
    competitionBackground: null,
    motivation: null,
    ...extra,
});

const open = { accountEmail: null, assessment: null, decision: null, activation: null } satisfies Partial<Application>;

export const mockApplications: Application[] = [
    {
        id: "app-khoa-vu",
        applicantId: "a-khoa-vu",
        status: "submitted",
        submittedAt: daysAgo(1, 20, 15),
        applicant: details("khoa.vu@lotus-combat.test", "Khoa", "Vũ", {
            dateOfBirth: "2004-11-02",
            weightClass: "featherweight",
            trainingBackground: "Two years of Muay Thai at a local gym, three sessions a week.",
            motivation: "I want to train full time and have my first amateur bout next year.",
        }),
        evaluator: null,
        ...open,
    },
    {
        id: "app-mai-do",
        applicantId: "a-mai-do",
        status: "submitted",
        submittedAt: daysAgo(4, 18, 40),
        applicant: details("mai.do@lotus-combat.test", "Mai", "Đỗ", {
            dateOfBirth: "2002-03-21",
            weightClass: "strawweight",
            contactPhone: "+84 912 334 210",
            trainingBackground: "Judo brown belt; started BJJ last year.",
            competitionBackground: "Regional judo championships, two silver medals.",
            motivation: "I want to add striking and compete in MMA.",
        }),
        evaluator: { coachId: "c-rafael-costa", since: daysAgo(3, 10) },
        ...open,
    },
    {
        id: "app-arjun-patel",
        applicantId: "a-arjun-patel",
        status: "passed",
        submittedAt: daysAgo(12, 9, 5),
        applicant: details("arjun.patel@lotus-combat.test", "Arjun", "Patel", {
            dateOfBirth: "2000-08-09",
            weightClass: "welterweight",
            nationality: "Indian",
            trainingBackground: "Kickboxing for four years, wrestling in high school.",
            competitionBackground: "3–1 in amateur kickboxing.",
        }),
        accountEmail: null,
        evaluator: { coachId: "c-rafael-costa", since: daysAgo(10, 11) },
        assessment: {
            coachId: "c-rafael-costa",
            conclusion: "pass",
            summary: "Fit and coachable, with a solid kickboxing base. Needs wrestling volume before any MMA bout.",
            criteria: ARJUN_CRITERIA,
            assessedAt: daysAgo(6, 16, 30),
        },
        decision: null,
        activation: null,
    },
    {
        id: "app-hana-sato",
        applicantId: "a-hana-sato",
        status: "approved",
        submittedAt: daysAgo(21, 8, 30),
        applicant: details("hana.sato@lotus-combat.test", "Hana", "Satō", { dateOfBirth: "2001-01-30", weightClass: "flyweight", nationality: "Japanese" }),
        accountEmail: null,
        evaluator: { coachId: "c-anna-volkova", since: daysAgo(19, 10) },
        assessment: {
            coachId: "c-anna-volkova",
            conclusion: "pass",
            summary: "Excellent grappling base and conditioning.",
            criteria: [
                { criterionName: "Grappling", method: "Five-minute positional rounds", observation: "Controlled side control and finished from the back twice.", value: null, unit: null, note: null },
            ],
            assessedAt: daysAgo(15, 17),
        },
        decision: { decision: "approved", reason: "Passed the assessment; space in the flyweight group.", decidedAt: daysAgo(14, 9) },
        // The demo has no email step: the activation is ready as soon as the application is approved.
        activation: { status: "password_set", emailsSent: 1, lastEmailAt: daysAgo(14, 9), completedAt: null },
    },
    {
        id: "app-tom-reyes",
        applicantId: "a-tom-reyes",
        status: "failed",
        submittedAt: daysAgo(40, 14),
        applicant: details("tom.reyes@lotus-combat.test", "Tom", "Reyes", { weightClass: "middleweight", nationality: "Filipino" }),
        accountEmail: null,
        evaluator: { coachId: "c-james-okafor", since: daysAgo(38, 10) },
        assessment: {
            coachId: "c-james-okafor",
            conclusion: "fail",
            summary: "Not ready for the full-time programme yet. Encouraged to reapply after six months of conditioning.",
            criteria: [
                { criterionName: "Conditioning", method: "Three 3-minute pad rounds", observation: "Stopped midway through round two.", value: 1.5, unit: "rounds", note: null },
            ],
            assessedAt: daysAgo(35, 15),
        },
        decision: null,
        activation: null,
    },
];
