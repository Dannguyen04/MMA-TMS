import { Slot, useNavigation, useSegments } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Platform, StatusBar as RNStatusBar, StyleSheet, useWindowDimensions, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { AuthVisionScene } from "@/components/auth/auth-vision-scene";
import { authCanvasSize, isVisionAuthLeaf, useAuthColors, visionAuthCanvas } from "@/components/auth/auth-vision-tokens";
import { AuthSessionGate } from "@/session/role-gate";
import { chromeLightIcons, motion, useThemePreference } from "@/theme";

export default function AuthLayout() {
  const { colors, resolvedScheme } = useThemePreference();
  const auth = useAuthColors();
  const reducedMotion = useReducedMotion();
  const segments = useSegments();
  const leaf = segments[segments.length - 1];
  const vision = isVisionAuthLeaf(leaf);
  const barStyle = (vision ? auth.dark : resolvedScheme === "dark") ? "light" : "dark";
  const stageColor = vision ? visionAuthCanvas(leaf, colors.bg, auth.dark ? "dark" : "light") : colors.bg;
  const navigation = useNavigation();
  const savedBg = useRef(colors.bg);
  const chromeToken = useRef(0);
  savedBg.current = colors.bg;

  useEffect(() => {
    const token = ++chromeToken.current;
    const parent = navigation.getParent();
    const restoreSavedChrome = () => {
      const bg = savedBg.current;
      const themedLight = chromeLightIcons(bg);
      parent?.setOptions({
        contentStyle: { backgroundColor: bg },
        statusBarStyle: themedLight ? "light" : "dark",
        statusBarBackgroundColor: bg,
        navigationBarColor: bg,
      });
      StatusBar.setStyle(themedLight ? "light" : "dark", false);
      void SystemUI.setBackgroundColorAsync(bg);
      if (Platform.OS !== "android") return;
      RNStatusBar.setBarStyle(themedLight ? "light-content" : "dark-content", false);
      RNStatusBar.setBackgroundColor(bg, false);
      NavigationBar.setStyle(themedLight ? "dark" : "light");
    };
    if (vision) {
      parent?.setOptions({
        contentStyle: { backgroundColor: auth.canvas },
        statusBarStyle: auth.dark ? "light" : "dark",
        statusBarBackgroundColor: auth.canvas,
        navigationBarColor: auth.canvas,
      });
      StatusBar.setStyle(auth.dark ? "light" : "dark", true);
      void SystemUI.setBackgroundColorAsync(auth.canvas);
      if (Platform.OS === "android") {
        RNStatusBar.setBarStyle(auth.dark ? "light-content" : "dark-content", true);
        RNStatusBar.setBackgroundColor(auth.canvas, false);
        NavigationBar.setStyle(auth.dark ? "dark" : "light");
      }
    } else {
      restoreSavedChrome();
    }
    return () => {
      queueMicrotask(() => {
        if (chromeToken.current !== token) return;
        restoreSavedChrome();
      });
    };
  }, [auth.canvas, auth.dark, colors.bg, navigation, vision]);

  const window = useWindowDimensions();
  const fullHeight = useRef(window.height);
  if (window.height > fullHeight.current) fullHeight.current = window.height;
  const canvas = authCanvasSize(window.width, fullHeight.current);
  const visible = authCanvasSize(window.width, window.height);

  return (
    <AuthSessionGate>
      <View style={[styles.page, { minHeight: canvas.height, backgroundColor: stageColor }]}>
        <View style={[styles.column, { width: canvas.width, height: canvas.height }]}>
          {vision ? <AuthVisionScene /> : null}
          <StatusBar style={barStyle} />
          <View style={{ width: "100%", height: visible.height }}>
            <AuthForeground routeKey={String(leaf)} reducedMotion={reducedMotion}>
              <Slot />
            </AuthForeground>
          </View>
        </View>
      </View>
    </AuthSessionGate>
  );
}

function AuthForeground({
  routeKey,
  reducedMotion,
  children,
}: {
  routeKey: string;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const seen = useRef(routeKey);

  useEffect(() => {
    if (seen.current === routeKey) return;
    seen.current = routeKey;
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: motion.base,
      useNativeDriver: true,
    }).start();
  }, [opacity, reducedMotion, routeKey]);

  return (
    <Animated.View pointerEvents="box-none" style={{ flex: 1, width: "100%", opacity, backgroundColor: "transparent" }}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  column: {
    flexGrow: 1,
    maxWidth: "100%",
    overflow: "hidden",
    position: "relative",
  },
});
