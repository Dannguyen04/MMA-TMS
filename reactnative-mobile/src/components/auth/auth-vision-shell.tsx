import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  createContext,
  forwardRef,
  use,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  ActivityIndicator,
  Animated,
  findNodeHandle,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Dimensions,
  useWindowDimensions,
  View,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Reanimated, {
  FadeIn,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthFloatingField, type AuthFloatingFieldProps } from "@/components/auth/auth-floating-field";
import { AUTH_HERO_RATIO } from "@/components/auth/auth-vision-scene";
import { authType, useAuthColors } from "@/components/auth/auth-vision-tokens";
import { palettes } from "@/theme/colors";
import { authInputProgress } from "@/components/auth/auth-vision-scene";
import { vi } from "@/i18n/vi";
import { motion, spacing } from "@/theme";
import { PressableScale } from "@/components/motion";

type ChromeValue = {
  setInputFocused: (next: boolean) => void;
  /** Keyboard up in input mode: the form must fit the top half, so fields shrink. */
  compact?: boolean;
};

const ChromeContext = createContext<ChromeValue | null>(null);

type AuthVisionShellProps = {
  children: ReactNode;
  /** Extra content at the end of the card (rare). */
  footer?: ReactNode;
  /** Primary button, inside the card. */
  action?: ReactNode;
  /** Secondary link (forgot password, resend). Centered above the button; beside it while typing. */
  link?: ReactNode;
  /** Under the card on the photo, e.g. "Chưa có tài khoản? Tạo tài khoản". Hidden while typing. */
  below?: ReactNode;
  accessory?: ReactNode;
  title?: string;
  subtitle?: string;
  /** Gap between blocks inside the card. */
  contentGap?: number;
  stepKey?: string;
  onBack?: () => void;
  backLabel?: string;
  backDisabled?: boolean;
  onWordmarkLongPress?: () => void;
};

/**
 * Real blur on iOS and web. Android's blur needs a BlurTargetView around the photo, which
 * lives in the (auth) layout, so Android keeps the plain tint (stronger, to stay legible).
 */
const HAS_BLUR = Platform.OS !== "android";
/** Page-colour tint over the photo while typing (over the blur where there is one). */
const INPUT_HAZE = HAS_BLUR ? ({ dark: 0.62, light: 0.6 } as const) : ({ dark: 0.86, light: 0.88 } as const);
const CARD_RADIUS = 24;
const EDGE = 16;
const TOP_BAR = 52;
/** Input-mode close button: well inside the screen corner. */
const EXIT_TOP = 52;
const EXIT_LEFT = 36;
const EXIT_SIZE = 48;
/** Gap kept between the last form element and the keyboard top. */
const KEYBOARD_CLEARANCE = 16;

/** Drop focus everywhere: native keyboard and the web's active element. */
function dismissInput() {
  Keyboard.dismiss();
  if (Platform.OS === "web" && typeof document !== "undefined") {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }
}

/**
 * Keyboard height. Native: Keyboard events. Web: the visual viewport shrinks when a
 * mobile browser shows its keyboard, so the gap below it is the keyboard.
 */
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS === "web") {
      const vv = typeof window !== "undefined" ? window.visualViewport : null;
      if (!vv) return;
      const sync = () => {
        const gap = window.innerHeight - vv.height - vv.offsetTop;
        setHeight(gap > 80 ? Math.round(gap) : 0);
      };
      vv.addEventListener("resize", sync);
      return () => vv.removeEventListener("resize", sync);
    }
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e: KeyboardEvent) => {
      // Some Android keyboards (Samsung with its suggestion toolbar) report a height that leaves out
      // the toolbar; the keyboard's top edge (screenY) is reliable, so take whichever covers more.
      const fromTop = Dimensions.get("screen").height - e.endCoordinates.screenY;
      setHeight(Math.round(Math.max(e.endCoordinates.height, fromTop > 0 ? fromTop : 0)));
    });
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * Auth stage: full-screen photo (from the layout), brand top-left, one floating card.
 * Focusing any input enters "input mode": the photo hazes over, the card chrome dissolves,
 * the form sits just above the keyboard (centered when the keyboard is hidden) and the link
 * and button share one row. Only the X button leaves input mode; values are kept.
 */
export function AuthVisionShell({
  children,
  footer,
  action,
  link,
  below,
  accessory,
  title,
  subtitle,
  contentGap = 12,
  stepKey = "static",
  onBack,
  backLabel = vi.register.back,
  backDisabled = false,
  onWordmarkLongPress,
}: AuthVisionShellProps) {
  const c = useAuthColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();
  const rawKeyboard = useKeyboardHeight();
  // Android adjustResize and mobile web already shrink the window by the keyboard; only lift the rest.
  const openHeight = useRef(windowHeight);
  if (windowHeight > openHeight.current) openHeight.current = windowHeight;
  const keyboard = Math.max(0, rawKeyboard - (openHeight.current - windowHeight));
  const keyboardShown = rawKeyboard > 0;
  const [inputMode, setInputMode] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const [belowHeight, setBelowHeight] = useState(0);
  const mode = useSharedValue(0);
  const top = useSharedValue(-1);

  const setInputFocused = useCallback((next: boolean) => {
    if (next) setInputMode(true);
  }, []);
  const exitInputMode = useCallback(() => {
    dismissInput();
    setInputMode(false);
  }, []);

  // Below the close button (insets.top + EXIT_TOP + EXIT_SIZE) with a small gap.
  const minTop = insets.top + EXIT_TOP + EXIT_SIZE + 8;
  const compact = inputMode && keyboardShown;
  // Web (visualViewport) and Android adjustResize shrink the window while the keyboard is up, so the
  // half-screen line comes from the tallest height seen, not the current one.
  const tallest = useRef(0);
  if (windowHeight > tallest.current) tallest.current = windowHeight;
  const fullHeight = tallest.current;
  const formBottom = Math.min(fullHeight - keyboard - KEYBOARD_CLEARANCE, windowHeight - KEYBOARD_CLEARANCE, Math.floor(fullHeight * 0.5));
  // Very short space (small phone + tall keyboard): drop the title so the fields and button fit.
  const tight = compact && formBottom - minTop < 250;
  let target: number;
  if (!inputMode) target = windowHeight - insets.bottom - EDGE - (below ? belowHeight + 12 : 0) - cardHeight;
  // Keyboard up: the whole form (fields + link/button row) stays in the top half of the screen,
  // whatever keyboard height the platform reports.
  else if (keyboardShown) target = formBottom - cardHeight;
  else target = (windowHeight - cardHeight) / 2;
  target = Math.max(minTop, Math.round(target));
  const cardMax = Math.max(200, (compact ? formBottom : windowHeight) - minTop - (compact ? 0 : insets.bottom + EDGE + (below && !inputMode ? belowHeight + 12 : 0)));

  const timing = { duration: reduced ? 0 : 250, easing: Easing.out(Easing.cubic) };
  useEffect(() => {
    mode.value = withTiming(inputMode ? 1 : 0, timing);
    authInputProgress.value = withTiming(inputMode ? 1 : 0, timing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode, reduced]);
  useEffect(() => {
    if (cardHeight === 0) return;
    // First placement jumps; later moves animate.
    top.value = top.value < 0 ? target : withTiming(target, timing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, cardHeight, reduced]);

  const hazeMax = c.dark ? INPUT_HAZE.dark : INPUT_HAZE.light;
  // Only wrapper opacity animates; blur intensity stays fixed (cheap per frame).
  const hazeStyle = useAnimatedStyle(() => ({ opacity: mode.value }));
  const idleStyle = useAnimatedStyle(() => ({ opacity: 1 - mode.value }));
  const exitStyle = useAnimatedStyle(() => ({ opacity: mode.value }));
  const cardStyle = useAnimatedStyle(() => ({ top: Math.max(top.value, 0), opacity: top.value < 0 ? 0 : 1 }));

  return (
    <ChromeContext.Provider value={{ setInputFocused, compact }}>
      <View style={styles.safe}>
        <Reanimated.View pointerEvents="none" testID="auth-haze" style={[StyleSheet.absoluteFill, hazeStyle]}>
          {HAS_BLUR ? <BlurView intensity={28} tint={c.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.canvas, opacity: hazeMax }]} />
        </Reanimated.View>
        <View style={[styles.topBar, { paddingTop: insets.top }]}>
          {inputMode ? (
            <Reanimated.View style={[styles.exitSlot, { top: insets.top + EXIT_TOP }, exitStyle]}>
              <Pressable
                testID="auth-exit-input"
                accessibilityRole="button"
                accessibilityLabel={vi.common.closeInput}
                onPress={exitInputMode}
                hitSlop={8}
                style={styles.exit}
              >
                <Feather name="x" size={24} color="#FFFFFF" />
              </Pressable>
            </Reanimated.View>
          ) : onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              accessibilityState={{ disabled: backDisabled }}
              disabled={backDisabled}
              onPress={onBack}
              hitSlop={8}
              style={styles.back}
            >
              {/* The back link sits on the photo, so it uses the on-photo ink in both schemes. */}
              <MaterialCommunityIcons name="chevron-left" size={22} color={onPhoto.ink} />
              <Text style={[authType.link, { color: onPhoto.ink }]}>{backLabel}</Text>
            </Pressable>
          ) : null}
        </View>
        <Reanimated.View
          pointerEvents={inputMode ? "none" : "auto"}
          style={[styles.brand, { top: insets.top + TOP_BAR }, idleStyle]}
        >
          <AuthVisionBrand onLongPress={onWordmarkLongPress} />
        </Reanimated.View>

        <Reanimated.View testID="auth-card" style={[styles.card, cardStyle]} onLayout={(e) => setCardHeight(Math.round(e.nativeEvent.layout.height))}>
          <ScrollView
            style={{ maxHeight: cardMax }}
            contentContainerStyle={[styles.cardBody, compact && styles.cardBodyCompact, { gap: compact ? 6 : contentGap }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <AuthVisionStep stepKey={stepKey}>
              <View style={[styles.block, { gap: compact ? 6 : contentGap }]}>
                {title && !tight ? (
                  <Text style={[authType.title, { color: c.ink }, compact && styles.titleCompact]} accessibilityRole="header">
                    {title}
                  </Text>
                ) : null}
                {subtitle && !compact ? <Text style={[authType.lead, { color: c.muted }]}>{subtitle}</Text> : null}
                {accessory}
                <View style={[styles.fields, compact && styles.fieldsCompact]}>{children}</View>
                {inputMode ? (
                  <Reanimated.View
                    key="row"
                    entering={reduced ? undefined : FadeIn.duration(250)}
                    style={styles.actionRow}
                    testID="auth-action-row"
                  >
                    {link ? <View style={styles.rowLink}>{link}</View> : null}
                    <View style={link ? styles.rowButton : styles.rowFull}>{action}</View>
                  </Reanimated.View>
                ) : (
                  <Reanimated.View key="stack" entering={reduced ? undefined : FadeIn.duration(250)} style={styles.actionStack}>
                    {link ? <View style={styles.stackLink}>{link}</View> : null}
                    {action}
                  </Reanimated.View>
                )}
                {footer && !compact ? <View style={styles.footer}>{footer}</View> : null}
              </View>
            </AuthVisionStep>
          </ScrollView>
        </Reanimated.View>

        {below ? (
          <Reanimated.View
            pointerEvents={inputMode ? "none" : "box-none"}
            onLayout={(e) => setBelowHeight(Math.round(e.nativeEvent.layout.height))}
            style={[styles.below, { bottom: insets.bottom + EDGE }, idleStyle]}
          >
            {below}
          </Reanimated.View>
        ) : null}
      </View>
    </ChromeContext.Provider>
  );
}

function AuthVisionBrand({ onLongPress }: { onLongPress?: () => void }) {
  const c = useAuthColors();
  const mark = (
    <View style={styles.brandRow}>
      <View style={[styles.brandBar, { backgroundColor: c.accent }]} />
      <View style={styles.brandCopy}>
        <Text style={[authType.wordmark, styles.brandName, { color: onPhoto.ink }]}>{vi.brand.wordmark}</Text>
        <Text style={[authType.caption, { color: onPhoto.muted }]}>{vi.brand.academy}</Text>
      </View>
    </View>
  );

  if (!onLongPress) {
    return (
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${vi.brand.wordmark}. ${vi.brand.academy}`}
      >
        {mark}
      </View>
    );
  }

  return (
    <Pressable
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${vi.brand.wordmark}. ${vi.brand.academy}`}
      accessibilityHint={vi.login.demoMenu}
      delayLongPress={480}
      onLongPress={onLongPress}
      testID="auth-demo-trigger"
    >
      {mark}
    </Pressable>
  );
}

function AuthVisionStep({ stepKey, children }: { stepKey: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const seen = useRef(stepKey);

  useEffect(() => {
    if (seen.current === stepKey) return;
    seen.current = stepKey;
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: motion.base,
      useNativeDriver: true,
    }).start();
  }, [opacity, reduced, stepKey]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

type AuthVisionFieldProps = AuthFloatingFieldProps & {
  /** Feather icon at the start; defaults to lock for passwords and mail for email. */
  icon?: keyof typeof Feather.glyphMap;
  /** Kept for callers; the floating label is always shown now. */
  showLabel?: boolean;
  /** Kept for callers; the floating label is always shown now. */
  hideLabel?: boolean;
};

/** Underline field with a floating label; tells the shell when input mode starts. */
export const AuthVisionField = forwardRef<TextInput, AuthVisionFieldProps>(function AuthVisionField(
  { icon, showLabel: _showLabel, hideLabel: _hideLabel, secureToggle, secureTextEntry, ...props },
  ref,
) {
  const chrome = use(ChromeContext);
  const lead = icon ?? (secureToggle || secureTextEntry ? "lock" : props.keyboardType === "email-address" ? "mail" : null);
  return (
    <AuthFloatingField
      ref={ref}
      {...props}
      icon={lead}
      secureToggle={secureToggle}
      secureTextEntry={secureTextEntry}
      compact={Boolean(chrome?.compact)}
      onFocusChange={(next) => {
        if (next) chrome?.setInputFocused(true);
      }}
    />
  );
});

type AuthVisionButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function AuthVisionButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  testID,
  style,
}: AuthVisionButtonProps) {
  const c = useAuthColors();
  const inactive = disabled || loading;
  const filled = !disabled || loading;
  const [pressed, setPressed] = useState(false);

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={styles.button}
    >
      {/* Fill lives on a View. NativeWind spreads Pressable style callbacks into {} and drops backgroundColor. */}
      <View
        pointerEvents="none"
        style={[
          styles.buttonFace,
          { backgroundColor: filled ? c.buttonOn : c.buttonOff },
          pressed && !inactive ? styles.buttonPressed : null,
          style,
        ]}
      >
        <Text
          style={[
            authType.cta,
            styles.buttonLabel,
            { color: filled ? c.buttonOnText : c.buttonOffText, opacity: loading ? 0 : 1 },
          ]}
        >
          {title}
        </Text>
        {loading ? (
          <ActivityIndicator
            color={c.buttonOnText}
            style={styles.spinner}
          />
        ) : null}
      </View>
    </PressableScale>
  );
}

type AuthCodeFieldProps = {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string;
  editable?: boolean;
  /** Boxes shown; longer pasted codes add boxes up to `maxLength`. */
  length?: number;
  maxLength?: number;
  onSubmitEditing?: () => void;
  testID?: string;
};

/** One hidden input under N boxes, so paste and SMS/email autofill keep working. */
export function AuthCodeField({
  label,
  value,
  onChangeText,
  error,
  editable = true,
  length = 6,
  maxLength = 10,
  onSubmitEditing,
  testID,
}: AuthCodeFieldProps) {
  const c = useAuthColors();
  const chrome = use(ChromeContext);
  const [focused, setFocused] = useState(false);
  const count = Math.min(Math.max(length, value.length), maxLength);
  const active = Math.min(value.length, count - 1);

  return (
    <View style={styles.field}>
      <Text style={[authType.label, { color: c.ink }]}>{label}</Text>
      <View style={styles.codeRow}>
        {Array.from({ length: count }, (_, index) => {
          const isActive = focused && index === active;
          return (
            <View
              key={index}
              style={[
                styles.codeBox,
                fieldSurface(c, Boolean(error), isActive),
              ]}
            >
              <Text style={[authType.title, { color: c.ink }]}>{value[index] ?? ""}</Text>
            </View>
          );
        })}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={(next) => onChangeText(next.replace(/[^\d]/g, "").slice(0, maxLength))}
          editable={editable}
          maxLength={maxLength}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          importantForAutofill="yes"
          keyboardAppearance={c.dark ? "dark" : "light"}
          caretHidden
          accessibilityLabel={label}
          accessibilityHint={error || undefined}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => {
            setFocused(true);
            chrome?.setInputFocused(true);
          }}
          onBlur={() => setFocused(false)}
          style={styles.codeInput}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[authType.caption, { color: c.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** The box border is the focus ring; drop the browser outline on web. */
const webNoOutline = (Platform.OS === "web" ? { outlineStyle: "none" } : null) as StyleProp<TextStyle>;

/** The brand sits on the photo band, which stays dark in both schemes. */
const onPhoto = { ink: palettes.dark.ink, muted: palettes.dark.inkMuted };

/** Filled field surface: tonal fill, no outline; error swaps to a soft red fill. */
function fieldSurface(c: ReturnType<typeof useAuthColors>, error: boolean, focused = false): ViewStyle {
  // Focus: 1px solid accent border; the border is always reserved (transparent) so focus never shifts layout.
  return {
    backgroundColor: error ? c.fieldError : c.field,
    borderWidth: 1,
    borderColor: focused && !error ? c.accent : "transparent",
  };
}

function assignRef(ref: Ref<TextInput> | undefined, node: TextInput | null) {
  if (typeof ref === "function") {
    ref(node);
    return;
  }
  if (ref) ref.current = node;
}

const styles = StyleSheet.create({
  brand: {
    position: "absolute",
    left: 24,
    right: 24,
  },
  /** Close button floats inside the screen: below the safe area, in line with the form inset. */
  exitSlot: {
    position: "absolute",
    left: EXIT_LEFT,
    zIndex: 2,
  },
  exit: {
    backgroundColor: "rgba(0,0,0,0.45)",
    width: EXIT_SIZE,
    height: EXIT_SIZE,
    borderRadius: EXIT_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    position: "absolute",
    left: EDGE,
    right: EDGE,
  },
  cardBody: {
    padding: 20,
  },
  cardBodyCompact: {
    paddingVertical: 8,
  },
  titleCompact: {
    fontSize: 20,
    lineHeight: 26,
  },
  fieldsCompact: {
    gap: 4,
  },
  actionStack: {
    gap: 8,
  },
  stackLink: {
    alignItems: "center",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowLink: {
    flex: 1,
    alignItems: "flex-start",
  },
  rowFull: {
    flex: 1,
  },
  rowButton: {
    flex: 1.2,
  },
  below: {
    position: "absolute",
    left: 24,
    right: 24,
    alignItems: "center",
  },
  safe: {
    flex: 1,
    width: "100%",
    backgroundColor: "transparent",
  },
  topBar: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
  },
  back: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
  },
  scrollView: {
    flex: 1,
    width: "100%",
    backgroundColor: "transparent",
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 0,
    flexGrow: 1,
  },
  heroBand: {
    justifyContent: "flex-start",
  },
  block: {
    gap: 12,
    width: "100%",
  },
  fields: {
    gap: 12,
    width: "100%",
  },
  footer: {
    alignItems: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  brandBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  brandCopy: {
    gap: 2,
  },
  brandName: {
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  field: {
    gap: spacing.sm,
    width: "100%",
  },
  rule: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },
  box: {
    minHeight: 54,
    borderRadius: 14,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  eye: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
  },
  actionBar: {
    width: "100%",
    paddingHorizontal: 24,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  button: {
    minHeight: 52,
    borderRadius: 12,
  },
  buttonFace: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonLabel: {
    textAlign: "center",
  },
  codeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  codeBox: {
    flex: 1,
    height: 56,
    maxWidth: 56,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  codeInput: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.011,
    color: "transparent",
  },
  spinner: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});
