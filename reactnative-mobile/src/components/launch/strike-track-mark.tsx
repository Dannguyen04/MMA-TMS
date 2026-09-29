import Svg, { Circle, Path } from "react-native-svg";

import { splash } from "@/theme/splash";

type StrikeTrackMarkProps = {
  size?: number;
};

export function StrikeTrackMark({ size = 168 }: StrikeTrackMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 168 168">
      <Path
        d="M26 110 L94 64"
        stroke={splash.cyan}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={26} cy={110} r={6} fill={splash.cyan} />
      <Circle cx={100} cy={56} r={23} stroke={splash.cyan} strokeWidth={4} fill="none" />
      <Path d="M100 24 V36" stroke={splash.text} strokeWidth={3.2} strokeLinecap="round" />
      <Path d="M100 76 V88" stroke={splash.text} strokeWidth={3.2} strokeLinecap="round" />
      <Path d="M68 56 H80" stroke={splash.text} strokeWidth={3.2} strokeLinecap="round" />
      <Path d="M120 56 H132" stroke={splash.text} strokeWidth={3.2} strokeLinecap="round" />
      <Path
        d="M40 132 Q96 10 152 116"
        stroke={splash.crimson}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={40} cy={132} r={6} fill={splash.crimson} />
      <Circle cx={152} cy={116} r={6} fill={splash.crimson} />
      <Circle cx={100} cy={56} r={6} fill={splash.cyan} />
    </Svg>
  );
}
