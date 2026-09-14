/**
 * Which video pipeline the app talks to.
 * - "mock" (default): uploads are simulated and processed by the in-memory mock pipeline.
 * - "api": footage goes to Supabase Storage and is analysed by the NestJS job API + Python worker.
 */
export type VideoPipelineMode = "mock" | "api";

export const VIDEO_PIPELINE_MODE: VideoPipelineMode = process.env.NEXT_PUBLIC_VIDEO_PIPELINE === "api" ? "api" : "mock";
