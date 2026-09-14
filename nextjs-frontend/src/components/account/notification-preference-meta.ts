import type { NotificationCategory, Role } from "@/lib/domain/types";

/** Channels a notification category can be delivered on. */
export interface ChannelPreference {
    inApp: boolean;
    email: boolean;
}

/** Category order and the categories each role normally receives. */
export const ROLE_NOTIFICATION_CATEGORIES: Record<Role, NotificationCategory[]> = {
    fighter: ["training", "feedback", "ai_analysis", "goal", "medical", "clearance", "system"],
    coach: ["training", "ai_analysis", "goal", "clearance", "medical", "system"],
    doctor: ["ai_alert", "medical", "clearance", "training", "system"],
    admin: ["system", "ai_analysis"],
};

const CATEGORY_ORDER: NotificationCategory[] = ["training", "feedback", "ai_analysis", "ai_alert", "goal", "medical", "clearance", "system"];

/** Role categories plus any other category the user has actually received, in a stable order. */
export function preferenceCategories(role: Role, received: NotificationCategory[]): NotificationCategory[] {
    const roleOrder = ROLE_NOTIFICATION_CATEGORIES[role];
    const extras = CATEGORY_ORDER.filter((category) => received.includes(category) && !roleOrder.includes(category));
    return [...roleOrder, ...extras];
}

const GENERIC_DESCRIPTIONS: Record<NotificationCategory, string> = {
    training: "Session changes, cancellations and reminders.",
    feedback: "New notes and corrections from coaches.",
    ai_analysis: "AI analysis results for uploaded footage.",
    ai_alert: "AI movement observations that need clinical review.",
    goal: "New goals and progress milestones.",
    medical: "Examinations, injuries and recovery updates.",
    clearance: "Medical Clearance granted, restricted, revoked or expiring.",
    system: "Account, security and academy announcements.",
};

const ROLE_DESCRIPTIONS: Record<Role, Partial<Record<NotificationCategory, string>>> = {
    fighter: {
        ai_analysis: "When the AI analysis of your footage is ready.",
        feedback: "New notes and corrections from your coaches.",
        medical: "Examinations, injury and recovery plan updates.",
        clearance: "Changes to what you're cleared to train.",
    },
    coach: {
        training: "Sessions completed, missed or blocked by a clearance.",
        ai_analysis: "New analyses to review, including low-confidence results.",
        goal: "Goals that are at risk or achieved.",
        medical: "Health status changes for your fighters — never clinical detail.",
        clearance: "Clearances granted, restricted, revoked or about to expire.",
    },
    doctor: {
        training: "Training scheduled for fighters with active restrictions.",
        medical: "Examinations due, recovery check-ins and injury updates.",
        clearance: "Clearances that are about to expire.",
    },
    admin: {
        system: "Security summaries, model deployments and broadcasts.",
        ai_analysis: "Failed or stalled AI processing jobs.",
    },
};

export function categoryDescription(role: Role, category: NotificationCategory): string {
    return ROLE_DESCRIPTIONS[role][category] ?? GENERIC_DESCRIPTIONS[category];
}

/** Clearance changes decide what training is allowed, so they always appear in-app. */
export function isInAppLocked(category: NotificationCategory): boolean {
    return category === "clearance";
}

export function defaultPreference(role: Role, category: NotificationCategory): ChannelPreference {
    const email = category === "clearance" || category === "ai_alert" || category === "medical" || (role === "admin" && category === "system");
    return { inApp: true, email };
}
