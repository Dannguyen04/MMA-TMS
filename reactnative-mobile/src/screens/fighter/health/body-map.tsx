import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { jointLabel } from "@/components/medical/medical-format";
import { fighterHealth as t } from "@/i18n/fighter-health";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";
import type { BodyMarks } from "./health-model";

/** Mark colours, the same on the 3D model, this flat figure and the legend (the 3D shader needs fixed colours). */
export const MARK_COLOR = { hurt: "#FF6B7A", avoid: "#FF9A4D" } as const;

/**
 * Mirror view, like the 3D model (owner 2026-11-19): the fighter's right is on the viewer's right. One point per
 * joint the server knows (BODY_JOINTS).
 */
export const JOINT_POINTS: Record<string, readonly [number, number]> = {
  LEFT_SHOULDER: [44, 54], RIGHT_SHOULDER: [88, 54],
  LEFT_ELBOW: [34, 90], RIGHT_ELBOW: [98, 90],
  LEFT_WRIST: [28, 122], RIGHT_WRIST: [104, 122],
  SPINE_CORE: [66, 104],
  LEFT_HIP: [54, 130], RIGHT_HIP: [78, 130],
  LEFT_KNEE: [52, 172], RIGHT_KNEE: [80, 172],
  LEFT_ANKLE: [52, 208], RIGHT_ANKLE: [80, 208],
};
const BODY = "M44 46h44l8 10 8 34 4 34-10 2-8-30h-4l4 44-6 60-14 4-4-58h-2l-4 58-14-4-6-60 4-44h-4l-8 30-10-2 4-34 8-34z";

export const bodyA11y = (m: BodyMarks) => [
  t.map.a11y,
  m.hurt.length ? `${t.map.hurt}: ${m.hurt.map(jointLabel).join(", ")}` : t.map.none,
  m.avoid.length ? `${t.map.avoid}: ${m.avoid.map(jointLabel).join(", ")}` : null,
  m.head ? t.map.head : null,
].filter(Boolean).join(". ");

/** The figure: injured joints filled red, joints to avoid ringed, a ring round the head after a KO / TKO. */
export function BodyFigure({ marks }: { marks: BodyMarks }) {
  const { colors: c } = useThemePreference();
  return <View testID="body-figure" accessible accessibilityRole="image" accessibilityLabel={bodyA11y(marks)} style={{ width: 132, height: 220 }}>
    <Svg width={132} height={220} viewBox="0 0 132 220">
      <Circle cx={66} cy={22} r={15} fill={c.surfaceMuted} stroke={c.controlBorder} strokeWidth={1.2}/>
      {marks.head ? <Circle cx={66} cy={22} r={19.5} fill="none" stroke={MARK_COLOR.hurt} strokeWidth={2}/> : null}
      <Path d={BODY} fill={c.surfaceMuted} stroke={c.controlBorder} strokeWidth={1.2} strokeLinejoin="round"/>
      {Object.entries(JOINT_POINTS).map(([joint, [x, y]]) => {
        const hurt = marks.hurt.includes(joint);
        const avoid = !hurt && marks.avoid.includes(joint);
        return <Circle key={joint} cx={x} cy={y} r={hurt ? 6.5 : 4.5} fill={hurt ? MARK_COLOR.hurt : avoid ? "none" : c.bg}
          stroke={hurt ? MARK_COLOR.hurt : avoid ? MARK_COLOR.avoid : c.controlBorder} strokeWidth={avoid ? 2.4 : 1.4}/>;
      })}
    </Svg>
  </View>;
}

/** Legend rows naming what the figure marks, one line each. */
export function BodyLegend({ marks }: { marks: BodyMarks }) {
  const { colors: c } = useThemePreference();
  const line = (key: string, dot: object, text: string) => <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
    <View style={{ width: 10, height: 10, borderRadius: 5, ...dot }}/>
    <Text numberOfLines={1} style={{ ...readableTextStyle(13), color: c.ink, flexShrink: 1 }}>{text}</Text>
  </View>;
  const rows = [
    ...marks.hurt.map(j => line(`h-${j}`, { backgroundColor: MARK_COLOR.hurt }, jointLabel(j))),
    ...marks.avoid.map(j => line(`a-${j}`, { borderWidth: 2, borderColor: MARK_COLOR.avoid }, `${t.map.avoid}: ${jointLabel(j).toLocaleLowerCase("vi")}`)),
    ...(marks.head ? [line("head", { borderWidth: 2, borderColor: MARK_COLOR.hurt }, t.map.head)] : []),
  ];
  if (!rows.length) return null;
  return <View testID="body-legend" aria-hidden={true} importantForAccessibility="no-hide-descendants" style={{ gap: 4 }}>{rows}</View>;
}
