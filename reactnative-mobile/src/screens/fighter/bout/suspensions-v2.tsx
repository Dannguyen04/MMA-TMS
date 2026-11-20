import { ActivityIndicator, Text, View } from "react-native";
import { StaggerList } from "@/components/motion/motion";
import { useRouter } from "expo-router";

import type { Suspension } from "@/features/fight-camp/api";
import { fighterTran as t } from "@/i18n/fighter/fighter-tran";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { previewSuspensionCases } from "@/features/fight-camp/state/camp-preview";
import { allowedTodayLine, dayMonth, suspensionHeadline, suspensionReasonLabel, suspensionStatusLabel } from "@/features/fight-camp/logic/camp-rules";
import { CampShell, Frame } from "@/shared/ui/camp-ui";
import { loadAllSuspensions } from "@/features/fight-camp/components/fighter-suspension";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { backToTran, splitSuspensions } from "./bout-model";

const reason = (s: Suspension) => suspensionReasonLabel[s.reason] ?? suspensionReasonLabel.OTHER;

/** Đình chỉ (redesign step 12): each suspension in force in a red frame, past ones as rows. Read only. */
export function FighterSuspensionsV2() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const { user, isDemo } = useSession();
  const [src, reload] = useSource(() => isDemo ? Promise.resolve(previewSuspensionCases.active) : loadAllSuspensions(), `${user?.id}-${isDemo}`);
  const split = src.state === "ok" ? splitSuspensions(src.data) : null;

  return <CampShell title={t.susp.title} onBack={() => backToTran(router)} preview={!!isDemo}>
    {src.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {src.state === "error" ? <RetryRow message={t.susp.failed} retry={t.retry} onRetry={reload}/> : null}
    {split && !split.live.length && !split.past.length ? <Text testID="susp-none" style={{ fontFamily: fonts.display, fontSize: fz(22), lineHeight: lh(30), textTransform: "uppercase", color: c.ink }}>{t.susp.none}</Text> : null}
    {split ? <View testID="suspensions-v2" style={{ gap: 14 }}>
      {split.live.map(s => {
        const upcoming = s.status === "UPCOMING";
        const allowed = allowedTodayLine(s);
        return <Frame key={s.id} tone={upcoming ? undefined : "danger"} pad={18}>
          <View testID={`susp-${s.id}`} accessible accessibilityLabel={`${reason(s)}. ${suspensionHeadline(s)}`}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.display, fontSize: fz(24), lineHeight: lh(33), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{reason(s)}</Text>
            <Text numberOfLines={1} style={{ ...readableTextStyle(15, true), color: upcoming ? c.ink : c.danger, marginBottom: 10 }}>{suspensionHeadline(s)}</Text>
          </View>
          <Fact label={t.susp.from} value={dayMonth(s.startsOn)}/>
          <Fact label={t.susp.to} value={dayMonth(s.endsOn)}/>
          <Fact label={t.susp.clearance} value={s.requiresClearance && !s.clearedAt ? t.susp.yes : t.susp.no}/>
          {allowed ? <Text style={{ ...readableTextStyle(15, true), color: c.ink, paddingTop: 10, borderTopColor: c.line, borderTopWidth: 1 }}>{allowed}</Text> : null}
        </Frame>;
      })}
      {split.past.length ? <StaggerList>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(18), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink, marginTop: 6, marginBottom: 2 }}>{t.susp.past}</Text>
        {split.past.map((s, k) => {
          const line = `${t.susp.range(dayMonth(s.startsOn), dayMonth(s.endsOn))} · ${(suspensionStatusLabel[s.status] ?? "").toLocaleLowerCase("vi")}`;
          return <SlipRow key={s.id} testID={`susp-past-${s.id}`} lead="✓" leadTone="ok" title={reason(s)} line={line} a11y={`${reason(s)}. ${line}`} last={k === split.past.length - 1}/>;
        })}
      </StaggerList> : null}
    </View> : null}
  </CampShell>;
}

function Fact({ label, value }: { label: string; value: string }) {
  const { colors: c } = useThemePreference();
  return <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 9, borderTopColor: c.line, borderTopWidth: 1 }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.inkMuted }}>{label}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: c.ink, flexShrink: 1 }}>{value}</Text>
  </View>;
}
