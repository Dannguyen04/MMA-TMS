import { View } from "react-native";
import type { RoundsResponse } from "@/api/fight-camp";
import { roundAdvice as t } from "@/i18n/round-advice";
import { Copy, Frame, Notice, SvgTitle } from "./camp-ui";

/** Presentation only: live mode must render server advice without recomputing/sorting it. */
export function RoundAdvicePanel({ data, refreshing = false, heading = true }: { data: RoundsResponse; refreshing?: boolean; heading?: boolean }) {
  const advice = data.advice;
  const nextRound = Math.max(0, ...data.rounds.map(r => r.roundNo)) + 1;
  return <View style={{ gap: 16 }} accessibilityLiveRegion="polite" testID="round-advice-panel">
    {heading ? <SvgTitle small>{advice && data.scheduledRounds != null && nextRound <= data.scheduledRounds ? t.beforeRound(nextRound) : t.title}</SvgTitle> : null}
    <Copy muted>{t.disclaimer}</Copy>
    {refreshing ? <Copy muted>{t.updating}</Copy> : !advice ? <Copy muted>{data.scheduledRounds == null ? t.missingRounds : !data.rounds.length ? t.noRounds : data.rounds.length >= data.scheduledRounds ? t.complete : t.unavailable}</Copy> : <>
      {advice.safety ? <Notice title={t.safetyTitle} danger>{[t.safety, advice.safety.reasons.includes("KNOCKDOWNS") ? t.knockdowns : "", advice.safety.reasons.includes("STUNNED_STREAK") ? t.stunned : ""].filter(Boolean).join("\n")}</Notice> : null}
      <Frame><Copy muted>{t.selfScored}</Copy><Copy large strong>{advice.standing.kind === "AHEAD" ? t.ahead : advice.standing.kind === "NEED_WINS" ? t.needWins(advice.standing.needed!, advice.standing.remaining!) : t.hardToWin}</Copy></Frame>
      {advice.tactics.map(tactic => <Frame key={tactic.id}>
        <Copy large strong strike={tactic.dropped}>{tactic.text}</Copy>
        <Copy muted>{t.score(tactic.score)} · {tactic.trained ? "Đã luyện" : "Chưa luyện"}</Copy>
        {tactic.dropped ? <Copy strong>{t.dropped}</Copy> : null}
        {tactic.note === "OPPONENT_MAY_HAVE_CHANGED" ? <Copy>{t.changed}</Copy> : null}
      </Frame>)}
      {!advice.tactics.length ? <Copy muted>{t.emptyTactics}</Copy> : null}
    </>}
  </View>;
}
