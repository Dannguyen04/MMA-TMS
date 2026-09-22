/**
 * Which video pipeline the app talks to.
 * - "mock": chỉ dành cho demo được bật rõ ràng.
 * - "api" (mặc định): footage đi qua API và Python worker.
 */
export type VideoPipelineMode = "mock" | "api";

export const VIDEO_PIPELINE_MODE: VideoPipelineMode = process.env.NEXT_PUBLIC_VIDEO_PIPELINE === "mock" ? "mock" : "api";
