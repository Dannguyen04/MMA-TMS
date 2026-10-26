import type { CampDetail, CampRound, RoundInput } from "@/api/fight-camp";
import { previewRoundsResponse } from "./round-advice-preview";

const records = new Map<string, CampRound[]>();
const clone = (r: CampRound): CampRound => ({ ...r, tacticMarks: { ...r.tacticMarks }, observationMarks: { ...r.observationMarks } });
export function readPreviewRounds(bout: CampDetail) { return previewRoundsResponse(bout, (records.get(bout.id) ?? []).map(clone)); }
export function savePreviewRound(bout: CampDetail, roundNo: number, body: RoundInput) {
  if (!bout.scheduledRounds || !Number.isInteger(roundNo) || roundNo < 1 || roundNo > bout.scheduledRounds) throw new Error("Hiệp nằm ngoài số hiệp của trận mẫu.");
  const round = clone({ ...body, id: `sample-${bout.id}-${roundNo}`, roundNo });
  records.set(bout.id, [...(records.get(bout.id) ?? []).filter(r => r.roundNo !== roundNo), round]);
  return readPreviewRounds(bout);
}
export function resetPreviewRounds(boutId: string) { records.delete(boutId); }
