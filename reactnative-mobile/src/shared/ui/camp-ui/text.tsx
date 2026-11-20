import { type ReactNode } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { fonts, useThemePreference, useTypography } from "@/theme/index";
import { readableTextStyle, fz, lh } from "@/theme/typography";

export function Copy({ children, muted, strong, color, large, small, strike }: { children: ReactNode; muted?: boolean; strong?: boolean; color?: string; large?: boolean; small?: boolean; strike?: boolean }) {
  const { colors: c } = useThemePreference();
  return <Text style={{ ...readableTextStyle(large ? 18 : small ? 13 : 14, strong), color: color ?? (muted ? c.inkMuted : c.ink), flexShrink: 1, textDecorationLine: strike ? "line-through" : "none" }}>{children}</Text>;
}
/** In-app reading size times the OS text size, so SVG text follows Dynamic Type / font scale like native Text does. */
export function useSvgTextScale() {
  const live = useTypography(); const { fontScale } = useWindowDimensions();
  return Math.min(2.4, live.sizeFactor * (fontScale || 1));
}
export function SvgTitle({ children, small = false }: { children: string; small?: boolean }) {
  const { colors: c } = useThemePreference();
  const live = useTypography(); const scale = useSvgTextScale();
  const words = children.toUpperCase().split(" ");
  const lines = [""];
  for (const w of words) {
    if ((lines[lines.length - 1] + w).length > Math.max(8, Math.floor((small ? 29 : 23) / scale))) lines.push(w);
    else lines[lines.length - 1] += `${lines[lines.length - 1] ? " " : ""}${w}`;
  }
  const size = (small ? 26 : 39) * scale;
  const step = Math.ceil(size * Math.max(1.2, live.lineHeight));
  const h = lines.length * step + 16;
  return <View accessible accessibilityRole="header" accessibilityLabel={children} style={{ alignSelf: "stretch" }}>
    <Svg width="100%" height={h} viewBox={`0 0 350 ${h}`} preserveAspectRatio="xMinYMid meet" aria-hidden={true}>
      <Path d={`M0 ${h - 8}L8 9H12L4 ${h - 8}Z`} fill={c.lotus} />
      {lines.map((line, i) => <SvgText key={i} x={22} y={step * (i + 1)} fill={c.ink} fontFamily={fonts.display} fontSize={size} letterSpacing={size * live.letterSpacingEm}>{line}</SvgText>)}
    </Svg>
  </View>;
}
/**
 * A section heading inside a screen. DESIGN.md: the screen names itself once, in the CampShell header bar; sections
 * below it use this plain condensed heading (no red slash).
 */
export function SectionTitle({ children }: { children: string }) {
  const { colors: c } = useThemePreference();
  return <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(22), lineHeight: lh(30), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{children}</Text>;
}
/** Owner 2026-11-11: inside a notice, every sentence sits on its own line. */
export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=\S)/).map(x => x.trim()).filter(Boolean);
}