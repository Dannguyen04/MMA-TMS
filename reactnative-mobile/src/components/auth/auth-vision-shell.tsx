import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  createContext,
  forwardRef,
  use,
  useCallback,
  useEffect,
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
  useWindowDimensions,
  View,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { authDark, authType } from "@/components/auth/auth-vision-tokens";
import { vi } from "@/i18n/vi";
import { motion, spacing } from "@/theme";

type ChromeValue = {
  setInputFocused: (next: boolean) => void;
};

const ChromeContext = createContext<ChromeValue | null>(null);

type AuthVisionShellProps = {
  children: ReactNode;
  footer?: ReactNode;
  accessory?: ReactNode;
  title?: string;
  subtitle?: string;
  /** Gap between the brand and the form block. Login and forgot use 24; email and code use 20. */
  contentGap?: number;
  stepKey?: string;
  onBack?: () => void;
  backLabel?: string;
  backDisabled?: boolean;
  onWordmarkLongPress?: () => void;
};

const FOCUS_EXTRA = 168;

type Measurable = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

export function AuthVisionShell({
  children,
  footer,
  accessory,
  title,
  subtitle,
  contentGap = 24,
  stepKey = "static",
  onBack,
  backLabel = vi.register.back,
  backDisabled = false,
  onWordmarkLongPress,
}: AuthVisionShellProps) {
  const insets = useSafeAreaInsets();
  const windowHeight = useWindowDimensions().height;
  const openHeight = useRef(windowHeight);
  if (windowHeight > openHeight.current) openHeight.current = windowHeight;
  const scrollRef = useRef<ScrollView>(null);
  const contentOffsetY = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);

  const runScrollIntoView = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    if (Platform.OS === "web") {
      if (typeof document === "undefined") return;
      const active = document.activeElement;
      if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return;
      active.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const input = TextInput.State.currentlyFocusedInput();
    if (!input) return;
    const handle = findNodeHandle(input as never);
    if (!handle) return;
    const responder = (
      scroll as unknown as {
        scrollResponderScrollNativeHandleToKeyboard?: (
          node: number,
          extraHeight: number,
          preventNegativeScrollOffset?: boolean,
        ) => void;
      }
    ).scrollResponderScrollNativeHandleToKeyboard;
    if (typeof responder === "function") {
      responder.call(scroll, handle, FOCUS_EXTRA, true);
      return;
    }
    const focused = input as unknown as Measurable;
    const scroller = scroll as unknown as Measurable;
    focused.measureInWindow((_x, y, _w, h) => {
      scroller.measureInWindow((_sx, sy, _sw, sh) => {
        const overflow = y + h - (sy + sh) + FOCUS_EXTRA;
        if (overflow > 0) {
          scroll.scrollTo({ y: contentOffsetY.current + overflow, animated: true });
        }
      });
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
      requestAnimationFrame(() => {
        setTimeout(runScrollIntoView, 48);
      });
    };
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [runScrollIntoView]);

  useEffect(() => {
    if (!inputFocused) return;
    requestAnimationFrame(() => setTimeout(runScrollIntoView, 16));
  }, [inputFocused, keyboardHeight, runScrollIntoView]);

  const resized = Math.max(0, openHeight.current - windowHeight);
  const lift = Math.max(0, keyboardHeight - resized);

  return (
    <ChromeContext.Provider value={{ setInputFocused }}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.topBar}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              accessibilityState={{ disabled: backDisabled }}
              disabled={backDisabled}
              onPress={onBack}
              hitSlop={8}
              style={styles.back}
            >
              <MaterialCommunityIcons name="chevron-left" size={22} color={authDark.ink} />
              <Text style={[authType.link, { color: authDark.ink }]}>{backLabel}</Text>
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
        </View>
          <ScrollView
          ref={scrollRef}
          testID="auth-scroll"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          contentInsetAdjustmentBehavior="never"
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 48 + lift, gap: contentGap },
          ]}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            contentOffsetY.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          <AuthVisionBrand onLongPress={onWordmarkLongPress} />
          <AuthVisionStep stepKey={stepKey}>
            <View style={styles.block}>
              {title ? (
                <Text style={[authType.title, { color: authDark.ink }]} accessibilityRole="header">
                  {title}
                </Text>
              ) : null}
              {subtitle ? <Text style={[authType.lead, styles.subtitle]}>{subtitle}</Text> : null}
              {accessory}
              <View style={styles.fields}>{children}</View>
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </View>
          </AuthVisionStep>
        </ScrollView>
      </SafeAreaView>
    </ChromeContext.Provider>
  );
}

function AuthVisionBrand({ onLongPress }: { onLongPress?: () => void }) {
  const mark = (
    <View style={styles.brandRow}>
      <View style={styles.brandBar} />
      <View style={styles.brandCopy}>
        <Text style={[authType.wordmark, styles.brandName]}>{vi.brand.wordmark}</Text>
        <Text style={[authType.caption, { color: authDark.muted }]}>{vi.brand.academy}</Text>
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

type AuthVisionFieldProps = TextInputProps & {
  label: string;
  error?: string;
  secureToggle?: boolean;
};

export const AuthVisionField = forwardRef<TextInput, AuthVisionFieldProps>(function AuthVisionField(
  {
    label,
    error,
    secureToggle,
    secureTextEntry,
    onFocus,
    onBlur,
    style,
    ...props
  },
  ref,
) {
  const chrome = use(ChromeContext);
  const inputRef = useRef<TextInput>(null);
  const focused = useRef(false);
  const keepFocus = useRef(false);
  const [isFocused, setIsFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const setRef = (node: TextInput | null) => {
    inputRef.current = node;
    assignRef(ref, node);
  };

  return (
    <View style={styles.field}>
      <View
        style={[
          styles.box,
          { backgroundColor: isFocused ? authDark.fieldFillFocus : authDark.fieldFill },
        ]}
      >
        <TextInput
          ref={setRef}
          {...props}
          placeholder={label}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          placeholderTextColor={authDark.muted}
          selectionColor={authDark.gold}
          autoCorrect={false}
          keyboardAppearance="dark"
          accessibilityLabel={label}
          accessibilityHint={error || undefined}
          onFocus={(event) => {
            focused.current = true;
            setIsFocused(true);
            chrome?.setInputFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            focused.current = false;
            setIsFocused(false);
            chrome?.setInputFocused(false);
            onBlur?.(event);
          }}
          style={[authType.body, styles.input, style]}
        />
        {secureToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? vi.a11y.showPassword : vi.a11y.hidePassword}
            hitSlop={8}
            onPressIn={() => {
              keepFocus.current = focused.current;
            }}
            onPress={() => {
              setHidden((current) => !current);
              if (!keepFocus.current) return;
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            style={styles.eye}
          >
            <MaterialCommunityIcons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={22}
              color={authDark.muted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[authType.caption, styles.error]}>
          {error}
        </Text>
      ) : null}
    </View>
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
  const inactive = disabled || loading;
  const filled = !disabled || loading;
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
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
          { backgroundColor: filled ? authDark.gold : authDark.buttonOff },
          pressed && !inactive ? styles.buttonPressed : null,
          style,
        ]}
      >
        <Text
          style={[
            authType.cta,
            styles.buttonLabel,
            { color: filled ? authDark.buttonOnText : authDark.buttonOffText, opacity: loading ? 0 : 1 },
          ]}
        >
          {title}
        </Text>
        {loading ? (
          <ActivityIndicator
            color={authDark.buttonOnText}
            style={styles.spinner}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function assignRef(ref: Ref<TextInput> | undefined, node: TextInput | null) {
  if (typeof ref === "function") {
    ref(node);
    return;
  }
  if (ref) ref.current = node;
}

const styles = StyleSheet.create({
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
    paddingTop: 28,
    flexGrow: 1,
  },
  block: {
    gap: 20,
    width: "100%",
  },
  subtitle: {
    color: authDark.muted,
  },
  fields: {
    gap: 20,
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
    backgroundColor: authDark.gold,
  },
  brandCopy: {
    gap: 2,
  },
  brandName: {
    color: authDark.ink,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  field: {
    gap: spacing.sm,
    width: "100%",
  },
  box: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 56,
    color: authDark.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  eye: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
  },
  error: {
    color: authDark.danger,
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
  spinner: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});
