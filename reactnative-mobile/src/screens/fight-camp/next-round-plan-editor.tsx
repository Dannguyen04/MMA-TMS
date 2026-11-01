import { useState } from "react";
import { CampReveal } from "./camp-motion";
import { View } from "react-native";
import type { NextRoundPlan, Observation, RoundInstruction } from "@/api/fight-camp";
import { betweenRound as t, instructionText } from "@/i18n/between-round";
import { Action, Copy, Field, Frame, PlanToggle, SvgTitle } from "./camp-ui";
import { instructionKey, type PlanTactic } from "./next-round-plan";
import { RoundAiBlock } from "./round-ai-block";
import type { AiLine } from "./round-ai";
import type { RoundAiState } from "./use-round-ai";

/** Present only when AI advice for round+1 is valid now (aiTargetRound). */
export type PlanAi = { target: number; state: RoundAiState; onAsk: () => void };

export function NextRoundPlanEditor({ round, plan, tactics, observations, suggested, disabled, onChange, newId, ai }: {
  round: number; plan: NextRoundPlan; tactics: PlanTactic[]; observations: Observation[]; suggested: RoundInstruction[];
  disabled: boolean; onChange: (p: NextRoundPlan) => void; newId: () => string; ai?: PlanAi;
}) {
  // A picked AI line is a CUSTOM instruction too; only the others belong to the free-text field.
  const aiTexts = new Set(ai?.state.phase === "ready" ? ai.state.lines.map(l => l.text) : []);
  const isFree = (i: RoundInstruction) => i.code === "CUSTOM" && !aiTexts.has(i.text?.trim() ?? "");
  const freeCustoms = plan.instructions.filter(isFree);
  const [more, setMore] = useState(() => !!plan.addedTactics.length);
  const allTactics: PlanTactic[] = [...tactics, ...plan.addedTactics.filter(a => a.text.trim()).map(a => ({ ...a, round: null, partnerBrief: null, trained: false, basis: "ONCE" as const, addedRound: round }))];
  const focusOptions = more ? allTactics : allTactics.filter((a, i) => i < 2 || plan.focusTacticIds.includes(a.id));
  // The field edits the last free CUSTOM; earlier ones (e.g. an AI line saved from an older suggestion) stay toggles.
  const custom = freeCustoms.at(-1);
  const customIndex = custom ? plan.instructions.lastIndexOf(custom) : -1;
  // The free instruction counts toward the 3; say why it is locked instead of disabling it silently.
  const customLocked = !custom && plan.instructions.length >= 3;
  const choices = [...suggested, ...plan.instructions.filter(i => i.code !== "CUSTOM" || (isFree(i) && i !== custom))].filter((i, n, a) => a.findIndex(j => instructionKey(j) === instructionKey(i)) === n)
    .sort((a, b) => Number(b.code === "SAFETY_CHECK") - Number(a.code === "SAFETY_CHECK"));
  function focus(id: string) { onChange({ ...plan, focusTacticIds: plan.focusTacticIds.includes(id) ? plan.focusTacticIds.filter(v => v !== id) : [...plan.focusTacticIds, id] }); }
  return <View style={{ gap: 10 }} testID="next-round-plan">
    <SvgTitle small>{t.next(round + 1)}</SvgTitle>
    <Copy strong>{t.suggested} · {t.picked(plan.instructions.length)}</Copy>
    <Copy muted>{t.instructionLimit}</Copy>
    {choices.map(i => {
      const selected = plan.instructions.some(a => instructionKey(a) === instructionKey(i));
      return <PlanToggle key={instructionKey(i)} label={instructionText(i, allTactics)} selected={selected} danger={i.code === "SAFETY_CHECK"}
        disabled={disabled || (!selected && plan.instructions.length >= 3)} onPress={() => onChange({ ...plan, instructions: selected ? plan.instructions.filter(a => instructionKey(a) !== instructionKey(i)) : [...plan.instructions, { ...i }] })}/>;
    })}
    {!choices.length ? <Copy muted>{t.noSuggestions}</Copy> : null}
    {ai ? <RoundAiBlock target={ai.target} state={ai.state} plan={plan} disabled={disabled} onAsk={ai.onAsk}
      onToggle={(line: AiLine, picked: boolean) => onChange({ ...plan, instructions: picked
        ? plan.instructions.filter(i => !(i.code === "CUSTOM" && i.text?.trim() === line.text))
        : plan.instructions.length >= 3 ? plan.instructions : [...plan.instructions, { code: "CUSTOM", text: line.text }] })}/> : null}
    <Field label={t.custom} value={custom?.text ?? ""} maxLength={140} helper={customLocked ? t.customLocked : `${custom?.text?.length ?? 0}/140 · ${t.optional}`}
      editable={!disabled && !customLocked} onChangeText={text => {
        const rest = plan.instructions.filter((_, n) => n !== customIndex);
        const next = text ? { code: "CUSTOM" as const, text } : null;
        onChange({ ...plan, instructions: customIndex < 0 ? [...rest, ...(next ? [next] : [])] : next ? [...rest.slice(0, customIndex), next, ...rest.slice(customIndex)] : rest });
      }}/>
    <Copy strong>{t.focus} · {plan.focusTacticIds.length}/2</Copy>
    <Copy muted>{t.focusLimit}</Copy>
    {focusOptions.map(a => <View key={a.id} style={{ gap: 4 }}>
      <PlanToggle label={a.text} selected={plan.focusTacticIds.includes(a.id)} disabled={disabled || (!plan.focusTacticIds.includes(a.id) && plan.focusTacticIds.length >= 2)} onPress={() => focus(a.id)}/>
      {a.dropped && plan.focusTacticIds.includes(a.id) ? <Copy>{t.dropped}</Copy> : null}
    </View>)}
    {!allTactics.length ? <Copy muted>{t.noFocus}</Copy> : null}
    <Action label={more ? t.hideExtras : t.extras} secondary disabled={disabled} onPress={() => setMore(!more)}/>
    {more ? <CampReveal disclosure style={{ gap: 12 }}>
      {plan.addedTactics.map((a, index) => <Frame key={a.id} pad={12}>
        <Field label={`${t.added} ${index + 1}`} value={a.text} maxLength={140} editable={!disabled} helper={`${a.text.length}/140`}
          onChangeText={text => onChange({ ...plan, addedTactics: plan.addedTactics.map(b => b.id === a.id ? { ...b, text } : b) })}/>
        {observations.length ? <Copy strong>{t.basis}</Copy> : null}
        {observations.map(o => <PlanToggle key={o.id} label={o.text} selected={a.observationIds.includes(o.id)} disabled={disabled || (!a.observationIds.includes(o.id) && a.observationIds.length >= 3)}
          onPress={() => onChange({ ...plan, addedTactics: plan.addedTactics.map(b => b.id === a.id ? { ...b, observationIds: b.observationIds.includes(o.id) ? b.observationIds.filter(id => id !== o.id) : [...b.observationIds, o.id] } : b) })}/>)}
        <Action label={`${t.remove} ${index + 1}`} secondary disabled={disabled} onPress={() => onChange({ ...plan, addedTactics: plan.addedTactics.filter(b => b.id !== a.id), focusTacticIds: plan.focusTacticIds.filter(id => id !== a.id), instructions: plan.instructions.filter(i => i.tacticId !== a.id) })}/>
      </Frame>)}
      <Action label={t.add} secondary disabled={disabled || plan.addedTactics.length >= 2} onPress={() => onChange({ ...plan, addedTactics: [...plan.addedTactics, { id: newId(), text: "", observationIds: [] }] })}/>
    </CampReveal> : null}
  </View>;
}
