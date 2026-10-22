/**
 * English labels for the bout vocabulary in `labels.ts` (phases, documents, results, suspensions…), keyed
 * `boutLabel.<group>.<value>` so screens can write `t(\`boutLabel.phase.${phase}\`)`. Keep them in step with `labels.ts`.
 */
export const enBoutLabels = {
    "boutLabel.weightStatus.GREEN": "Green",
    "boutLabel.weightStatus.YELLOW": "Yellow",
    "boutLabel.weightStatus.RED": "Red",
    "boutLabel.weightStatus.GREY": "Grey",

    "boutLabel.adherence.ON_PLAN": "On plan",
    "boutLabel.adherence.SLIGHTLY_OFF": "Slightly off",
    "boutLabel.adherence.WAY_OFF": "Way off",

    "boutLabel.nutritionPhase.camp": "Camp",
    "boutLabel.nutritionPhase.fightWeek": "Fight week",
    "boutLabel.nutritionPhase.postWeighIn": "After the official weigh-in",

    "boutLabel.phase.SCHEDULED": "Scheduled",
    "boutLabel.phase.CAMP": "Camp",
    "boutLabel.phase.FIGHT_WEEK": "Fight week",
    "boutLabel.phase.WEIGHED_IN": "Weighed in",
    "boutLabel.phase.COMPLETED": "Completed",
    "boutLabel.phase.CANCELLED": "Cancelled",

    "boutLabel.sport.BOXING": "Boxing",
    "boutLabel.sport.MUAY_THAI": "Muay Thai",
    "boutLabel.sport.KICKBOXING": "Kickboxing",
    "boutLabel.sport.MMA": "MMA",

    "boutLabel.requirement.MISSING": "Missing",
    "boutLabel.requirement.PROVIDED": "Provided",
    "boutLabel.requirement.CONFIRMED": "Confirmed",
    "boutLabel.requirement.REJECTED": "Rejected",

    "boutLabel.gate1Reason.MISSING": "missing",
    "boutLabel.gate1Reason.EXPIRED": "expires before the bout",
    "boutLabel.gate1Reason.REJECTED": "rejected",

    "boutLabel.cancelReason.OPPONENT_WITHDREW": "Opponent withdrew",
    "boutLabel.cancelReason.INJURY": "Injury",
    "boutLabel.cancelReason.MISSED_WEIGHT": "Missed weight",
    "boutLabel.cancelReason.DOCUMENTS": "Documents",
    "boutLabel.cancelReason.ORGANISER_CANCELLED": "Organiser cancelled",
    "boutLabel.cancelReason.OTHER": "Other",

    "boutLabel.hydration.NOT_APPLICABLE": "Not applicable",
    "boutLabel.hydration.PASSED": "Passed",
    "boutLabel.hydration.FAILED": "Failed",

    "boutLabel.result.WIN": "Win",
    "boutLabel.result.LOSS": "Loss",
    "boutLabel.result.DRAW": "Draw",
    "boutLabel.result.NO_CONTEST": "No contest",

    "boutLabel.method.KO": "KO",
    "boutLabel.method.TKO": "TKO",
    "boutLabel.method.DECISION": "Decision",
    "boutLabel.method.SUBMISSION": "Submission",
    "boutLabel.method.DQ": "Disqualification",
    "boutLabel.method.OTHER": "Other",

    "boutLabel.loc.NONE": "No",
    "boutLabel.loc.UNDER_1_MIN": "Under 1 minute",
    "boutLabel.loc.OVER_1_MIN": "Over 1 minute",
    "boutLabel.loc.UNKNOWN": "Not known",

    "boutLabel.suspensionReason.KO": "KO",
    "boutLabel.suspensionReason.TKO": "TKO",
    "boutLabel.suspensionReason.DQ": "Disqualification",
    "boutLabel.suspensionReason.MANDATORY_REST": "Mandatory rest",
    "boutLabel.suspensionReason.MEDICAL": "Medical",
    "boutLabel.suspensionReason.OTHER": "Other",

    "boutLabel.suspensionState.UPCOMING": "Starts later",
    "boutLabel.suspensionState.ACTIVE": "Suspended",
    "boutLabel.suspensionState.AWAITING_CLEARANCE": "Awaiting clearance",
    "boutLabel.suspensionState.ENDED": "Ended",
    "boutLabel.suspensionState.CLEARED": "Cleared to train",

    /* Gate 1 badge */
    "boutLabel.gate1.ready": "Ready",
    "boutLabel.gate1.missing": "{n} missing",
    "boutLabel.gate1.missingOverdue": "{n} missing · overdue",
} as const;
