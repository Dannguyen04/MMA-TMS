import type { Fighter } from "@/lib/domain/types";
import type { FigureParams } from "../figure-params";
import type { FigureBuild } from "./body-rig";
import { MODEL_HEIGHT, type BodyModelKind } from "./regions";

/**
 * The scanned model is male; a female fighter (or one whose sex is not recorded) gets the sex-neutral
 * mannequin rather than a male body.
 */
export function bodyModelFor(sex: Fighter["sex"] | null | undefined): BodyModelKind {
    return sex === "male" ? "muscular" : "mannequin";
}

/**
 * The fighter's own height and a width that follows their BMI, kept within a narrow band: the body
 * map is a chart of the person, not a caricature.
 */
export function figureBuild(params: FigureParams): FigureBuild {
    const width = Math.min(1.12, Math.max(0.9, 0.9 + (params.bulk - 0.84) * 0.5));
    return { height: Math.round((params.height / MODEL_HEIGHT) * 1000) / 1000, width: Math.round(width * 1000) / 1000 };
}
