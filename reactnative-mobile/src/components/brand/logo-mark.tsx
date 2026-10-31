import { StyleSheet, View } from "react-native";
import Svg, { Path, Polygon } from "react-native-svg";

import { useThemePreference } from "@/theme";
import { vi } from "@/i18n/vi";

export const LOGO_VIEWBOX = 56;
export const LOGO_OCTAGON_OUTER = "16,6 40,6 50,16 50,40 40,50 16,50 6,40 6,16";
export const LOGO_OCTAGON_MID = "18,10 38,10 46,18 46,38 38,46 18,46 10,38 10,18";
export const LOGO_OCTAGON_INNER = "20,13 36,13 43,20 43,36 36,43 20,43 13,36 13,20";
export const LOGO_LOTUS_PATH =
  "M28 18 C26 22 24 26 28 32 C32 26 30 22 28 18 Z M28 20 C22 18 16 22 18 28 C22 26 26 24 28 20 Z M28 20 C34 18 40 22 38 28 C34 26 30 24 28 20 Z M20 30 C16 34 18 40 24 38 C24 34 24 30 20 30 Z M36 30 C40 34 38 40 32 38 C32 34 32 30 36 30 Z M28 30 C26 34 24 40 28 44 C32 40 30 34 28 30 Z";

type LogoMarkProps = {
  size?: number;
};

export function LogoMark({ size = 56 }: LogoMarkProps) {
  const { colors } = useThemePreference();

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={vi.a11y.logo}
      style={[styles.wrap, { width: size, height: size }]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}>
        <Polygon points={LOGO_OCTAGON_OUTER} fill={colors.cage} />
        <Polygon points={LOGO_OCTAGON_MID} fill={colors.lotus} />
        <Polygon points={LOGO_OCTAGON_INNER} fill={colors.cage} />
        <Path d={LOGO_LOTUS_PATH} fill={colors.bg} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
