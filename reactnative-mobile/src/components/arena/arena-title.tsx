import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fonts, useThemePreference, useTypography } from "@/theme";

/** One semantic title. SVG marks stay decorative; title text scales and wraps. */
export function ArenaTitle({ children, compact = false }: { children: string; compact?: boolean }) {
  const { colors } = useThemePreference();
  const live = useTypography();
  const size = (compact ? 25 : 32) * live.sizeFactor;
  return <View style={{ flex: 1, minWidth: 0, flexDirection: "row", gap: 10, alignItems: "center" }}>
    <Svg width={9} height={32} viewBox="0 0 9 32" aria-hidden={true}><Path d="M5 0H9L4 32H0Z" fill={colors.lotus}/></Svg>
    <Text accessibilityRole="header" style={{ flex: 1, color: colors.ink, fontFamily: fonts.display,
      fontSize: size, lineHeight: Math.ceil(size * Math.max(1.2, live.lineHeight)),
      letterSpacing: live.letterSpacingEm * size }}>{children.toUpperCase()}</Text>
  </View>;
}
