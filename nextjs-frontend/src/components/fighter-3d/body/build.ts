import type { FigureParams } from "../figure-params";
import type { FigureBuild } from "./body-rig";
import { bodyModelFor } from "./model-kind";
import { MODEL_HEIGHT } from "./regions";

export { bodyModelFor };

/**
 * The fighter's own height and a width that follows their BMI, kept within a narrow band: the body
 * map is a chart of the person, not a caricature.
 */
export function figureBuild(params: FigureParams): FigureBuild {
    const width = Math.min(1.12, Math.max(0.9, 0.9 + (params.bulk - 0.84) * 0.5));
    return { height: Math.round((params.height / MODEL_HEIGHT) * 1000) / 1000, width: Math.round(width * 1000) / 1000 };
}
