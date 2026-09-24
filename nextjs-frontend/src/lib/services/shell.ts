import "server-only";

import { z } from "zod";

import type { NavBadgeKey } from "@/components/layout/navigation";
import { accessibleFighterIds } from "@/lib/auth/access";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { authenticatedApiRequest } from "@/lib/api/client";
import type { User } from "@/lib/domain/types";

const navBadgeCountsSchema = z.object({
    notifications: z.number().int().nonnegative().optional(),
    reviewQueue: z.number().int().nonnegative().optional(),
    newAlerts: z.number().int().nonnegative().optional(),
    failedJobs: z.number().int().nonnegative().optional(),
});

/** Lay cac bo dem hien thi tren thanh dieu huong. */
export async function getNavBadgeCounts(user: User): Promise<Partial<Record<NavBadgeKey, number>>> {
    if (!isDemoAuthEnabled()) {
        return authenticatedApiRequest("/navigation/badges", navBadgeCountsSchema);
    }

    const { db } = await import("@/lib/mocks/db");
    const store = db();
    const counts: Partial<Record<NavBadgeKey, number>> = {
        notifications: store.notifications.filter((notification) => notification.userId === user.id && notification.readAt === null).length,
    };
    const fighterIds = accessibleFighterIds(user);
    const inScope = (fighterId: string) => fighterIds === "all" || fighterIds.includes(fighterId);

    if (user.role === "coach") {
        // Completed analyses on assigned fighters that no coach has reviewed yet.
        counts.reviewQueue = store.aiAnalyses.filter((a) => inScope(a.fighterId) && a.coachReview === null).length;
    }
    if (user.role === "doctor") {
        counts.newAlerts = store.abnormalMovementAlerts.filter((a) => inScope(a.fighterId) && a.status === "new").length;
    }
    if (user.role === "admin") {
        counts.failedJobs = store.aiJobs.filter((j) => j.status === "failed").length;
    }
    return counts;
}
