import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { motion, spacing, type, useThemePreference, viLineHeight } from "@/theme";

const LABEL_REST = 16;
const LABEL_FLOAT = 13;
const FLOAT_SCALE = LABEL_FLOAT / LABEL_REST;
const REST_SHIFT = 18;

type AuthUnderlineFieldProps = {
  label: string;
  error?: string;
  helper?: string;
  helperPersistent?: boolean;
  focused: boolean;
  filled: boolean;
  accessory?: ReactNode;
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityRole?: "button";
  testID?: string;
};

export function AuthUnderlineField({
  label,
  error,
  helper,
  helperPersistent,
  focused,
  filled,
  accessory,
  children,
  onPress,
  accessibilityLabel,
  accessibilityRole,
  testID = "auth-field-frame",
}: AuthUnderlineFieldProps) {
  const { colors } = useThemePreference();
  const reducedMotion = useReducedMotion();
  const hasError = Boolean(error);
  const floated = focused || filled;
  const showHelper = Boolean(helper) && !hasError && (focused || helperPersistent);
  const invalidState = { invalid: hasError } as AccessibilityState;
  const progress = useRef(new Animated.Value(floated ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: floated ? 1 : 0,
      duration: reducedMotion ? 0 : motion.enter,
      useNativeDriver: true,
    }).start();
  }, [floated, progress, reducedMotion]);

  const labelColor = hasError ? colors.danger : focused ? colors.lotus : colors.inkMuted;
  const underlineColor = hasError ? colors.danger : focused ? colors.lotus : colors.line;
  const underlineHeight = focused || hasError ? 2 : StyleSheet.hairlineWidth;

  const labelMotion = {
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [REST_SHIFT, 0],
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, FLOAT_SCALE],
        }),
      },
    ],
  };

  const body = (
    <>
      <View style={styles.column} pointerEvents={onPress ? "box-none" : "auto"}>
        <Animated.Text
          pointerEvents="none"
          numberOfLines={1}
          style={[
            styles.label,
            {
              color: labelColor,
              fontFamily: type.body.fontFamily,
              fontSize: LABEL_REST,
              lineHeight: viLineHeight(LABEL_REST),
            },
            labelMotion,
          ]}
        >
          {label}
        </Animated.Text>
        <View style={styles.row}>
          <View style={styles.control}>{children}</View>
          {accessory}
        </View>
      </View>
      <View
        testID="auth-field-underline"
        style={[styles.underline, { backgroundColor: underlineColor, height: underlineHeight }]}
      />
    </>
  );

  const frameStyle: StyleProp<ViewStyle> = styles.frame;

  return (
    <View style={styles.wrap} accessibilityState={invalidState}>
      {onPress ? (
        <Pressable
          testID={testID}
          accessibilityRole={accessibilityRole ?? "button"}
          accessibilityLabel={accessibilityLabel}
          accessibilityState={invalidState}
          onPress={onPress}
          style={frameStyle}
        >
          {body}
        </Pressable>
      ) : (
        <View testID={testID} style={frameStyle}>
          {body}
        </View>
      )}
      {hasError ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[type.caption, styles.helper, { color: colors.danger }]}
        >
          {error}
        </Text>
      ) : showHelper ? (
        <Text style={[type.caption, styles.helper, { color: colors.inkSubtle }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    minWidth: 0,
    overflow: "visible",
    gap: spacing.xs,
  },
  frame: {
    width: "100%",
    minWidth: 0,
    overflow: "visible",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
  },
  column: {
    minHeight: 52,
    justifyContent: "flex-end",
    overflow: "visible",
  },
  label: {
    position: "absolute",
    left: 0,
    top: 0,
    transformOrigin: "left top",
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: REST_SHIFT,
    overflow: "visible",
  },
  control: {
    flex: 1,
    minWidth: 0,
    overflow: "visible",
  },
  underline: {
    width: "100%",
    borderRadius: 0,
  },
  helper: {
    overflow: "visible",
  },
});
