export type ModelRegion = { slot: number; ch: number; centre: [number, number, number]; normal: [number, number, number]; seeds: number };
export type BodyModelMeta = { H: number; minY: number; DMAX: number; regions: Record<string, ModelRegion>; spine: { y0: number; y1: number }; mask: { slot: number; ch: number } };
export type ViewState = { angle: number; target: number };
