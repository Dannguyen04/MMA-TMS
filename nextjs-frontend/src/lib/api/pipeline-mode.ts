/**
 * Which video pipeline the app talks to.
 * - "mock" (mặc định ngoài production): pipeline giả lập đi cùng dữ liệu demo.
 * - "api" (mặc định trong production, hoặc `NEXT_PUBLIC_VIDEO_PIPELINE=api`): footage đi qua API và Python worker.
 * - In development/demo: explicit NEXT_PUBLIC_DEMO_MOCK_MODE="true" permits mock simulation with visual warning badge.
 */
export type VideoPipelineMode = "mock" | "api";

function resolveVideoPipelineMode(): VideoPipelineMode {
    if (process.env.NEXT_PUBLIC_DEMO_MOCK_MODE === "true") {
        return "mock";
    }
    const configured = process.env.NEXT_PUBLIC_VIDEO_PIPELINE;
    if (configured === "api" || configured === "mock") return configured;
    return process.env.NODE_ENV === "production" ? "api" : "mock";
}

export const VIDEO_PIPELINE_MODE: VideoPipelineMode = resolveVideoPipelineMode();

export function isMockMode(): boolean {
    return VIDEO_PIPELINE_MODE === "mock";
}

export function getPipelineBadge(): { isMock: boolean; label: string; warningText?: string } {
    if (VIDEO_PIPELINE_MODE === "mock") {
        return {
            isMock: true,
            label: "DEMO / MOCK MODE",
            warningText: "Data shown is simulated and not authoritative. Real AI inference is inactive.",
        };
    }
    return {
        isMock: false,
        label: "AUTHORITATIVE AI PIPELINE",
    };
}
