import { describe, expect, it, vi } from "vitest";

import type { CampBout } from "@/lib/domain/bout";
import type { Fighter } from "@/lib/domain/types";

vi.mock("server-only", () => ({}));

const { nextBoutFor } = await import("./roster-data");

const NOW = "2026-11-10T05:00:00.000Z";
const fighter = { id: "f-1", weightClass: "flyweight", upcomingBout: null } as unknown as Fighter;
const bout = (id: string, boutAt: string, phase: CampBout["phase"], fighterId = "f-1") =>
    ({ id, fighterId, boutAt, phase, event: `Event ${id}`, opponent: id === "b-open" ? null : `Opponent ${id}` }) as unknown as CampBout;

describe("nextBoutFor (roster cards in API mode)", () => {
    it("takes the earliest bout still ahead, skipping finished, cancelled, past and other fighters' bouts", () => {
        const bouts = [
            bout("b-late", "2027-01-20T13:00:00.000Z", "SCHEDULED"),
            bout("b-next", "2026-12-26T13:00:00.000Z", "CAMP"),
            bout("b-done", "2026-12-01T13:00:00.000Z", "COMPLETED"),
            bout("b-cancel", "2026-11-20T13:00:00.000Z", "CANCELLED"),
            bout("b-past", "2026-11-09T13:00:00.000Z", "WEIGHED_IN"),
            bout("b-other", "2026-11-15T13:00:00.000Z", "CAMP", "f-2"),
        ];
        expect(nextBoutFor(fighter, bouts, NOW)).toEqual({ date: "2026-12-26T13:00:00.000Z", event: "Event b-next", opponent: "Opponent b-next", weightClass: "flyweight" });
    });

    it("keeps the profile's own bout, says none without one, and shows a dash for an unnamed opponent", () => {
        const own = { date: "2026-12-01T00:00:00.000Z", event: "Own", opponent: "X", weightClass: "flyweight" as const };
        expect(nextBoutFor({ ...fighter, upcomingBout: own }, [bout("b-next", "2026-12-26T13:00:00.000Z", "CAMP")], NOW)).toBe(own);
        expect(nextBoutFor(fighter, [], NOW)).toBeNull();
        expect(nextBoutFor(fighter, [bout("b-open", "2026-12-26T13:00:00.000Z", "SCHEDULED")], NOW)?.opponent).toBe("—");
    });
});
