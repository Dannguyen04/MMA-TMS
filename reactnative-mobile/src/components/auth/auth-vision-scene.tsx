import { useRef, useState } from "react";
import { Image, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { authDark } from "@/components/auth/auth-vision-tokens";

/** Empty ring still from the dark Figma frames. Not a fighter and not a video. */
const arena = require("../../../assets/auth/empty-arena.jpg") as number;

type Frame = { width: number; height: number };

/**
 * Fills the auth column. Height only grows, so a keyboard shrink clips the
 * bottom instead of re-cropping the still.
 * Figma places the source at left -16 / top -24 inside a 402×874 frame (434×922).
 */
export function AuthVisionScene() {
  const tallest = useRef(0);
  const [visible, setVisible] = useState<Frame | null>(null);
  const [paintHeight, setPaintHeight] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    if (next.width <= 0 || next.height <= 0) return;
    if (next.height > tallest.current) tallest.current = next.height;
    setVisible({ width: next.width, height: next.height });
    setPaintHeight(tallest.current);
  };

  const width = visible?.width ?? 0;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      collapsable={false}
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor: authDark.canvas }]}
    >
      {width > 0 && paintHeight > 0 ? (
        <Image
          accessible={false}
          fadeDuration={0}
          resizeMode="cover"
          source={arena}
          style={{
            position: "absolute",
            width: width * (434 / 402),
            height: paintHeight * (922 / 874),
            left: -width * (16 / 402),
            top: -paintHeight * (24 / 874),
          }}
        />
      ) : null}
      {width > 0 && visible ? (
        <Svg pointerEvents="none" width={width} height={visible.height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="authArenaScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0E0F13" stopOpacity={0.55} />
              <Stop offset="0.38" stopColor="#0E0F13" stopOpacity={0.8} />
              <Stop offset="1" stopColor="#0E0F13" stopOpacity={0.96} />
            </LinearGradient>
          </Defs>
          <Rect width={width} height={visible.height} fill="url(#authArenaScrim)" />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
  },
});
