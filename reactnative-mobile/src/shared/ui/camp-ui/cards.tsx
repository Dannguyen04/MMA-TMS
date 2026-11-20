import { type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useThemePreference } from "@/theme/index";
import { ArenaFrame } from "@/components/arena/arena-frame";
import { CampReveal } from "@/shared/ui/camp-motion";
import { campText } from "@/features/fight-camp/i18n/fight-camp";
import { Copy, sentences } from "./text";
import { CampIcon } from "./icon";

export function Frame({ children, tone, pad = 16 }: { children: ReactNode; tone?: "danger" | "success" | "accent"; pad?: number; slip?: boolean }) {
  return <ArenaFrame tone={tone} pad={pad}>{children}</ArenaFrame>;
}
export function Notice({ title, children, danger = false, success = false }: { title: string; children?: ReactNode; danger?: boolean; success?: boolean }) {
  const { colors: c } = useThemePreference();
  const content = <View accessibilityRole={danger ? "alert" : undefined} accessibilityLiveRegion={success ? "polite" : undefined}>
    <Frame tone={danger ? "danger" : success ? "success" : "accent"} pad={16}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ paddingTop: 1 }}><CampIcon name={danger ? "alert" : success ? "check" : "arrow"} color={danger ? c.danger : success ? c.success : c.lotus}/></View>
        <Copy strong color={danger ? c.danger : success ? c.success : c.ink}>{title}</Copy>
      </View>
      {typeof children === "string" ? sentences(children).map((line, i) => <Copy key={i}>{line}</Copy>) : children ? <Copy>{children}</Copy> : null}
    </Frame>
  </View>;
  return success && !danger ? <CampReveal>{content}</CampReveal> : content;
}
export function Fact({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 18, paddingVertical: 10, borderBottomColor: c.line, borderBottomWidth: StyleSheet.hairlineWidth }}><Copy muted>{label}</Copy><View style={{ maxWidth: "62%" }}><Copy strong color={danger ? c.danger : undefined}>{value}</Copy></View></View>;
}
export function Busy() { const { colors } = useThemePreference(); return <View style={{ paddingVertical: 48, gap: 16 }}><ActivityIndicator color={colors.lotus}/><Copy muted>{campText.campUi.dangTaiDuLieu}</Copy></View>; }