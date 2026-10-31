import { memo } from "react";
import { StyleSheet } from "react-native";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";

import {
  containRect,
  jointAngle,
  LIMB_CHAIN,
  limbOf,
  SKELETON_EDGES,
  visible,
  type PoseFrame,
  type ResultStrike,
} from "@/components/video/pose-model";
import { ev } from "@/i18n/video-evidence";

export type OverlayLayers = { skeleton: boolean; angle: boolean; label: boolean };

type Props = {
  frame: PoseFrame | null;
  strike: ResultStrike | null;
  width: number;
  height: number;
  sourceWidth: number | null;
  sourceHeight: number | null;
  layers: OverlayLayers;
  boneColor: string;
  activeColor: string;
  labelInk: string;
};

export function strikeName(strike: ResultStrike): string {
  const base = ev.technique[strike.technique] ?? ev.technique[strike.family] ?? ev.technique.other!;
  const side = ev.side[strike.side];
  return side ? `${base} ${side}` : base;
}

/** Pose drawn over a `contain`-fitted video. Re-renders only when the frame index or layers change. */
export const PoseOverlay = memo(function PoseOverlay({
  frame,
  strike,
  width,
  height,
  sourceWidth,
  sourceHeight,
  layers,
  boneColor,
  activeColor,
  labelInk,
}: Props) {
  if (width <= 0 || height <= 0) return null;
  const rect = containRect(width, height, sourceWidth, sourceHeight);
  const kps = layers.skeleton && frame ? frame.keypoints : [];
  const px = (x: number) => rect.x + x * rect.width;
  const py = (y: number) => rect.y + y * rect.height;
  const limb = strike ? limbOf(strike) : null;
  const chain = limb ? LIMB_CHAIN[limb] : null;
  const active = new Set<number>(chain ?? []);
  const isActiveEdge = (a: number, b: number) => active.has(a) && active.has(b);

  let angle: { x: number; y: number; deg: number } | null = null;
  if (layers.angle && chain && kps.length > 0) {
    const [r, j, e] = chain.map((i) => kps[i]);
    if (visible(r) && visible(j) && visible(e)) {
      angle = { x: px(j.x), y: py(j.y), deg: Math.round(jointAngle(r, j, e, rect.width / rect.height)) };
    }
  }
  const head = kps[0];

  return (
    <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill} testID="pose-overlay">
      {kps.length > 0 ? (
        <G>
          {SKELETON_EDGES.map(([a, b]) => {
            const p = kps[a];
            const q = kps[b];
            if (!visible(p) || !visible(q)) return null;
            const on = isActiveEdge(a, b);
            return (
              <Line
                key={`${a}-${b}`}
                x1={px(p.x)}
                y1={py(p.y)}
                x2={px(q.x)}
                y2={py(q.y)}
                stroke={on ? activeColor : boneColor}
                strokeWidth={on ? 4 : 2.5}
                strokeLinecap="round"
                strokeOpacity={on ? 1 : 0.85}
              />
            );
          })}
          {kps.map((p, i) =>
            i >= 5 && visible(p) ? (
              <Circle key={i} cx={px(p.x)} cy={py(p.y)} r={active.has(i) ? 4 : 3} fill={active.has(i) ? activeColor : boneColor} />
            ) : null,
          )}
          {visible(head) ? (
            <Circle cx={px(head.x)} cy={py(head.y)} r={Math.max(8, rect.width * 0.03)} stroke={boneColor} strokeWidth={2} fill="none" />
          ) : null}
        </G>
      ) : null}
      {angle ? (
        <SvgText x={angle.x + 10} y={angle.y - 8} fill={activeColor} fontSize={13} fontWeight="700">
          {`${angle.deg}°`}
        </SvgText>
      ) : null}
      {layers.label && strike ? (
        <G>
          <Rect x={rect.x + 8} y={rect.y + 8} rx={6} width={strikeName(strike).length * 7.4 + 16} height={24} fill={activeColor} />
          <SvgText x={rect.x + 16} y={rect.y + 24} fill={labelInk} fontSize={12} fontWeight="700">
            {strikeName(strike)}
          </SvgText>
        </G>
      ) : null}
    </Svg>
  );
});
