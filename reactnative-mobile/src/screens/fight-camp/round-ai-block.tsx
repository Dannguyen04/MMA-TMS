import { View } from "react-native";
import type { NextRoundPlan } from "@/api/fight-camp";
import { aiNotes } from "@/i18n/backend-codes";
import { roundAi as t } from "@/i18n/round-ai";
import { Action, Copy, PlanToggle } from "./camp-ui";
import { isAiPicked, type AiLine } from "./round-ai";
import type { RoundAiState } from "./use-round-ai";

/**
 * T-038 B2 block inside "Hiệp n+1: làm gì", under the rule-based suggestions.
 * A picked line becomes a CUSTOM instruction; AI lines only take free slots of the 3 (5B).
 * Errors are one quiet line (2A): no retry button, saving is never blocked.
 */
export function RoundAiBlock({ target, state, plan, disabled, onAsk, onToggle }: {
  target: number; state: RoundAiState; plan: NextRoundPlan; disabled: boolean; onAsk: () => void; onToggle: (line: AiLine, picked: boolean) => void;
}) {
  const full = plan.instructions.length >= 3;
  return <View style={{ gap: 8 }} testID="round-ai" accessibilityLiveRegion="polite">
    {state.phase === "idle" || state.phase === "loading" ? <>
      <Action label={t.ask} secondary pending={state.phase === "loading"} disabled={disabled} onPress={onAsk}/>
      <Copy muted small>{state.phase === "loading" ? t.loading : t.askHint(target)}</Copy>
    </> : null}
    {state.phase === "problem" ? <Copy muted small>{state.text}</Copy> : null}
    {state.phase === "ready" ? <>
      <Copy strong>{t.heading}</Copy>
      {state.lines.map(line => {
        const picked = isAiPicked(plan, line);
        return <PlanToggle key={line.id} testID={`ai-line-${line.id}`} tag={aiNotes.label} label={line.text} selected={picked}
          disabled={disabled || (!picked && full)} onPress={() => onToggle(line, picked)}/>;
      })}
      {state.hidden ? <Copy muted small>{t.hidden(state.hidden)}</Copy> : null}
      {state.sample ? <Copy muted small>{aiNotes.sample}</Copy> : null}
      {/* Truthful: only for a suggestion read back from history or served from the server cache. */}
      {state.restored || state.suggestion.cached ? <Copy muted small>{aiNotes.cached}</Copy> : null}
    </> : null}
  </View>;
}
