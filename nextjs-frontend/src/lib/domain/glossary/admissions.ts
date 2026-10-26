import type { GlossaryEntry } from "./types";

/** Admission, account and care-team terms. */
export const ADMISSION_TERMS = {
    weightClass: {
        term: "Weight class",
        definition: "The division a fighter competes in, set by body weight. They must make the limit at the official weigh-in.",
    },
    stance: {
        term: "Stance",
        definition: "Orthodox leads with the left hand and foot, southpaw with the right; switch fighters use both.",
    },
    verificationCode: {
        term: "Verification code",
        definition: "A one-time number sent to your email. It proves the address is yours; it isn't a password.",
    },
    entranceAssessment: {
        term: "Entrance assessment",
        definition: "A tryout where an assessing coach checks the applicant against set criteria and records a pass or fail. That coach doesn't automatically train the fighter.",
    },
    assessmentCriterion: {
        term: "Criterion",
        definition: "One thing the assessor checks, such as conditioning or defence, with how it was tested and what they saw.",
    },
    activation: {
        term: "Activation",
        definition: "The last admission step: once the password is set, the applicant's account becomes a fighter account.",
    },
    careTeam: {
        term: "Care team",
        definition: "The coach who trains the fighter and the sports doctor responsible for their medical checks.",
    },
} as const satisfies Record<string, GlossaryEntry>;
