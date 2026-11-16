import { useContext, useEffect, useRef, useState } from "react";
import { Swap } from "@/components/motion-kit";
import { Platform, View } from "react-native";
import { hapticSuccess } from "@/components/motion";
import { CampReveal } from "./camp-motion";
import { campApi, type CampDetail, type RoundInput, type RoundsResponse, type TacticOutcome } from "@/api/fight-camp";
import { betweenRound as t } from "@/i18n/between-round";
import { roundAdvice as adviceCopy } from "@/i18n/round-advice";
import { boutReport } from "@/i18n/bout-report";
import { Action, Busy, CampFooter, CampTop, Choices, Copy, Field, Frame, Notice, RoundTabs } from "./camp-ui";
import { CampTabs, FitList } from "./camp-lit";
import { SlideSheet } from "@/components/ui/slide-sheet";
import { boutTabs } from "@/i18n/bout-tabs";
import { campError } from "./camp-rules";
import { currentRound, entryTactics, compactTactics, initialPlan, nextTacticId, validatePlan, validateRoundMarks } from "./next-round-plan";
import { NextRoundPlanEditor } from "./next-round-plan-editor";
import { readPreviewRounds, resetPreviewRounds, savePreviewRound } from "./preview-round-store";
import { useCampResource } from "./use-camp-resource";
import { CampScrollContext } from "./camp-scroll-context";
import { roundAi as aiCopy } from "@/i18n/round-ai";
import { aiDecision, aiTargetRound, isAlreadyDecided } from "./round-ai";
import { useRoundAi } from "./use-round-ai";
import { useCampTwoColumns } from "./camp-columns";
import { RoundAdvicePanel } from "./round-advice-panel";

/** round=0 means follow the backend's current round until the coach edits/selects one. */
export type RoundDraftState = { round: number; values: Record<number, RoundInput> };
/**
 * A weighed-in bout can reach round entry without a round count (it is optional on create). Instead of a dead end,
 * ask for it here: 3 or 5 in one tap, any other count 1–12 typed. Saved with PATCH /bouts/:id.
 */
function SetRoundsPrompt({ bout, preview, onSet }: { bout: CampDetail; preview: boolean; onSet: (b: CampDetail) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  const [other, setOther] = useState("");
  const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const typed = other.trim() ? Number(other.trim()) : null;
  const count = typed ?? pick;
  async function submit() {
    if (pending) return;
    if (count == null || !Number.isInteger(count) || count < 1 || count > 12) { setError(adviceCopy.roundsRange); return; }
    setPending(true); setError("");
    try { onSet(preview ? { ...bout, scheduledRounds: count } : await campApi.update(bout.id, { scheduledRounds: count })); }
    catch (e) { setError(campError(e)); } finally { setPending(false); }
  }
  return <Frame pad={16}>
    <Copy strong>{adviceCopy.setRoundsTitle}</Copy>
    <Choices<number | null> value={typed == null ? pick : null} onChange={n => { setPick(n); setOther(""); setError(""); }} options={[3, 5].map(n => ({ value: n, label: adviceCopy.roundsOption(n) }))}/>
    <Field label={adviceCopy.otherRounds} value={other} onChangeText={v => { setOther(v.replace(/[^\d]/g, "")); setError(""); }} inputMode="numeric" keyboardType="number-pad" maxLength={2} placeholder="1–12" error={error || undefined}/>
    <Action label={adviceCopy.setRounds(count != null && count >= 1 && count <= 12 ? count : null)} pending={pending} onPress={() => void submit()}/>
  </Frame>;
}

export function RoundScreen({ bout, preview, onReport, draftState, onDraftStateChange, onBoutChange }: {
  bout: CampDetail; preview: boolean; onReport?: () => void; draftState?: RoundDraftState; onDraftStateChange?: (s: RoundDraftState) => void;
  /** The bout changed here (round count set); the bout screen keeps its copy in sync. */
  onBoutChange?: (b: CampDetail) => void;
}) {
  const state = useCampResource(`rounds:${bout.id}:${preview}`, () => preview ? Promise.resolve(readPreviewRounds(bout)) : campApi.rounds(bout.id));
  const [ownDraft, setOwnDraft] = useState<RoundDraftState>({ round: 0, values: {} });
  const drafts = draftState ?? ownDraft;
  const setDrafts = onDraftStateChange ?? setOwnDraft;
  const [more, setMore] = useState(false);
  const [tab, setTab] = useState<"this" | "health" | "next">("this");
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
  function select(n: number) { setDrafts({ ...drafts, round: n }); setMore(false); setTab("this"); setError(""); setSaved(null); setStayed(null); }
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
  const markOptions = [{ value: "EFFECTIVE" as const, label: t.effective, tone: "good" as const }, { value: "INEFFECTIVE" as const, label: t.ineffective, tone: "bad" as const }, { value: "NOT_USED" as const, label: t.unused }];
  function markTactic(a: typeof tactics[number]) { return <View key={a.id} style={{ gap: 4 }}>
    <Choices<TacticOutcome | null> chips label={a.text} value={draft.tacticMarks?.[a.id] ?? null} options={markOptions} disabled={disabled} onChange={v => { if (v) change({ tacticMarks: { ...draft.tacticMarks, [a.id]: v } }); }}/>
  </View>; }
  function markObservation(o: typeof observations[number]) { return <View key={o.id} style={{ gap: 4 }}>
    <Choices<"SEEN" | "NOT_SEEN" | null> chips label={o.text} value={draft.observationMarks?.[o.id] ?? null} options={[{ value: "SEEN", label: t.seen }, { value: "NOT_SEEN", label: t.unseen }]} disabled={disabled} onChange={v => { if (v) change({ observationMarks: { ...draft.observationMarks, [o.id]: v } }); }}/>
  </View>; }
  // Phase 5 E: round entry in two columns from 744 (tactics | health and next-round instructions); phone order below.
  // Two columns (2b): health fields always open on the right; "Ghi thêm" only opens the remaining tactics on the left,
  // and is hidden when there are none.
  const extraMarks = tactics.filter(a => !quick.some(b => b.id === a.id)).length + observations.filter(o => o.id !== mainObservation?.id).length;
  const picker = (data: RoundsResponse, n: number) => <RoundTabs label={t.roundTabs} total={n} value={round} saved={data.rounds.map(r => r.roundNo)} disabled={disabled} onChange={select} tabLabel={t.roundTab} savedLabel={t.roundTabSaved}/>;
  const extras = [...tactics.filter(a => !quick.some(b => b.id === a.id)).map(a => ({ kind: "t" as const, a })), ...observations.filter(o => o.id !== mainObservation?.id).map(o => ({ kind: "o" as const, o }))];
  const thisRound = () => <View style={{ gap: 14 }}>
    {quick.map(markTactic)}
    {!quick.length ? <Copy muted>{t.noTactics}</Copy> : null}
    {/* Two columns show every mark; a phone shows the main ones and opens the rest in a sheet. */}
    {wide ? extras.map(x => x.kind === "t" ? markTactic(x.a) : markObservation(x.o))
      : <FitList items={extras} max={0} moreLabel={boutTabs.more} render={() => null} onMore={() => setMore(true)}/>}
    {mainObservation ? markObservation(mainObservation) : <Copy muted>{t.noObservations}</Copy>}
    <Choices<RoundInput["selfScore"]> chips label={t.selfScore} value={draft.selfScore ?? null} disabled={disabled} options={[{ value: "WIN", label: t.win, tone: "good" }, { value: "CLOSE", label: t.close }, { value: "LOSS", label: t.loss, tone: "bad" }]} onChange={selfScore => change({ selfScore })}/>
  </View>;
  const healthFields = () => <>
    <Field label={t.note} value={draft.note ?? ""} maxLength={300} multiline editable={!disabled} helper={`${draft.note?.length ?? 0}/300 · ${t.draft}`} onChangeText={note => change({ note })}/>
    <Frame pad={12}><Copy strong>{t.knockdowns}</Copy><View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
      <View style={{ flex: 1 }}><Action label={t.decrease} icon="minus" secondary disabled={disabled || !draft.knockdownsAgainst} onPress={() => change({ knockdownsAgainst: (draft.knockdownsAgainst ?? 0) - 1 })}/></View>
      <Copy large strong>{draft.knockdownsAgainst ?? 0}</Copy>
      <View style={{ flex: 1 }}><Action label={t.increase} icon="plus" secondary disabled={disabled || (draft.knockdownsAgainst ?? 0) >= 10} onPress={() => change({ knockdownsAgainst: (draft.knockdownsAgainst ?? 0) + 1 })}/></View>
    </View></Frame>
    {([{ key: "stunned", label: t.stunned }, { key: "bleeding", label: t.bleeding }, { key: "fatigued", label: t.fatigued }] as const).map(f => <Choices key={f.key} chips label={f.label} value={draft[f.key] ? 1 : 0} options={[{ value: 0, label: t.no }, { value: 1, label: t.yes, tone: "bad" }]} onChange={v => change({ [f.key]: !!v })} disabled={disabled}/>)}
  </>;
  const moreMarks = () => <>
    {tactics.filter(a => !quick.some(b => b.id === a.id)).map(markTactic)}
    {observations.filter(o => o.id !== mainObservation?.id).map(markObservation)}
  </>;
  // Advice (safety, self-scored standing, each tactic's score) sits right above the plan it informs, so the break
  // needs one screen. Shown only once the server has advice; no separate advice screen.
  const instructions = (data: RoundsResponse, n: number) => <>
    {data.advice ? <RoundAdvicePanel data={data} heading={false}/> : null}
    {round < n ? <NextRoundPlanEditor key={round} round={round} plan={plan} tactics={tactics} observations={observations} suggested={data.advice?.nextRound && [round, round + 1].includes(data.advice.nextRound.roundNo) ? data.advice.nextRound.suggested : []} disabled={disabled} onChange={nextRoundPlan => change({ nextRoundPlan })} newId={() => nextTacticId(bout, data, round, plan)}
      ai={aiTarget ? { target: aiTarget, state: ai.get(aiTarget), onAsk: () => void ai.ask(aiTarget) } : undefined}/> : <Copy muted>{t.final}</Copy>}
  </>;
  return <View style={{ gap: 12 }} testID="round-entry">
    {state.loading && !state.data ? <Busy/> : null}
    {state.error ? <><Notice title={t.loadFailed} danger>{state.error}</Notice><Action label={t.retry} onPress={() => void state.reload()}/></> : null}
    {total == null && !state.loading && !state.error ? <SetRoundsPrompt bout={bout} preview={preview} onSet={b => {
      onBoutChange?.(b);
      if (preview) state.setData({ ...(state.data ?? readPreviewRounds(b)), scheduledRounds: b.scheduledRounds });
      else void state.reload();
    }}/> : null}
    {state.data && total != null ? <>
      <CampTop>
        {picker(state.data, total)}
        <CampTabs alertLabel={boutTabs.needsAttention} value={tab} onChange={setTab} tabs={[
          { key: "this", label: boutTabs.rounds.thisRound },
          { key: "health", label: boutTabs.rounds.health, alert: !!(draft.knockdownsAgainst || draft.stunned || draft.bleeding) },
          { key: "next", label: boutTabs.rounds.next, alert: !!state.data.advice?.safety },
        ]}/>
      </CampTop>
      {/* The save confirmation shows whichever tab the coach saved from. */}
      {saved != null ? <Notice title={t.saved(saved)} success>{stayed === saved ? aiCopy.stay(saved) : undefined}</Notice> : null}
      <Swap swapKey={`${round}-${tab}`} testID={`round-tab-${tab}`} style={{ gap: 12 }}>
        {tab === "this" ? thisRound() : null}
        {tab === "health" ? <View testID="round-health" style={{ gap: 12 }}>{healthFields()}</View> : null}
        {tab === "next" ? instructions(state.data, total) : null}
      </Swap>
      <SlideSheet visible={more} onClose={() => setMore(false)} title={boutTabs.moreMarks}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 14 }}>{moreMarks()}</View>
      </SlideSheet>
      <CampFooter>{error ? <Notice title={t.saveFailed} danger>{error}</Notice> : null}<Action label={t.save(round, !!existing)} pending={pending} disabled={state.loading || !!state.error} onPress={() => void save()}/></CampFooter>
      {bout.status === "COMPLETED" && onReport ? <Action label={boutReport.openReport} secondary disabled={disabled} onPress={onReport}/> : null}
      {preview ? <Action label={adviceCopy.reset} secondary disabled={disabled} onPress={() => { resetPreviewRounds(bout.id); state.setData(readPreviewRounds(bout)); setDrafts({ round: 0, values: {} }); setSaved(null); setMore(false); setError(""); }}/> : null}
    </> : null}
  </View>;
}
