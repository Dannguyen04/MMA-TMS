import { Feather } from "@expo/vector-icons";
import { forwardRef, useEffect, useRef, useState, type Ref } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from "react-native";
import Reanimated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { authType, useAuthColors } from "@/components/auth/auth-vision-tokens";
import { vi } from "@/i18n/vi";

/** Focus / float transition. Short and eased; no bounce. */
export const FLOAT_DURATION = 150;
const LABEL_SCALE = 0.78;
const ICON_SIZE = 18;
const ICON_GAP = 12;

/** Field height 56 (12 label band + 44 input row); the whole field is the tap target. */
export function floatingFieldMetrics(compact: boolean) {
  const labelBand = 12;
  const row = 44;
  return { labelBand, row, height: labelBand + row };
}

export type AuthFloatingFieldProps = TextInputProps & {
  label: string;
  error?: string;
  secureToggle?: boolean;
  icon?: keyof typeof Feather.glyphMap | null;
  compact?: boolean;
  onFocusChange?: (focused: boolean) => void;
};

/** Underline input with a floating label for the dark auth screens. */
export const AuthFloatingField = forwardRef<TextInput, AuthFloatingFieldProps>(function AuthFloatingField(
  { label, error, secureToggle, icon, compact = false, onFocusChange, placeholder, secureTextEntry, onFocus, onBlur, style, value, defaultValue, ...props },
  ref,
) {
  const c = useAuthColors();
  const reduced = useReducedMotion();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const filled = Boolean(value ?? defaultValue);
  const floated = focused || filled;
  const hasError = Boolean(error);
  const { labelBand, row, height } = floatingFieldMetrics(compact);
  const lineHeight = authType.body.lineHeight;
  const restY = labelBand + (row - lineHeight) / 2;
  const leadOffset = icon ? ICON_SIZE + ICON_GAP : 0;

  const float = useSharedValue(floated ? 1 : 0);
  const focus = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    const config = { duration: reduced ? 0 : FLOAT_DURATION, easing: Easing.out(Easing.quad) };
    float.value = withTiming(floated ? 1 : 0, config);
    focus.value = withTiming(focused ? 1 : 0, config);
  }, [floated, focused, float, focus, reduced]);

  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: restY * (1 - float.value) },
      { scale: 1 - (1 - LABEL_SCALE) * float.value },
    ],
  }));
  const activeLineStyle = useAnimatedStyle(() => ({ opacity: focus.value }));

  const setRef = (node: TextInput | null) => {
    inputRef.current = node;
    assignRef(ref, node);
  };

  const labelColor = hasError ? c.danger : focused ? c.accent : c.muted;
  const restLine = hasError ? c.danger : "rgba(255,255,255,0.28)";

  return (
    <View style={styles.wrap}>
      <Pressable
        testID="auth-floating-field"
        accessible={false}
        onPress={() => inputRef.current?.focus()}
        style={[styles.frame, { minHeight: height }]}
      >
        <Reanimated.View pointerEvents="none" style={[styles.labelSlot, { left: leadOffset }, labelStyle]}>
          <Text
            accessible={false}
            importantForAccessibility="no"
            numberOfLines={1}
            style={[authType.body, { color: labelColor }]}
          >
            {label}
          </Text>
        </Reanimated.View>
        <View style={[styles.row, { marginTop: labelBand, minHeight: row }]}>
          {icon ? <Feather name={icon} size={ICON_SIZE} color={c.muted} style={styles.lead} /> : null}
          <TextInput
            ref={setRef}
            {...props}
            value={value}
            defaultValue={defaultValue}
            placeholder={focused && !filled ? placeholder : undefined}
            secureTextEntry={secureToggle ? hidden : secureTextEntry}
            placeholderTextColor="rgba(255,255,255,0.38)"
            selectionColor={c.accent}
            cursorColor={c.accent}
            autoCorrect={false}
            keyboardAppearance="dark"
            accessibilityLabel={label}
            accessibilityHint={error || undefined}
            onFocus={(event) => {
              setFocused(true);
              onFocusChange?.(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onFocusChange?.(false);
              onBlur?.(event);
            }}
            style={[authType.body, styles.input, { minHeight: row, color: c.ink }, webNoOutline, style]}
          />
          {secureToggle ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hidden ? vi.a11y.showPassword : vi.a11y.hidePassword}
              hitSlop={4}
              onPress={() => {
                setHidden((v) => !v);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              style={styles.eye}
            >
              <Feather name={hidden ? "eye" : "eye-off"} size={20} color={c.muted} />
            </Pressable>
          ) : null}
        </View>
        <View testID="auth-floating-line" style={[styles.line, { backgroundColor: restLine }]} />
        {hasError ? null : (
          <Reanimated.View
            testID="auth-floating-line-active"
            pointerEvents="none"
            style={[styles.lineActive, { backgroundColor: c.accent }, activeLineStyle]}
          />
        )}
      </Pressable>
      {hasError ? (
        <Text accessibilityRole="alert" style={[authType.caption, styles.error, { color: c.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const webNoOutline = (Platform.OS === "web" ? { outlineStyle: "none" } : null) as StyleProp<TextStyle>;

function assignRef(ref: Ref<TextInput> | undefined, node: TextInput | null) {
  if (typeof ref === "function") {
    ref(node);
    return;
  }
  if (ref) ref.current = node;
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 4 },
  frame: { width: "100%", justifyContent: "flex-start" },
  labelSlot: { position: "absolute", top: 0, right: 44, transformOrigin: "left top" },
  row: { flexDirection: "row", alignItems: "center" },
  lead: { width: ICON_SIZE, marginRight: ICON_GAP, opacity: 0.8 },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 0, paddingVertical: 0, margin: 0 },
  eye: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  line: { position: "absolute", left: 0, right: 0, bottom: 0, height: 1 },
  lineActive: { position: "absolute", left: 0, right: 0, bottom: 0, height: 2 },
  error: { paddingTop: 0 },
});