/// <reference types="jest" />
import type { CampBout, Suspension } from "@/features/fight-camp/api";
import type { TrainingSession } from "@/api/types";
import { previewBout, previewSuspension } from "@/features/fight-camp/state/camp-preview";
import { academyTime, boutItems, dateKey, dayDots, doctorItems, endOfDay, mondayOf, sessionItems, sortDay, startOfDay, suspensionItems, weekDays, type ScheduleItem } from "./week-model";

const days = weekDays("2026-11-09");
const item = (kind: ScheduleItem["kind"], time: string | null, key: string = kind): ScheduleItem => ({ key, kind, date: "2026-11-11", time, title: key, who: "", target: { kind: "fighter", id: "f" } });

describe("week rules", () => {
  it("uses academy time (UTC+7) for dates, weeks and API windows", () => {
    expect(dateKey("2026-11-10T18:30:00Z")).toBe("2026-11-11");
    expect(academyTime("2026-11-10T18:30:00Z")).toBe("01:30");
    expect(mondayOf("2026-11-11")).toBe("2026-11-09");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(days).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
    expect(startOfDay("2026-11-09")).toBe("2026-11-08T17:00:00.000Z");
    expect(endOfDay("2026-11-15")).toBe("2026-11-15T16:59:59.999Z");
  });

  it("shows at most 3 dots, the red weigh-in/fight dot first even when it is last by time", () => {
    const busy = [item("session", "06:30", "a"), item("session", "07:30", "b"), item("session", "09:00", "c"), item("session", "15:00", "d"), item("weigh", "17:00", "e")];
    expect(dayDots(busy)).toEqual(["hot", "plain", "plain"]);
    expect(dayDots([item("session", "08:00")])).toEqual(["plain"]);
  });

  it("lists whole-day items first, then by time", () => {
    expect(sortDay([item("session", "16:00", "late"), item("free", null, "all"), item("session", "07:30", "early")]).map(x => x.key)).toEqual(["all", "early", "late"]);
  });

  it("turns sources into items: sessions (not cancelled), open bouts in the week, running suspensions ending in the week", () => {
    const s = (over: Partial<TrainingSession>) => ({ id: "s1", fighterId: "f1", title: "Đánh đích", scheduledAt: "2026-11-11T00:30:00Z", status: "SCHEDULED", sessionType: "PAD_WORK", ...over }) as TrainingSession;
    expect(sessionItems([s({}), s({ id: "s2", status: "CANCELLED" })], () => "Dat").map(x => [x.date, x.time, x.who])).toEqual([["2026-11-11", "07:30", "Dat"]]);

    const b = (over: Partial<CampBout>): CampBout => ({ ...previewBout, id: "b1", eventName: "TEST API", opponentName: "Đối thủ", status: "FIGHT_WEEK", weighInAt: "2026-11-13T01:00:00Z", boutAt: "2026-11-14T12:00:00Z", ...over });
    expect(boutItems([b({}), b({ id: "b2", status: "COMPLETED" })], days, () => "Dat").map(x => [x.kind, x.date, x.title])).toEqual([
      ["weigh", "2026-11-13", "TEST API"], ["fight", "2026-11-14", "TEST API · gặp Đối thủ"],
    ]);
    // Weighed in: only the fight is still ahead.
    expect(boutItems([b({ status: "WEIGHED_IN" })], days, () => "").map(x => x.kind)).toEqual(["fight"]);

    const sus = (over: Partial<Suspension>): Suspension => ({ ...previewSuspension, fighterId: "f1", endsOn: "2026-11-12", status: "ACTIVE", clearedAt: null, ...over });
    expect(suspensionItems([sus({}), sus({ id: "x2", status: "ENDED" }), sus({ id: "x3", endsOn: "2026-12-01" })], days, () => "Dat").map(x => [x.kind, x.date, x.target])).toEqual([
      ["free", "2026-11-12", { kind: "fighter", id: "f1" }],
    ]);
  });

  it("maps the doctor endpoint kinds, with clearance types in words", () => {
    const out = doctorItems([
      { kind: "CLEARANCE_EXPIRY", date: "2026-11-11", at: null, fighterId: "f1", fighterName: "Dat Nguyen", refId: "c1", label: "COMPETITION" },
      { kind: "FOLLOW_UP", date: "2026-11-10", at: null, fighterId: "f2", fighterName: "Anh Le", refId: "e1", label: null },
      { kind: "BOUT", date: "2026-11-14", at: "2026-11-14T12:00:00Z", fighterId: "f1", fighterName: "Dat Nguyen", refId: "b1", label: "TEST API" },
    ]);
    expect(out.map(x => [x.kind, x.title, x.time, x.who])).toEqual([
      ["expire", "Giấy phép thi đấu", null, "Dat Nguyen"], ["follow", "Anh Le", null, ""], ["fight", "TEST API", "19:00", "Dat Nguyen"],
    ]);
  });
});
