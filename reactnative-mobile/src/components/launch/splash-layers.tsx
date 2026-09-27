import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from "react-native-svg";

import { splash } from "@/theme/splash";

type ArenaSvgProps = {
  width: number;
  height: number;
};

export function AtmosphereBackdrop({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <RadialGradient id="cyanGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={splash.cyan} stopOpacity="0.16" />
          <Stop offset="100%" stopColor={splash.canvas} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="crimsonGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={splash.crimson} stopOpacity="0.14" />
          <Stop offset="100%" stopColor={splash.canvas} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {Array.from({ length: 17 }, (_, i) => {
        const y = 72 + i * 42;
        return (
          <Line
            key={`h-${i}`}
            x1={28}
            y1={y}
            x2={362}
            y2={y}
            stroke={splash.cyan}
            strokeOpacity={0.04}
            strokeWidth={1}
          />
        );
      })}
      {Array.from({ length: 9 }, (_, i) => {
        const x = 28 + i * 42;
        return (
          <Line
            key={`v-${i}`}
            x1={x}
            y1={72}
            x2={x}
            y2={780}
            stroke={splash.cyan}
            strokeOpacity={0.035}
            strokeWidth={1}
          />
        );
      })}
      <Circle cx={195} cy={275} r={125} fill="url(#cyanGlow)" />
      <Circle cx={120} cy={600} r={100} fill="url(#crimsonGlow)" />
      <Line x1={28} y1={72} x2={362} y2={72} stroke={splash.cyan} strokeOpacity={0.28} strokeWidth={1} />
      <Line x1={28} y1={64} x2={28} y2={80} stroke={splash.cyan} strokeOpacity={0.45} strokeWidth={1.2} />
      <Line x1={362} y1={64} x2={362} y2={80} stroke={splash.cyan} strokeOpacity={0.45} strokeWidth={1.2} />
      <Line x1={28} y1={780} x2={362} y2={780} stroke={splash.crimson} strokeOpacity={0.28} strokeWidth={1} />
      <Line x1={28} y1={772} x2={28} y2={788} stroke={splash.crimson} strokeOpacity={0.45} strokeWidth={1.2} />
      <Line x1={362} y1={772} x2={362} y2={788} stroke={splash.crimson} strokeOpacity={0.45} strokeWidth={1.2} />
      <Circle cx={348} cy={360} r={4} fill={splash.crimson} opacity={0.7} />
    </Svg>
  );
}

export function PunchTrails({ width, height }: ArenaSvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 334 520">
      <Path
        d="M40 390C90 250 160 170 250 155"
        stroke={splash.cyan}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M52 410C110 270 170 190 262 172"
        stroke={splash.cyan}
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
        opacity={0.45}
      />
    </Svg>
  );
}

export function KickTrails({ width, height }: ArenaSvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 334 520">
      <Path
        d="M70 460C95 250 165 140 250 155"
        stroke={splash.crimson}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M250 155C290 175 305 250 292 330"
        stroke={splash.crimson}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        opacity={0.5}
      />
    </Svg>
  );
}

export function PunchReticle({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Path
        d="M28 44C36.8366 44 44 36.8366 44 28C44 19.1634 36.8366 12 28 12C19.1634 12 12 19.1634 12 28C12 36.8366 19.1634 44 28 44Z"
        stroke={splash.cyan}
        strokeWidth={1.5}
        fill="none"
      />
      <Path
        d="M28 8V16M28 40V48M8 28H16M40 28H48"
        stroke={splash.cyan}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function TrackingRing({
  size,
  color,
  dashed = false,
  strokeWidth = 1.5,
}: {
  size: number;
  color: string;
  dashed?: boolean;
  strokeWidth?: number;
}) {
  const r = size / 2 - strokeWidth;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={dashed ? "6 10" : undefined}
      />
    </Svg>
  );
}

export function StrikeFist({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx={14} cy={14} r={12} stroke={splash.cyan} strokeWidth={2} fill="none" />
      <Circle cx={14} cy={14} r={5.5} fill={splash.cyan} opacity={0.9} />
    </Svg>
  );
}

export function FigmaCrescent({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle
        cx={14}
        cy={14}
        r={11}
        stroke={splash.cyan}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        strokeDasharray="48 21"
      />
    </Svg>
  );
}
