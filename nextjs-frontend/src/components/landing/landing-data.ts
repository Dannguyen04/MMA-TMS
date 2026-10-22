/**
 * Copy keys and sample values for the landing tour.
 * Numbers are a labelled sample analysis, not user data.
 */

export const CHAPTER_NAV = [
    { id: "analysis", index: "01", labelKey: "landing.chapterNav.analysis" },
    { id: "training", index: "02", labelKey: "landing.chapterNav.training" },
    { id: "performance", index: "03", labelKey: "landing.chapterNav.performance" },
    { id: "medicine", index: "04", labelKey: "landing.chapterNav.medicine" },
    { id: "roles", index: "05", labelKey: "landing.chapterNav.roles" },
] as const;

export const PIPELINE_STAGES = [
    "landing.pipeline.decoding",
    "landing.pipeline.detecting",
    "landing.pipeline.tracking",
    "landing.pipeline.keypoints",
    "landing.pipeline.strikes",
    "landing.pipeline.metrics",
    "landing.pipeline.findings",
] as const;

export const SAMPLE_METRICS = [
    { id: "speed", labelKey: "landing.sampleMetrics.speed.label", value: 9.4, decimals: 1, unitKey: "landing.sampleMetrics.speed.unit" },
    { id: "extension", labelKey: "landing.sampleMetrics.extension.label", value: 168, decimals: 0, unitKey: "landing.sampleMetrics.extension.unit", noteKey: "landing.sampleMetrics.extension.note" },
    { id: "guard", labelKey: "landing.sampleMetrics.guard.label", value: 82, decimals: 0, unitKey: "landing.sampleMetrics.guard.unit" },
] as const;

export const SAMPLE_FINDINGS = [
    { kindKey: "landing.sampleFindings.strength.kind", tone: "success", textKey: "landing.sampleFindings.strength.text", confidence: 0.91 },
    { kindKey: "landing.sampleFindings.improvement.kind", tone: "warning", textKey: "landing.sampleFindings.improvement.text", confidence: 0.78 },
    { kindKey: "landing.sampleFindings.concern.kind", tone: "danger", textKey: "landing.sampleFindings.concern.text", confidence: 0.67 },
] as const;

export const TRAINING_PHASES = [
    { id: "base", phaseKey: "landing.trainingPhases.base.phase", weeksKey: "landing.trainingPhases.base.weeks", textKey: "landing.trainingPhases.base.text", load: 0.55 },
    { id: "build", phaseKey: "landing.trainingPhases.build.phase", weeksKey: "landing.trainingPhases.build.weeks", textKey: "landing.trainingPhases.build.text", load: 0.8 },
    { id: "fightCamp", phaseKey: "landing.trainingPhases.fightCamp.phase", weeksKey: "landing.trainingPhases.fightCamp.weeks", textKey: "landing.trainingPhases.fightCamp.text", load: 1 },
    { id: "taper", phaseKey: "landing.trainingPhases.taper.phase", weeksKey: "landing.trainingPhases.taper.weeks", textKey: "landing.trainingPhases.taper.text", load: 0.35 },
    { id: "rehab", phaseKey: "landing.trainingPhases.rehab.phase", weeksKey: "landing.trainingPhases.rehab.weeks", textKey: "landing.trainingPhases.rehab.text", load: 0.3 },
    { id: "maintenance", phaseKey: "landing.trainingPhases.maintenance.phase", weeksKey: "landing.trainingPhases.maintenance.weeks", textKey: "landing.trainingPhases.maintenance.text", load: 0.5 },
] as const;

export const SAMPLE_SCORES = [
    { id: "jab", techniqueKey: "landing.scores.jab", score: 84, baseline: 79 },
    { id: "cross", techniqueKey: "landing.scores.cross", score: 78, baseline: 74 },
    { id: "hook", techniqueKey: "landing.scores.hook", score: 71, baseline: 72 },
    { id: "kick", techniqueKey: "landing.scores.kick", score: 66, baseline: 60 },
    { id: "combination", techniqueKey: "landing.scores.combination", score: 74, baseline: 69 },
    { id: "footwork", techniqueKey: "landing.scores.footwork", score: 69, baseline: 66 },
    { id: "guard", techniqueKey: "landing.scores.guard", score: 88, baseline: 83 },
    { id: "headMovement", techniqueKey: "landing.scores.headMovement", score: 62, baseline: 58 },
] as const;

export const SAMPLE_GOALS = [
    { id: "speed", goalKey: "landing.sampleGoals.speed.goal", targetKey: "landing.sampleGoals.speed.target", progress: 0.86, statusKey: "landing.sampleGoals.speed.status", tone: "info" },
    { id: "guard", goalKey: "landing.sampleGoals.guard.goal", targetKey: "landing.sampleGoals.guard.target", progress: 1, statusKey: "landing.sampleGoals.guard.status", tone: "success" },
    { id: "kick", goalKey: "landing.sampleGoals.chamber.goal", targetKey: "landing.sampleGoals.chamber.target", progress: 0.52, statusKey: "landing.sampleGoals.chamber.status", tone: "warning" },
] as const;

export const RECOVERY_CHECK_IN = [
    { id: "pain", labelKey: "landing.recovery.pain", from: 6, to: 1, unitKey: "landing.recovery.painUnit", lowerIsBetter: true },
    { id: "mobility", labelKey: "landing.recovery.mobility", from: 58, to: 96, unitKey: "landing.recovery.pctUnit", lowerIsBetter: false },
    { id: "strength", labelKey: "landing.recovery.strength", from: 61, to: 94, unitKey: "landing.recovery.pctUnit", lowerIsBetter: false },
] as const;

export const CLEARANCE_STEPS = [
    { id: "notCleared", levelKey: "landing.clearance.notCleared.level", tone: "danger", detailKey: "landing.clearance.notCleared.detail" },
    { id: "restricted", levelKey: "landing.clearance.restricted.level", tone: "warning", detailKey: "landing.clearance.restricted.detail" },
    { id: "cleared", levelKey: "landing.clearance.cleared.level", tone: "success", detailKey: "landing.clearance.cleared.detail" },
] as const;

export const ROLES = [
    { id: "fighter", roleKey: "landing.roles.fighter.role", color: "#e5484d", textKey: "landing.roles.fighter.text" },
    { id: "coach", roleKey: "landing.roles.coach.role", color: "#3d8bff", textKey: "landing.roles.coach.text" },
    { id: "doctor", roleKey: "landing.roles.doctor.role", color: "#3fd7e8", textKey: "landing.roles.doctor.text" },
    { id: "admin", roleKey: "landing.roles.admin.role", color: "#f4f6fb", textKey: "landing.roles.admin.text" },
] as const;
