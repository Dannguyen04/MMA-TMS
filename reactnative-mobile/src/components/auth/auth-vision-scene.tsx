import { useRef, useState, type ReactNode } from "react";
import { Image, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Reanimated, { makeMutable, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { AUTH_CANVAS_MAX_WIDTH, useAuthColors } from "@/components/auth/auth-vision-tokens";

/** Empty octagon still: spotlights and cage on top, light mat at the bottom. Not a fighter and not a video. */
const arena = require("../../../assets/auth/empty-arena.jpg") as number;
const ARENA_ASPECT = 16 / 9;
/** Phone build of the same still (1080x1920): whole octagon in the upper middle, ceiling and mat extended. */
const arenaPortrait = require("../../../assets/auth/arena-portrait.jpg") as number;
const PORTRAIT_ASPECT = 1080 / 1920;
/** Columns narrower than this (phones) use the portrait still; tablets and web keep the landscape cover. */
const PORTRAIT_MAX_WIDTH = 600;
/** Where the cover crop sits vertically when the band is wider than the photo: 0 = top, 1 = bottom. Keeps the lights in view. */
const CROP_ANCHOR_Y = 0.3;

/**
 * 0 idle -> 1 input mode, driven by the auth shell. The photo slides up while typing so the
 * ceiling lights stay visible above the raised form.
 */
export const authInputProgress = makeMutable(0);
/** How far the photo slides up in input mode, as a share of its frame height. */
const INPUT_LIFT = 0.18;

/** Share of the column the photo occupies: the whole screen, the form floats on it. */
export const AUTH_HERO_RATIO = 1;

/**
 * Photo band at the top of the auth column, fading into the page color so the
 * brand stays readable and the form sits on a plain surface. Height only grows,
 * so a keyboard shrink never re-crops the still.
 */
export function AuthVisionScene() {
  const c = useAuthColors();
  const tallest = useRef(0);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    if (next.width <= 0 || next.height <= 0) return;
    if (next.height > tallest.current) tallest.current = next.height;
    setFrame({ width: next.width, height: tallest.current });
  };

  const width = frame?.width ?? 0;
  const lift = (frame?.height ?? 0) * INPUT_LIFT;
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift * authInputProgress.value }] }));
  const hero = Math.round((frame?.height ?? 0) * AUTH_HERO_RATIO);
  // Manual cover: scale to fill, center horizontally, bias the vertical crop toward the top.
  const portrait = width < PORTRAIT_MAX_WIDTH;
  const aspect = portrait ? PORTRAIT_ASPECT : ARENA_ASPECT;
  // Cover a frame taller by the lift so sliding up never uncovers the bottom edge.
  const coverH = hero + lift;
  const imgH = Math.max(coverH, width / aspect);
  const imgW = imgH * aspect;
  const imgLeft = (width - imgW) / 2;
  // The portrait still already places the cage; crop it evenly.
  const imgTop = -(imgH - coverH) * (portrait ? 0.5 : CROP_ANCHOR_Y);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      collapsable={false}
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor: c.canvas }]}
    >
      {width > 0 && hero > 0 ? (
        <View testID="auth-hero" style={{ position: "absolute", left: 0, top: 0, width, height: hero, overflow: "hidden" }}>
          <Reanimated.View style={[StyleSheet.absoluteFill, liftStyle]}>
          <Image
            accessible={false}
            fadeDuration={0}
            resizeMode="stretch"
            source={portrait ? arenaPortrait : arena}
            style={{ position: "absolute", left: imgLeft, top: imgTop, width: imgW, height: imgH }}
          />
          </Reanimated.View>
        </View>
      ) : null}
      {width > 0 && hero > 0 ? (
        <>
          {/*
            The fade is opaque for its last 15% and runs SEAM_OVERLAP px past the photo, so neither
            subpixel image edges nor gradient interpolation on the final row can leave a light line.
          */}
          <Svg pointerEvents="none" width={width} height={hero + SEAM_OVERLAP} style={styles.fade}>
            <Defs>
              <LinearGradient id="authHeroFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.canvas} stopOpacity={0} />
                {/* No card behind the form: the lower half deepens toward the page colour so text on the mat stays legible. */}
                <Stop offset="0.4" stopColor={c.canvas} stopOpacity={0} />
                <Stop offset="0.62" stopColor={c.canvas} stopOpacity={c.dark ? 0.6 : 0.55} />
                <Stop offset="1" stopColor={c.canvas} stopOpacity={c.dark ? 0.94 : 0.92} />
              </LinearGradient>
              <LinearGradient id="authHeroScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity={0.35} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width={width} height={hero * 0.25} fill="url(#authHeroScrim)" />
            <Rect width={width} height={hero + SEAM_OVERLAP} fill="url(#authHeroFade)" />
          </Svg>
        </>
      ) : null}
    </View>
  );
}

/** Extra px the solid end of the fade covers below the photo. */
const SEAM_OVERLAP = 4;

/** Same stage as the (auth) group, for auth screens routed outside it (reset link). */
export function AuthStandaloneStage({ children }: { children: ReactNode }) {
  const c = useAuthColors();
  return (
    <View style={[styles.page, { backgroundColor: c.canvas }]}>
      <View style={styles.column}>
        <AuthVisionScene />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: AUTH_CANVAS_MAX_WIDTH,
    overflow: "hidden",
  },
  fade: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  clip: {
    overflow: "hidden",
  },
});
