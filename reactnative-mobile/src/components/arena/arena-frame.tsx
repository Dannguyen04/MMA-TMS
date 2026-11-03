import { useId, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useThemePreference } from "@/theme";

export type ArenaTone = "neutral" | "accent" | "danger" | "success";

/** Measured SVG chrome, with cut corners and short accent seams. */
export function ArenaSurface({ tone = "neutral", fill, stroke, active = false }: {
  tone?: ArenaTone; fill?: string; stroke?: string; active?: boolean;
}) {
  const { colors } = useThemePreference();
  const [size, setSize] = useState({ width: 1, height: 1 });
  const id = `arena-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const w = Math.max(1, size.width), h = Math.max(1, size.height);
  const cut = Math.min(17, h / 4, w / 6);
  const accent = tone === "danger" ? colors.danger : tone === "success" ? colors.success : colors.lotus;
  const edge = stroke ?? (active || tone !== "neutral" ? accent : colors.controlBorder);
  const d = `M1 1H${w - cut}L${w - 1} ${cut}V${h - 1}H${cut}L1 ${h - cut}Z`;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    onLayout={({ nativeEvent: { layout } }) => setSize(old => old.width === layout.width && old.height === layout.height ? old : layout)}
    style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
    {w > 1 && h > 1 ? <Svg width={w} height={h} pointerEvents="none" style={{ pointerEvents: "none" }} aria-hidden={true}>
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={accent} stopOpacity={0.45}/><Stop offset="0.5" stopColor={accent} stopOpacity={0}/><Stop offset="1" stopColor={accent} stopOpacity={0.25}/>
      </LinearGradient></Defs>
      {active ? <Path d={d} stroke={`url(#${id})`} strokeWidth={5} fill="none"/> : null}
      <Path d={d} fill={fill ?? colors.surface} stroke={edge} strokeWidth={active ? 1.5 : 1}/>
      <Path d={`M1 ${Math.min(h / 2, 29)}V1H${Math.min(w / 4, 29)}M${w - Math.min(w / 4, 29)} ${h - 1}H${w - 1}V${h - Math.min(h / 2, 29)}`}
        stroke={accent} strokeWidth={2} fill="none"/>
    </Svg> : null}
  </View>;
}

export function ArenaFrame({ children, style, tone, pad = 16 }: {
  children?: ReactNode; style?: StyleProp<ViewStyle>; tone?: ArenaTone; pad?: number;
}) {
  return <View style={[{ position: "relative", padding: pad, gap: 12 }, style]}>
    <ArenaSurface tone={tone}/>{children}
  </View>;
}
