import type { Fighter } from "@/lib/domain/types";
import type { BodyModelKind } from "./regions";

/**
 * The scanned model is male; a female fighter gets the sex-neutral mannequin rather than a male body (until a
 * female model exists). A fighter whose sex is not recorded gets the scan too: the API has no sex field, and the
 * doctor's body map always draws the scan, so every screen shows the same figure for the same person.
 *
 * Kept apart from `build.ts` (which pulls in three.js) so cards can pick the model without loading WebGL code.
 */
export function bodyModelFor(sex: Fighter["sex"] | null | undefined): BodyModelKind {
    return sex === "female" ? "mannequin" : "muscular";
}
