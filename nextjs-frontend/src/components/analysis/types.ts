export type FrameData = {
    frameIdx: number;
    timeMs: number;
    kneeAngle: number;
    hipAngle: number;
    elbowAngleLeft?: number;
    elbowAngleRight?: number;
    activeArm?: string;
    punchState?: string;
    punchStateLabel?: string;
    kickState: string;
    kickStateLabel: string;
    activeLeg: string;
    landmarks: Array<{ x: number; y: number; conf: number }>;
};

export type TechniqueFinding = {
    id: string;
    category: string;
    title: string;
    description: string;
    severity: "positive" | "info" | "warning" | "critical";
    confidence: number;
    frameIdx: number;
    timeMs: number;
    metricName: string;
    metricValue: number;
    recommendation: string;
};

export type KickData = {
    score: number;
    grade: string;
    emoji: string;
    details: string[];
    startTimeMs: number;
    endTimeMs: number;
    minChamberAngle: number;
    maxExtensionAngle: number;
    peakSpeed: number;
};

export type PunchData = {
    punchType: string;
    arm: string;
    score: number;
    grade: string;
    emoji: string;
    details: string[];
    maxElbowAngle: number;
    peakSpeed: number;
    guardPreserved: boolean;
    startFrame: number;
    impactFrame: number;
    endFrame: number;
    startTimeMs: number;
    impactTimeMs: number;
    endTimeMs: number;
    findings: TechniqueFinding[];
};

export type AnalysisResult = {
    meta: {
        fps: number;
        totalFrames: number;
        durationMs: number;
        imgWidth?: number;
        imgHeight?: number;
    };
    frames: FrameData[];
    kicks: KickData[];
    punches?: PunchData[];
    findings?: TechniqueFinding[];
    summary: {
        totalKicks: number;
        totalPunches?: number;
        primaryAction?: string;
        avgScore: number;
        bestScore: number;
        bestKickIdx?: number;
        bestPunchIdx?: number;
    };
};
