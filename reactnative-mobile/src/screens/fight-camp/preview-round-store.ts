import type { CampDetail, CampRound, RoundInput } from "@/api/fight-camp";
import { previewRoundsResponse } from "./round-advice-preview";
import { copyPlan, emptyPlan, validatePlan, validateRoundMarks } from "./next-round-plan";
import { CampInputError } from "./camp-input-error";

const records = new Map<string, CampRound[]>();
const clone = (r: CampRound): CampRound => ({ ...r, tacticMarks: { ...r.tacticMarks }, observationMarks: { ...r.observationMarks }, nextRoundPlan: copyPlan(r.nextRoundPlan ?? emptyPlan()) });
export function readPreviewRounds(bout: CampDetail) { return previewRoundsResponse(bout, (records.get(bout.id) ?? []).map(clone)); }
export function savePreviewRound(bout: CampDetail, roundNo: number, body: RoundInput) {
  if (!bout.scheduledRounds || !Number.isInteger(roundNo) || roundNo < 1 || roundNo > bout.scheduledRounds) throw new CampInputError("Hiệp nằm ngoài số hiệp của trận mẫu.");
  const previous = records.get(bout.id) ?? [];
  const plan = validatePlan(body.nextRoundPlan ?? previous.find(r => r.roundNo === roundNo)?.nextRoundPlan ?? emptyPlan(), bout, previous, roundNo);
  validateRoundMarks(body, bout, readPreviewRounds(bout), roundNo);
  const round = clone({ ...body, nextRoundPlan: plan, id: `sample-${bout.id}-${roundNo}`, roundNo });
  records.set(bout.id, [...(records.get(bout.id) ?? []).filter(r => r.roundNo !== roundNo), round]);
  return readPreviewRounds(bout);
}
export function resetPreviewRounds(boutId: string) { records.delete(boutId); }
