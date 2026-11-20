import { View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";

export type CampIconName = "alert" | "check" | "arrow" | "plus" | "minus" | "back";
/** Authored stroke icons (react-native-svg), one 2px stroke family. Always decorative: the adjacent text carries the meaning. */
export function CampIcon({ name, color, size = 20 }: { name: CampIconName; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden={true}>
      {name === "alert" ? <><Path d="M12 3L22 20H2Z" {...p}/><Line x1={12} y1={10} x2={12} y2={14} {...p}/><Line x1={12} y1={17} x2={12} y2={17.01} {...p}/></> : null}
      {name === "check" ? <Path d="M4 12.5L9.5 18L20 6" {...p}/> : null}
      {name === "arrow" ? <><Line x1={6} y1={18} x2={18} y2={6} {...p}/><Path d="M9 6H18V15" {...p}/></> : null}
      {name === "plus" ? <><Line x1={5} y1={12} x2={19} y2={12} {...p}/><Line x1={12} y1={5} x2={12} y2={19} {...p}/></> : null}
      {name === "minus" ? <Line x1={5} y1={12} x2={19} y2={12} {...p}/> : null}
      {name === "back" ? <Path d="M15 5L8 12L15 19" {...p} strokeWidth={2.5}/> : null}
    </Svg>
  </View>;
}