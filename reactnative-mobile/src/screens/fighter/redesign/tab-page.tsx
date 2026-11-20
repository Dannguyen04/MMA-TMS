import { type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/icon";
import { LiveRefreshControl, useLiveRefresh } from "@/components/feedback/live-refresh";
import { PressableScale } from "@/components/motion/motion";
import { FighterTabFrame } from "@/screens/fighter/shared/tab-bar";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

/**
 * A fighter tab screen in the redesign (REDESIGN-BRIEF-2026-11.md "Fighter tabs"): the centred 54px header bar,
 * one scroll column that refetches on return and on pull, and the fighter tab bar (rail from 900 wide).
 */
export function FighterTabPage({ title, testID, right, onRefresh, children }: {
  title: string; testID?: string; right?: ReactNode; onRefresh: () => Promise<unknown>; children: ReactNode;
}) {
  const { colors: c } = useThemePreference();
  const insets = useSafeAreaInsets();
  const live = useLiveRefresh(onRefresh);
  return <FighterTabFrame><View testID={testID} style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
    <View style={{ minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderBottomColor: c.line, borderBottomWidth: 1 }}>
      <View style={{ width: 56 }}/>
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: fz(20), lineHeight: lh(27), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{title}</Text>
      <View style={{ width: 56, alignItems: "flex-end" }}>{right}</View>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<LiveRefreshControl refreshing={live.refreshing} onRefresh={live.onRefresh}/>}
      contentContainerStyle={{ width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 22, paddingTop: 16, paddingBottom: 24, gap: 14 }}>
      {children}
    </ScrollView>
  </View></FighterTabFrame>;
}

export type LeadTone = "ok" | "warn" | "dim";
/**
 * One-line row: a big lead (number, mark or icon) on the left, an uppercase title and one line of text, a chevron.
 * The whole row is the button. Text never wraps (owner 2026-11-11).
 */
export function SlipRow({ testID, lead, leadSub, leadTone, icon, title, line, lineTone, word, wordTone, note, a11y, onPress, last, dot }: {
  testID?: string; lead?: string; leadSub?: string; leadTone?: LeadTone; icon?: IconName;
  /** A small red square beside the lead: something new (an unread notification, step 19). */ dot?: boolean;
  title: string; line?: string; lineTone?: "ok" | "warn";
  /** A status word before the line, coloured on its own ("Chấn thương · Hạng lông"); the rest stays ink. */
  word?: string; wordTone?: "ok" | "warn";
  /** A red alert under the line that must not be cut (a suspension a coach has to see): one fact per line, never
   * truncated. */ note?: string | readonly string[];
  a11y: string; /** Without it the row is plain text, no chevron. */ onPress?: () => void; last?: boolean;
}) {
  const { colors: c } = useThemePreference();
  const tone = leadTone === "ok" ? c.success : leadTone === "warn" ? c.danger : leadTone === "dim" ? c.inkSubtle : c.ink;
  const style = { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1, ...(last ? { borderBottomColor: c.line, borderBottomWidth: 1 } : null) } as const;
  const body = <>
    <View style={{ width: 52, flexDirection: "row", alignItems: "baseline" }}>
      {icon ? <Icon name={icon} size={28} color={leadTone ? tone : c.ink}/>
        : <><Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(32), lineHeight: lh(36), color: tone }}>{lead}</Text>
          {leadSub ? <Text style={{ fontFamily: fonts.display, fontSize: fz(16), lineHeight: lh(20), color: tone }}>{leadSub}</Text> : null}</>}
      {dot ? <View testID={testID ? `${testID}-dot` : undefined} aria-hidden={true} style={{ position: "absolute", left: 34, top: 0, width: 8, height: 8, backgroundColor: c.lotus }}/> : null}
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={2} style={{ fontFamily: fonts.display, fontSize: fz(17), lineHeight: lh(23), letterSpacing: 0.5, textTransform: "uppercase", color: c.ink }}>{title}</Text>
      {/* A plain row has nowhere to open the rest, so its line is never cut. */}
      {line || word ? <Text numberOfLines={onPress ? 2 : undefined} style={{ ...readableTextStyle(13.5, !!lineTone), color: lineTone === "ok" ? c.success : lineTone === "warn" ? c.danger : c.ink }}>
        {word ? <Text style={{ ...readableTextStyle(13.5, true), color: wordTone === "ok" ? c.success : wordTone === "warn" ? c.danger : c.ink }}>{word}</Text> : null}
        {word && line ? ` · ${line}` : line}
      </Text> : null}
      {note ? <View testID={testID ? `${testID}-note` : undefined}>
        {(typeof note === "string" ? [note] : note).map((n, i) => <Text key={i} style={{ ...readableTextStyle(13.5, i === 0), color: c.danger }}>{n}</Text>)}
      </View> : null}
    </View>
  </>;
  if (!onPress) return <View testID={testID} accessible accessibilityLabel={a11y} style={style}>{body}</View>;
  return <PressableScale testID={testID} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={style}>
    {body}
    <Icon name="chevron" size={18} color={c.inkSubtle}/>
  </PressableScale>;
}

/** A failed part on its own row: the message, then a one-line "Thử lại" (owner 2026-11-11). */
export function RetryRow({ message, retry, onRetry }: { message: string; retry: string; onRetry: () => void }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: c.danger, flex: 1 }}>{message}</Text>
    <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", paddingLeft: 8, opacity: pressed ? 0.7 : 1 })}>
      <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{retry}</Text>
    </Pressable>
  </View>;
}
