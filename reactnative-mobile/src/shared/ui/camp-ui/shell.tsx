import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyboardFrame, KeyboardScroll, type KeyboardScrollRef, useTypingRoom } from "@/components/forms/keyboard-aware";
import { fonts, useThemePreference } from "@/theme/index";
import { CampScrollContext } from "@/shared/ui/camp-scroll-context";
import { CampReveal } from "@/shared/ui/camp-motion";
import { READABLE_MAX_WIDTH } from "@/components/layout/readable-width";
import { navSideWidth, useNavKind } from "@/components/navigation/nav-rail";
import { useBottomTabBarVisible } from "@/components/navigation/tab-bar-visibility";
import { CAMP_TWO_COLUMN_MAX, CampTwoColumnsProvider, campTwoColumns } from "@/shared/ui/camp-columns";
import { campText } from "@/features/fight-camp/i18n/fight-camp";
import { Copy } from "./text";
import { CampIcon } from "./icon";

/** `footer` docks the screen's save action above the keyboard and home indicator. */
/** Lets a nested screen dock its primary action in the shell footer (stays above the keyboard). */
const CampFooterSlot = createContext<((node: ReactNode) => void) | null>(null);
/** Lets a nested screen pin content (round picker, tabs) above the shell's body, below the header and `top`. */
const CampTopSlot = createContext<((node: ReactNode) => void) | null>(null);
export function CampTop({ children }: { children: ReactNode }) {
  const set = useContext(CampTopSlot);
  useEffect(() => { set?.(children); }, [set, children]);
  useEffect(() => () => set?.(null), [set]);
  return set ? null : <View style={{ gap: 10 }}>{children}</View>;
}
export function CampFooter({ children }: { children: ReactNode }) {
  const set = useContext(CampFooterSlot);
  useEffect(() => { set?.(children); }, [set, children]);
  useEffect(() => () => set?.(null), [set]);
  return set ? null : <View style={{ gap: 10 }}>{children}</View>;
}
/** Below this window height (phone landscape, split screen) CampShell uses a compact header and footer. */
export const CAMP_SHORT_HEIGHT = 500;
export function CampShell({ title, subtitle, children, onBack, preview, footer: ownFooter, columns = false, top, onRefresh }: { title: string; subtitle?: string; children: ReactNode; onBack?: () => void; preview?: boolean; footer?: ReactNode; /** Pull-to-refresh (fighter step 14): a quiet refetch that keeps what is on screen. */ onRefresh?: () => Promise<unknown>; /** Pinned under the header on every view (fighter vs opponent + status); never scrolls. */ top?: ReactNode; /** Phase 5 E: allow two columns when the shell gets at least CAMP_TWO_COLUMN_MIN (744) wide. */ columns?: boolean }) {
  const { colors: c } = useThemePreference(); const insets = useSafeAreaInsets(); const router = useRouter();
  const [slot, setSlot] = useState<ReactNode>(null); const footer = ownFooter ?? slot; const [topSlot, setTopSlot] = useState<ReactNode>(null);
  const scroll = useRef<KeyboardScrollRef>(null);
  // Typing: the pinned top folds away, and on a short screen the footer too, so the field keeps the room.
  const room = useTypingRoom();
  // Inside Coach/Admin tabs the bar below already pads for the gesture area; adding the inset again left a gap.
  const tabBelow = useBottomTabBarVisible();
  const [pulling, setPulling] = useState(false);
  const pull = useCallback(() => { if (!onRefresh) return; setPulling(true); void onRefresh().catch(() => undefined).finally(() => setPulling(false)); }, [onRefresh]);
  // Phase 5 D: tablets may rotate (Android 16 large screens, iPad multitasking); short windows get a compact header and footer.
  const window = useWindowDimensions(); const short = window.height < CAMP_SHORT_HEIGHT;
  // Content width after the side navigation: measured, with the window minus the rail (88) or iPad sidebar (240) until the first layout.
  const nav = useNavKind(); const [measured, setMeasured] = useState(0);
  const wide = campTwoColumns(columns, measured || window.width - navSideWidth(nav));
  const scrollTop = useCallback(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, []);
  useEffect(scrollTop, [title, scrollTop]);
  return <KeyboardFrame testID="camp-shell" onLayout={e => setMeasured(Math.round(e.nativeEvent.layout.width))} style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
    <View testID="camp-column" style={{ flex: 1, width: "100%", maxWidth: wide ? CAMP_TWO_COLUMN_MAX : READABLE_MAX_WIDTH, alignSelf: "center" }}>
      <View testID="camp-header" style={{ paddingHorizontal: 18, minHeight: short ? 44 : 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomColor: c.line, borderBottomWidth: 1 }}>
        {/* Equal side slots keep the title optically centred whether or not the "Dữ liệu mẫu" marker shows. */}
        <View style={{ width: 88, alignItems: "flex-start" }}><Pressable accessibilityRole="button" accessibilityLabel={campText.campUi.quayLai} onPress={onBack ?? (() => router.back())} style={{ minWidth: 48, minHeight: 48, justifyContent: "center" }}><CampIcon name="back" color={c.ink} size={26}/></Pressable></View>
        {/* The screen's one title lives in the header bar (it replaced the fixed "Fight Camp" label). */}
        <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: short ? 18 : 20, lineHeight: short ? 24 : 27, letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{title}</Text>
        <View style={{ width: 88, alignItems: "flex-end" }}><Copy muted small>{preview ? campText.campUi.duLieuMau : ""}</Copy></View>
      </View>
      {(top || topSlot) && !room.typing ? <View testID="camp-top" style={{ paddingHorizontal: 22, paddingTop: short ? 8 : 12, gap: 10 }}>{top}{topSlot}</View> : null}
      <KeyboardScroll ref={scroll} showsVerticalScrollIndicator={false} refreshControl={onRefresh ? <RefreshControl refreshing={pulling} onRefresh={pull} tintColor={c.lotus} colors={[c.lotus]} progressBackgroundColor={c.surface}/> : undefined} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 22, paddingTop: short ? 10 : 16, paddingBottom: footer ? (short ? 12 : 20) : Math.max(tabBelow ? 0 : insets.bottom, 16) + 16, gap: short ? 12 : 16 }}>
        {subtitle ? <Copy muted>{subtitle}</Copy> : null}
        <CampScrollContext.Provider value={scrollTop}><CampTopSlot.Provider value={setTopSlot}><CampFooterSlot.Provider value={setSlot}><CampTwoColumnsProvider value={wide}><CampReveal key={title} style={{ gap: 16 }}>{children}</CampReveal></CampTwoColumnsProvider></CampFooterSlot.Provider></CampTopSlot.Provider></CampScrollContext.Provider>
      </KeyboardScroll>
      {footer && !room.tight ? <View testID="camp-footer-bar" style={{ paddingHorizontal: 22, paddingTop: short ? 6 : 12, paddingBottom: Math.max(tabBelow ? 0 : insets.bottom, short ? 6 : 12) + (short ? 2 : 8), gap: short ? 6 : 10, borderTopColor: c.line, borderTopWidth: 1, backgroundColor: c.bg }}>{footer}</View> : null}
    </View>
  </KeyboardFrame>;
}