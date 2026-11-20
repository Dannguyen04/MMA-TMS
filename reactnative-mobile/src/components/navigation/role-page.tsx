import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { KeyboardFrame, KeyboardScroll } from "@/components/forms/keyboard-aware";
import { LiveRefreshControl, useLiveRefresh } from "@/components/feedback/live-refresh";
import { useThemePreference } from "@/theme/index";
import { fonts, fz, lh } from "@/theme/typography";

const noRefresh = () => Promise.resolve();

/**
 * A coach, doctor or admin page in the redesign (steps 16–25), the same grammar as the fighter pages:
 * the centred 54px header (back on sub-pages, an action such as the bell on the right), one scroll column
 * that refetches on pull, and an optional footer pinned above the keyboard for the page's one save action.
 * The role tab bar comes from the Tabs layout, so it is not drawn here.
 */
export function RolePage({ title, onBack, backLabel = "Quay lại", right, onRefresh, pinned, footer, testID, children }: {
  title: string; onBack?: () => void; backLabel?: string; right?: ReactNode;
  /** Stays under the header while the column scrolls (the appearance page's live preview). */
  pinned?: ReactNode;
  onRefresh?: () => Promise<unknown>; footer?: ReactNode; testID?: string; children: ReactNode;
}) {
  const { colors: c } = useThemePreference();
  const insets = useSafeAreaInsets();
  const live = useLiveRefresh(onRefresh ?? noRefresh);
  return <KeyboardFrame testID={testID} style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
    <View style={{ minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, borderBottomColor: c.line, borderBottomWidth: 1 }}>
      <View style={{ width: 56 }}>
        {onBack ? <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} hitSlop={4}
          style={({ pressed }) => ({ width: 48, height: 48, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
          <Icon name="back" size={24} color={c.ink}/>
        </Pressable> : null}
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: fz(20), lineHeight: lh(27), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{title}</Text>
      <View style={{ width: 56, alignItems: "flex-end" }}>{right}</View>
    </View>
    {pinned ? <View testID="role-page-pinned" style={{ width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 22, paddingTop: 12, paddingBottom: 12, borderBottomColor: c.line, borderBottomWidth: 1, backgroundColor: c.bg }}>{pinned}</View> : null}
    <KeyboardScroll showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <LiveRefreshControl refreshing={live.refreshing} onRefresh={live.onRefresh}/> : undefined}
      contentContainerStyle={{ width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 22, paddingTop: 16, paddingBottom: 24, gap: 14 }}>
      {children}
    </KeyboardScroll>
    {footer ? <View testID="role-page-footer" style={{ width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 22, paddingTop: 10, paddingBottom: 14, borderTopColor: c.line, borderTopWidth: 1, backgroundColor: c.bg }}>{footer}</View> : null}
  </KeyboardFrame>;
}

/** A big uppercase line for an empty list, then one plain sentence. */
export function EmptyLine({ title, line, testID }: { title: string; line?: string; testID?: string }) {
  const { colors: c } = useThemePreference();
  return <View testID={testID} style={{ gap: 6 }}>
    <Text style={{ fontFamily: fonts.display, fontSize: fz(22), lineHeight: lh(30), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{title}</Text>
    {line ? <Text style={{ fontSize: fz(15), lineHeight: lh(22), color: c.ink }}>{line}</Text> : null}
  </View>;
}
