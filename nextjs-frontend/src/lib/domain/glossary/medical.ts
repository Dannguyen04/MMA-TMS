import type { GlossaryEntry } from "./types";

/** Clinical terms on the doctor's forms and the fighter's health pages. */
export const MEDICAL_TERMS = {
    restingHeartRate: {
        term: "Resting heart rate",
        definition: "Heartbeats per minute after sitting quietly for about 5 minutes. Trained fighters are often between 40 and 60 bpm.",
    },
    systolicPressure: {
        term: "Systolic pressure",
        definition: "The top blood-pressure number: pressure in the arteries while the heart beats, in mmHg. Under 120 is normal at rest.",
    },
    diastolicPressure: {
        term: "Diastolic pressure",
        definition: "The bottom blood-pressure number: pressure in the arteries between beats, in mmHg. Under 80 is normal at rest.",
    },
    bodyTemperature: {
        term: "Body temperature",
        definition: "Measured in °C. About 36.1–37.2 °C is normal at rest; 38 °C or higher counts as a fever.",
    },
    spo2: {
        term: "SpO₂",
        definition: "Blood oxygen saturation: the share of red blood cells carrying oxygen, read with a finger clip (pulse oximeter). 95–100% is normal at rest.",
    },
    hydration: {
        term: "Hydration status",
        definition: "How well hydrated the fighter is, usually judged from urine colour or a urine test. It matters most around weight cuts.",
    },
    baselineExam: {
        term: "Baseline exam",
        definition: "The first full medical check, done while the fighter is healthy. Later exams are compared with it, and training can't start without it.",
    },
    examinationScope: {
        term: "Scope",
        definition: "What the decision covers: whether the fighter may train, or whether they may compete in a bout.",
    },
    eligibleWithRestrictions: {
        term: "Eligible with restrictions",
        definition: "The fighter may train, but only within the limits the doctor lists, for example no head contact.",
    },
    restrictions: {
        term: "Restrictions",
        definition: "Limits that come with the decision, such as no sparring or no head contact, until a doctor lifts them.",
    },
    validUntil: {
        term: "Valid until",
        definition: "The date the decision stops applying. A clearance issued from this exam can end earlier, never later.",
    },
    followUpDate: {
        term: "Follow-up",
        definition: "When the doctor wants to see the fighter again. It is a reminder only; it doesn't end the clearance.",
    },
    medicalClearance: {
        term: "Medical clearance",
        definition: "The doctor's formal sign-off that the fighter may train or compete, issued from a completed exam. It can carry restrictions and an end date.",
    },
    returnFromInjury: {
        term: "Return from injury",
        definition: "A clearance that lets a fighter train again after an injury, usually with restrictions that ease over time.",
    },
    scat6: {
        term: "SCAT6",
        definition: "Sport Concussion Assessment Tool, 6th edition: the standard check of concussion symptoms, memory, concentration and balance.",
    },
    gcs: {
        term: "Glasgow Coma Scale (GCS)",
        definition: "Scores eye, verbal and motor responses from 3 to 15. A score of 15 means fully alert.",
    },
    maddocks: {
        term: "Maddocks questions",
        definition: "Five quick questions about the event and venue that reveal confusion right after a head impact.",
    },
    observableSigns: {
        term: "Observable signs",
        definition: "Visible signs after an impact, such as lying motionless, unsteady balance or a blank look, seen by a witness or on video.",
    },
    immediateAssessment: {
        term: "Immediate assessment",
        definition: "The on-the-spot screen right after a suspected head injury. A healthy baseline usually records it as not performed.",
    },
    symptomEvaluation: {
        term: "Symptom evaluation",
        definition: "The fighter rates 22 symptoms from 0 (none) to 6 (severe). The medical service works out the symptom count and severity score.",
    },
    percentOfNormal: {
        term: "Percent of normal",
        definition: "How the fighter feels overall compared with their usual self, from 0 to 100%.",
    },
    orientation: {
        term: "Orientation",
        definition: "Simple questions about the date and time that check the fighter knows where they are in time.",
    },
    immediateMemory: {
        term: "Immediate memory",
        definition: "The examiner reads a word list and the fighter repeats it, over three trials. It tests short-term memory.",
    },
    digitsBackward: {
        term: "Digits backward",
        definition: "The fighter repeats strings of numbers in reverse order. It tests concentration.",
    },
    monthsReverse: {
        term: "Months in reverse",
        definition: "The fighter says the months backwards, from December to January, as quickly and accurately as possible.",
    },
    mbess: {
        term: "mBESS",
        definition: "Modified Balance Error Scoring System: the examiner counts balance errors during three 20-second stances with eyes closed.",
    },
    tandemGait: {
        term: "Tandem gait",
        definition: "Walking heel-to-toe along a 3 m line and back, timed. Slow or unsteady walking can point to a concussion.",
    },
    dualTaskGait: {
        term: "Dual-task gait",
        definition: "The tandem walk repeated while counting backwards, to test balance under mental load.",
    },
    delayedRecall: {
        term: "Delayed recall",
        definition: "At least 5 minutes after the memory trials, the fighter recalls the word list without hearing it again.",
    },
    examinerAttestation: {
        term: "Examiner attestation",
        definition: "The doctor confirms they ran or supervised this assessment themselves, following the official SCAT6 instructions.",
    },
    recoveryPlan: {
        term: "Recovery plan",
        definition: "The steps a fighter follows to come back from an injury, each with a target date the doctor signs off.",
    },
    milestone: {
        term: "Milestone",
        definition: "A checkpoint in a recovery plan, for example pain-free full range of motion, that the doctor marks as reached.",
    },
    trainingClearance: {
        term: "Training clearance",
        definition: "Lets a healthy fighter train within the exam's decision. It usually follows a baseline or routine exam when there is no active injury.",
    },
    competitionClearance: {
        term: "Competition clearance",
        definition: "Lets the fighter compete in a bout. Only a competition exam can back it.",
    },
    examinationCorrection: {
        term: "Correction",
        definition: "Replaces the current exam of the same scope because it was recorded wrongly. A new visit is a new exam, not a correction.",
    },
    reviewRequest: {
        term: "Review request",
        definition: "A fighter, coach or doctor asked for a medical review. Training is paused until an exam answers it.",
    },
    assessedArea: {
        term: "Assessed area",
        definition: "One part of the physical exam, such as the heart, lungs or a joint, with its result: normal, abnormal or inconclusive.",
    },
    athleteBackground: {
        term: "Athlete background",
        definition: "Past concussions and conditions such as migraine, ADHD, a learning difficulty or a mood disorder. They can change SCAT6 results, so later tests are read against them.",
    },
    cognitiveScreening: {
        term: "Cognitive screening",
        definition: "The SCAT6 checks of orientation, immediate memory and concentration (digits backward and months in reverse).",
    },
    cervicalSpine: {
        term: "Cervical spine check",
        definition: "Neck pain, tenderness, range of motion and limb strength after an impact. Any neck finding means the neck is protected before the athlete is moved.",
    },
    findingsAndReasoning: {
        term: "Findings and reasoning",
        definition: "Why you reached the decision, in plain words. The fighter can read it on their Health page; coaches can't.",
    },
    coordinationBalance: {
        term: "Coordination and balance",
        definition: "The SCAT6 balance checks: mBESS stances, timed tandem gait and, optionally, dual-task gait.",
    },
} as const satisfies Record<string, GlossaryEntry>;
