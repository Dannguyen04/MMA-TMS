/**
 * Which video pipeline the app talks to.
 * - "mock" (mặc định ngoài production): pipeline giả lập đi cùng dữ liệu demo.
 * - "api" (mặc định trong production, hoặc `NEXT_PUBLIC_VIDEO_PIPELINE=api`): footage đi qua API và Python worker.
 */
export type VideoPipelineMode = "mock" | "api";

function resolveVideoPipelineMode(): VideoPipelineMode {
    const configured = process.env.NEXT_PUBLIC_VIDEO_PIPELINE;
    if (configured === "api" || configured === "mock") return configured;
    return process.env.NODE_ENV === "production" ? "api" : "mock";
}

export const VIDEO_PIPELINE_MODE: VideoPipelineMode = resolveVideoPipelineMode();
