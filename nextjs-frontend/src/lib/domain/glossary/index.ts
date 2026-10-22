import { ADMISSION_TERMS } from "./admissions";
import { MEDICAL_TERMS } from "./medical";
import { TRAINING_TERMS } from "./training";
import type { GlossaryEntry } from "./types";

export type { GlossaryEntry } from "./types";

/** Each area keeps its own file of terms; keys must stay unique across them (the glossary test checks this). */
export const GLOSSARY_SECTIONS = { admissions: ADMISSION_TERMS, medical: MEDICAL_TERMS, training: TRAINING_TERMS } as const;

/** Every term the interface explains with a `<TermHint>` or `<Term>`. */
export const GLOSSARY = { ...ADMISSION_TERMS, ...MEDICAL_TERMS, ...TRAINING_TERMS } satisfies Record<string, GlossaryEntry>;

export type GlossaryTerm = keyof typeof GLOSSARY;
