import { useContext, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { hapticSuccess } from "@/components/motion";
import { CampReveal } from "./camp-motion";
import { campApi, type CampDetail, type RoundInput, type RoundsResponse, type TacticOutcome } from "@/api/fight-camp";
import { betweenRound as t } from "@/i18n/between-round";
import { roundAdvice as adviceCopy } from "@/i18n/round-advice";
import { boutReport } from "@/i18n/bout-report";
import { Action, Busy, CampFooter, Choices, Copy, Field, Frame, Notice, RoundTabs, SvgTitle } from "./camp-ui";
import { campError } from "./camp-rules";
import { currentRound, entryTactics, compactTactics, initialPlan, nextTacticId, validatePlan, validateRoundMarks } from "./next-round-plan";
import { NextRoundPlanEditor } from "./next-round-plan-editor";
import { readPreviewRounds, resetPreviewRounds, savePreviewRound } from "./preview-round-store";
import { useCampResource } from "./use-camp-resource";
import { CampScrollContext } from "./camp-scroll-context";
import { roundAi as aiCopy } from "@/i18n/round-ai";
import { aiDecision, aiTargetRound, isAlreadyDecided } from "./round-ai";
import { useRoundAi } from "./use-round-ai";
import { CampColumns, useCampTwoColumns } from "./camp-columns";

/** round=0 means follow the backend's current round until the coach edits/selects one. */
export type RoundDraftState = { round: number; values: Record<number, RoundInput> };
export function RoundScreen({ bout, preview, onAdvice, onReport, draftState, onDraftStateChange }: {
  bout: CampDetail; preview: boolean; onAdvice: () => void; onReport?: () => void; draftState?: RoundDraftState; onDraftStateChange?: (s: RoundDraftState) => void;
}) {
  const state = useCampResource(`rounds:${bout.id}:${preview}`, () => preview ? Promise.resolve(readPreviewRounds(bout)) : campApi.rounds(bout.id));
  const [ownDraft, setOwnDraft] = useState<RoundDraftState>({ round: 0, values: {} });
  const drafts = draftState ?? ownDraft;
  const setDrafts = onDraftStateChange ?? setOwnDraft;
  const [more, setMore] = useState(false);
  const [pending, setPending] = useState(false); const lock = useRef(false);
  const [error, setError] = useState(""); const [saved, setSaved] = useState<number | null>(null);
  /** 1A: round whose save kept the coach on its tab because AI advice for the next round is valid. */
  const [stayed, setStayed] = useState<number | null>(null);
  const ai = useRoundAi(bout.id, preview);
  const decided = ai.decided;
  const restoredFor = useRef(new Set<number>());
  const total = state.data?.scheduledRounds ?? bout.scheduledRounds;
  const round = drafts.round || currentRound(state.data, total ?? 1);
  const scrollTop = useContext(CampScrollContext);
  const wide = useCampTwoColumns();
  useEffect(scrollTop, [round, scrollTop]);
  const existing = state.data?.rounds.find(r => r.roundNo === round);
  const draft: RoundInput = drafts.values[round] ?? existing ?? { selfScore: null, knockdownsAgainst: 0, stunned: false, bleeding: false, fatigued: false, tacticMarks: {}, observationMarks: {}, note: "" };
  const plan = draft.nextRoundPlan ?? initialPlan(state.data, round);
  const tactics = entryTactics(bout, state.data, round);
  const quick = compactTactics(tactics, state.data, round);
  const observations = bout.opponentAnalysis.observations ?? [];
  const mainObservation = observations.find(o => quick.some(a => bout.opponentAnalysis.tactics?.find(b => b.id === a.id)?.observationIds.includes(o.id) || state.data?.rounds.some(r => r.nextRoundPlan?.addedTactics.some(b => b.id === a.id && b.observationIds.includes(o.id))))) ?? observations[0];
  const disabled = pending || state.loading;
  const aiTarget = aiTargetRound(bout, state.data, round, total);
  // Re-entry: restore AI lines for the current n+1 once per target (read only).
  useEffect(() => {
    if (!aiTarget || restoredFor.current.has(aiTarget)) return;
    restoredFor.current.add(aiTarget); void ai.restore(aiTarget);
  }, [aiTarget, ai.restore]);
  function change(patch: Partial<RoundInput>) {
    setDrafts({ ...drafts, round, values: { ...drafts.values, [round]: { ...draft, nextRoundPlan: plan, ...patch } } });
    setSaved(null); setError(""); setStayed(null);
  }
  function select(n: number) { setDrafts({ ...drafts, round: n }); setMore(false); setError(""); setSaved(null); setStayed(null); }
  async function save() {
    if (lock.current || !total || !state.data || state.loading || state.error) return;
    lock.current = true; setPending(true); setError(""); setSaved(null);
    try {
      const nextRoundPlan = round < total ? validatePlan(plan, bout, state.data.rounds, round) : undefined;
      const body: RoundInput = { selfScore: draft.selfScore ?? null, knockdownsAgainst: draft.knockdownsAgainst ?? 0, stunned: !!draft.stunned, bleeding: !!draft.bleeding, fatigued: !!draft.fatigued, tacticMarks: draft.tacticMarks ?? {}, observationMarks: draft.observationMarks ?? {}, note: draft.note?.trim() || null, ...(nextRoundPlan ? { nextRoundPlan } : {}) };
      validateRoundMarks(body, bout, state.data, round);
      // Same gate as the server, evaluated as if this round were saved: stay on tab n when n+1 may ask AI.
      const stayTarget = aiTargetRound(bout, { ...state.data, rounds: [...state.data.rounds.filter(r => r.roundNo !== round), { ...body, id: "", roundNo: round }] }, round, total);
      if (preview) state.setData(savePreviewRound(bout, round, body));
      else {
        const record = await campApi.saveRound(bout.id, round, body);
        // 6A: the decision goes out only with a saved round, once per suggestion, and never blocks or undoes the save.
        const shown = ai.get(round + 1);
        if (shown.phase === "ready" && !decided.current.has(shown.suggestion.id)) {
          const decision = aiDecision(shown.lines, nextRoundPlan);
          const id = shown.suggestion.id;
          if (decision) {
            decided.current.add(id);
            void campApi.decideAi(bout.id, id, decision).catch(e => { if (!isAlreadyDecided(e)) decided.current.delete(id); });
          }
        }
        state.setData({ ...state.data, rounds: [...state.data.rounds.filter(r => r.roundNo !== round), record].sort((a, b) => a.roundNo - b.roundNo), advice: null });
        await state.reload();
      }
      const remaining = { ...drafts.values }; delete remaining[round];
      setDrafts({ round: stayTarget ? round : 0, values: remaining }); setSaved(round); setStayed(stayTarget ? round : null); setMore(false);
      // 7A option C: read the latest suggestion back from history; never a new Gemini call.
      if (stayTarget) { restoredFor.current.add(stayTarget); void ai.restore(stayTarget); }
      if (Platform.OS !== "web") hapticSuccess();
    } catch (e) { setError(campError(e)); } finally { lock.current = false; setPending(false); }
  }
  const markOptions = [{ value: "EFFECTIVE" as const, label: t.effective }, { value: "INEFFECTIVE" as const, label: t.ineffective }, { value: "NOT_USED" as const, label: t.unused }];
  function markTactic(a: typeof tactics[number]) { return <View key={a.id} style={{ gap: 4 }}>
    <Choices<TacticOutcome | null> label={a.text} value={draft.tacticMarks?.[a.id] ?? null} options={markOptions} disabled={disabled} onChange={v => { if (v) change({ tacticMarks: { ...draft.tacticMarks, [a.id]: v } }); }}/>
  </View>; }
  function markObservation(o: typeof observations[number]) { return <View key={o.id} style={{ gap: 4 }}>
    <Choices<"SEEN" | "NOT_SEEN" | null> label={o.text} value={draft.observationMarks?.[o.id] ?? null} options={[{ value: "SEEN", label: t.seen }, { value: "NOT_SEEN", label: t.unseen }]} disabled={disabled} onChange={v => { if (v) change({ observationMarks: { ...draft.observationMarks, [o.id]: v } }); }}/>
  </View>; }
  // Phase 5 E: round entry in two columns from 900 (tactics | health and next-round instructions); phone order below.
  // Two columns (2b): health fields always open on the right; "Ghi thêm" only opens the remaining tactics on the left,
  // and is hidden when there are none.
  const extraMarks = tactics.filter(a => !quick.some(b => b.id === a.id)).length + observations.filter(o => o.id !== mainObservation?.id).length;
  const head = (data: RoundsResponse, n: number) => <>
    {saved != null ? <Notice title={t.saved(saved)} success>{stayed === saved ? aiCopy.stay(saved) : undefined}</Notice> : null}
    <RoundTabs label={t.roundTabs} total={n} value={round} saved={data.rounds.map(r => r.roundNo)} disabled={disabled} onChange={select} tabLabel={t.roundTab} savedLabel={t.roundTabSaved}/>
    <CampReveal key={`round-${round}`}><SvgTitle small>{t.current(round)}</SvgTitle></CampReveal>
    <Copy muted>{t.compact}</Copy>
    <Frame pad={12}>
      {quick.map(markTactic)}
      {!quick.length ? <Copy muted>{t.noTactics}</Copy> : null}
      {mainObservation ? markObservation(mainObservation) : <Copy muted>{t.noObservations}</Copy>}
      <Choices<RoundInput["selfScore"]> label={t.selfScore} value={draft.selfScore ?? null} disabled={disabled} options={[{ value: "WIN", label: t.win }, { value: "CLOSE", label: t.close }, { value: "LOSS", label: t.loss }]} onChange={selfScore => change({ selfScore })}/>
    </Frame>
    {!wide || extraMarks ? <Action label={more ? t.less : t.more} secondary disabled={disabled} onPress={() => setMore(!more)}/> : null}
  </>;
  const healthFields = () => <>
    <Field label={t.note} value={draft.note ?? ""} maxLength={300} multiline editable={!disabled} helper={`${draft.note?.length ?? 0}/300 · ${t.draft}`} onChangeText={note => change({ note })}/>
    <Frame pad={12}><Copy strong>{t.knockdowns}</Copy><View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
      <View style={{ flex: 1 }}><Action label={t.decrease} icon="minus" secondary disabled={disabled || !draft.knockdownsAgainst} onPress={() => change({ knockdownsAgainst: (draft.knockdownsAgainst ?? 0) - 1 })}/></View>
      <Copy large strong>{draft.knockdownsAgainst ?? 0}</Copy>
      <View style={{ flex: 1 }}><Action label={t.increase} icon="plus" secondary disabled={disabled || (draft.knockdownsAgainst ?? 0) >= 10} onPress={() => change({ knockdownsAgainst: (draft.knockdownsAgainst ?? 0) + 1 })}/></View>
    </View></Frame>
    {([{ key: "stunned", label: t.stunned }, { key: "bleeding", label: t.bleeding }, { key: "fatigued", label: t.fatigued }] as const).map(f => <Choices key={f.key} label={f.label} value={draft[f.key] ? 1 : 0} options={[{ value: 0, label: t.no }, { value: 1, label: t.yes }]} onChange={v => change({ [f.key]: !!v })} disabled={disabled}/>)}
  </>;
  const moreMarks = () => <>
    {tactics.filter(a => !quick.some(b => b.id === a.id)).map(markTactic)}
    {observations.filter(o => o.id !== mainObservation?.id).map(markObservation)}
  </>;
  const instructions = (data: RoundsResponse, n: number) => <>
    {data.advice?.safety ? <Notice title={adviceCopy.safetyTitle} danger>{adviceCopy.safety}</Notice> : null}
    {round < n ? <NextRoundPlanEditor key={round} round={round} plan={plan} tactics={tactics} observations={observations} suggested={data.advice?.nextRound && [round, round + 1].includes(data.advice.nextRound.roundNo) ? data.advice.nextRound.suggested : []} disabled={disabled} onChange={nextRoundPlan => change({ nextRoundPlan })} newId={() => nextTacticId(bout, data, round, plan)}
      ai={aiTarget ? { target: aiTarget, state: ai.get(aiTarget), onAsk: () => void ai.ask(aiTarget) } : undefined}/> : <Copy muted>{t.final}</Copy>}
  </>;
  return <View style={{ gap: 12 }} testID="round-entry">
    {state.loading && !state.data ? <Busy/> : null}
    {state.error ? <><Notice title={t.loadFailed} danger>{state.error}</Notice><Action label={t.retry} onPress={() => void state.reload()}/></> : null}
    {total == null && !state.loading ? <Notice title={adviceCopy.missingRounds}/> : null}
    {state.data && total != null ? <>
      <CampColumns gap={12} left={<>
        {head(state.data, total)}
        {more && extraMarks ? <CampReveal disclosure style={{ gap: 12 }}>{moreMarks()}</CampReveal> : null}
      </>} right={<>
        <View testID="round-health" style={{ gap: 12 }}>{healthFields()}</View>
        {instructions(state.data, total)}
      </>}>
      {head(state.data, total)}
      {more ? <CampReveal disclosure style={{ gap: 12 }}>
        {healthFields()}
        {moreMarks()}
      </CampReveal> : null}
      {instructions(state.data, total)}
      </CampColumns>
      <CampFooter>{error ? <Notice title={t.saveFailed} danger>{error}</Notice> : null}<Action label={t.save(round, !!existing)} pending={pending} disabled={state.loading || !!state.error} onPress={() => void save()}/></CampFooter>
      <Action label={adviceCopy.title} secondary disabled={disabled} onPress={onAdvice}/>
      {bout.status === "COMPLETED" && onReport ? <Action label={boutReport.openReport} secondary disabled={disabled} onPress={onReport}/> : null}
      {preview ? <Action label={adviceCopy.reset} secondary disabled={disabled} onPress={() => { resetPreviewRounds(bout.id); state.setData(readPreviewRounds(bout)); setDrafts({ round: 0, values: {} }); setSaved(null); setMore(false); setError(""); }}/> : null}
    </> : null}
  </View>;
}
