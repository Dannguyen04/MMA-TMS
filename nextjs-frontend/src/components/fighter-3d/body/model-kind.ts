import type { Fighter } from "@/lib/domain/types";
import type { BodyModelKind } from "./regions";

/**
 * A female fighter gets the female model, everyone else the male scan. A fighter whose sex is not
 * recorded gets the male scan too, like the doctor's body map, so every screen shows the same figure
 * for the same person.
 *
 * Kept apart from `build.ts` (which pulls in three.js) so cards can pick the model without loading WebGL code.
 */
export function bodyModelFor(sex: Fighter["sex"] | null | undefined): BodyModelKind {
    return sex === "female" ? "female" : "muscular";
}
