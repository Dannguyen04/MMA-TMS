/**
 * Which video pipeline the app talks to.
 * - In production: mock mode is disabled by default to ensure only authoritative backend data is presented.
 * - In development/demo: explicit NEXT_PUBLIC_DEMO_MOCK_MODE="true" permits mock simulation with visual warning badge.
 */
export type VideoPipelineMode = "mock" | "api";

const isProd = process.env.NODE_ENV === "production";
const explicitMock = process.env.NEXT_PUBLIC_DEMO_MOCK_MODE === "true";

export const VIDEO_PIPELINE_MODE: VideoPipelineMode =
    isProd && !explicitMock
        ? "api"
        : process.env.NEXT_PUBLIC_VIDEO_PIPELINE === "api"
          ? "api"
          : "mock";

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
