/**
 * Copy and sample values for the landing tour. Labels, stages and statuses mirror the app
 * (lib/domain/labels.ts and friends); numbers are a labelled sample analysis, not user data.
 */

export const CHAPTER_NAV = [
    { id: "analysis", index: "01", label: "AI analysis" },
    { id: "training", index: "02", label: "Training" },
    { id: "performance", index: "03", label: "Performance" },
    { id: "medicine", index: "04", label: "Sports medicine" },
    { id: "roles", index: "05", label: "Roles" },
] as const;

export const PIPELINE_STAGES = [
    "Decoding video",
    "Detecting fighter",
    "Tracking fighter",
    "Estimating pose keypoints",
    "Recognising strikes",
    "Computing performance metrics",
    "Generating findings",
];

export const SAMPLE_METRICS = [
    { label: "Peak strike speed", value: 9.4, decimals: 1, unit: "m/s" },
    { label: "Punch extension", value: 168, decimals: 0, unit: "°", note: "target 155–175°" },
    { label: "Guard uptime", value: 82, decimals: 0, unit: "%" },
];

export const SAMPLE_FINDINGS = [
    { kind: "Strength", tone: "success", text: "Jab snaps back to guard before the counter window opens.", confidence: 0.91 },
    { kind: "Improvement area", tone: "warning", text: "Rear hand drifts from the chin while the cross lands.", confidence: 0.78 },
    { kind: "Area of concern", tone: "danger", text: "Knee travels inward on the roundhouse-kick landing.", confidence: 0.67 },
] as const;

export const TRAINING_PHASES = [
    { phase: "Base", weeks: "Weeks 1–4", text: "Aerobic engine, fundamentals and volume.", load: 0.55 },
    { phase: "Build", weeks: "Weeks 5–8", text: "Intensity climbs and sparring rounds return.", load: 0.8 },
    { phase: "Fight camp", weeks: "Weeks 9–12", text: "Opponent-specific work at peak sharpness.", load: 1 },
    { phase: "Taper", weeks: "Fight week", text: "Volume drops, speed stays, weight settles.", load: 0.35 },
    { phase: "Rehab", weeks: "As cleared", text: "Back from injury inside the doctor's restrictions.", load: 0.3 },
    { phase: "Maintenance", weeks: "Between camps", text: "Keep the engine running and the edges sharp.", load: 0.5 },
];

export const SAMPLE_SCORES = [
    { technique: "Jab", score: 84, baseline: 79 },
    { technique: "Cross", score: 78, baseline: 74 },
    { technique: "Hook", score: 71, baseline: 72 },
    { technique: "Kick", score: 66, baseline: 60 },
    { technique: "Combination", score: 74, baseline: 69 },
    { technique: "Footwork", score: 69, baseline: 66 },
    { technique: "Guard", score: 88, baseline: 83 },
    { technique: "Head movement", score: 62, baseline: 58 },
];

export const SAMPLE_GOALS = [
    { goal: "Jab peak speed", target: "9.5 m/s", progress: 0.86, status: "On track", tone: "info" },
    { goal: "Guard uptime", target: "85%", progress: 1, status: "Achieved", tone: "success" },
    { goal: "Kick chamber", target: "under 75°", progress: 0.52, status: "At risk", tone: "warning" },
] as const;

export const RECOVERY_CHECK_IN = [
    { label: "Pain", from: 6, to: 1, unit: "/10", lowerIsBetter: true },
    { label: "Mobility", from: 58, to: 96, unit: "%", lowerIsBetter: false },
    { label: "Strength", from: 61, to: 94, unit: "%", lowerIsBetter: false },
];

export const CLEARANCE_STEPS = [
    { level: "Not cleared", tone: "danger", detail: "Rehab only" },
    { level: "Cleared with restrictions", tone: "warning", detail: "RPE ≤ 6 · no sparring" },
    { level: "Cleared", tone: "success", detail: "Full training" },
] as const;

export const ROLES = [
    { role: "Fighter", color: "#e5484d", text: "Your week, your footage, your scores and your clearance, in one place." },
    { role: "Coach", color: "#3d8bff", text: "Roster, plans, sessions and the AI review queue, with what needs attention first." },
    { role: "Sports doctor", color: "#3fd7e8", text: "Clinical overview, examinations, injuries, recovery plans and AI observations." },
    { role: "Admin", color: "#f4f6fb", text: "Users and roles, AI jobs and models, audit logs and platform settings." },
];
