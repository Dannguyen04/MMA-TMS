import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  findNodeHandle,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { spacing, type, useThemePreference } from "@/theme";

type AuthChromeValue = {
  keyboardVisible: boolean;
  inputFocused: boolean;
  setInputFocused: (next: boolean) => void;
};

const AuthChromeContext = createContext<AuthChromeValue | null>(null);

export function useAuthChrome() {
  return use(AuthChromeContext);
}

export function useAuthInputFocus() {
  const chrome = useAuthChrome();
  return {
    onFocus: () => chrome?.setInputFocused(true),
    onBlur: () => chrome?.setInputFocused(false),
  };
}

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  chrome?: ReactNode;
  footer?: ReactNode;
  banner?: ReactNode;
  cta: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  backDisabled?: boolean;
  hideFooterWhenKeyboard?: boolean;
  onChromeChange?: (next: { keyboardVisible: boolean; inputFocused: boolean }) => void;
  onWordmarkLongPress?: () => void;
};

const FOCUS_SCROLL_EXTRA = 24;

export function nextContentOffsetY(contentOffsetY: number, overflow: number) {
  if (overflow <= 0) return contentOffsetY;
  return contentOffsetY + overflow;
}

function scrollToFocusedInput(
  scroll: ScrollView | null,
  extraHeight: number,
  contentOffsetY: number,
) {
  if (Platform.OS === "web") {
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return;
    active.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  const input = TextInput.State.currentlyFocusedInput();
  if (!input || !scroll) return;
  const handle = findNodeHandle(input);
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
    responder.call(scroll, handle, extraHeight, true);
    return;
  }
  input.measureInWindow((_x, y, _w, h) => {
    scroll.measureInWindow((_sx, sy, _sw, sh) => {
      const overflow = y + h - (sy + sh) + FOCUS_SCROLL_EXTRA;
      const nextY = nextContentOffsetY(contentOffsetY, overflow);
      if (nextY !== contentOffsetY) {
        scroll.scrollTo({ y: nextY, animated: true });
      }
    });
  });
}

export function AuthShell({
  title,
  subtitle,
  children,
  chrome,
  footer,
  banner,
  cta,
  onBack,
  backLabel,
  backDisabled = false,
  hideFooterWhenKeyboard = false,
  onChromeChange,
  onWordmarkLongPress,
}: AuthShellProps) {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const contentOffsetY = useRef(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [dockHeight, setDockHeight] = useState(96);
  const chromeRef = useRef(onChromeChange);
  chromeRef.current = onChromeChange;

  const reportChrome = useCallback((nextKeyboard: boolean, nextFocus: boolean) => {
    chromeRef.current?.({ keyboardVisible: nextKeyboard, inputFocused: nextFocus });
  }, []);

  const setFocused = useCallback(
    (next: boolean) => {
      setInputFocused(next);
      reportChrome(keyboardVisible, next);
    },
    [keyboardVisible, reportChrome],
  );

  const runScrollIntoView = useCallback(() => {
    scrollToFocusedInput(scrollRef.current, dockHeight + FOCUS_SCROLL_EXTRA, contentOffsetY.current);
  }, [dockHeight]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (event: KeyboardEvent) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates.height);
      reportChrome(true, inputFocused);
      requestAnimationFrame(() => {
        setTimeout(runScrollIntoView, 48);
      });
    };
    const onHide = () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      reportChrome(false, inputFocused);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [inputFocused, reportChrome, runScrollIntoView]);

  useEffect(() => {
    if (keyboardVisible || inputFocused) {
      requestAnimationFrame(() => setTimeout(runScrollIntoView, 16));
    }
  }, [dockHeight, keyboardVisible, inputFocused, runScrollIntoView]);

  const chromeValue: AuthChromeValue = {
    keyboardVisible,
    inputFocused,
    setInputFocused: setFocused,
  };

  const imeOpen = keyboardVisible || keyboardHeight > 0;
  const iosDockLift = Platform.OS === "ios" && keyboardHeight > 0 ? keyboardHeight : 0;
  const dockBottomPad = iosDockLift > 0 ? iosDockLift : insets.bottom + spacing.md;

  return (
    <AuthChromeContext.Provider value={chromeValue}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
        <View style={styles.topBar}>
          <View style={styles.topLeading}>
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
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={24}
                  color={backDisabled ? colors.disabledInk : colors.lotus}
                />
                {backLabel ? (
                  <Text
                    style={[
                      type.link,
                      { color: backDisabled ? colors.disabledInk : colors.lotus },
                    ]}
                  >
                    {backLabel}
                  </Text>
                ) : null}
              </Pressable>
            ) : null}
            {imeOpen ? <BrandWordmark compact onLongPress={onWordmarkLongPress} /> : null}
          </View>
        </View>
        {chrome ? <View style={styles.chrome}>{chrome}</View> : null}
        <View style={styles.flex}>
          <ScrollView
            ref={scrollRef}
            testID="auth-scroll"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            contentContainerStyle={[
              styles.scroll,
              imeOpen ? { paddingBottom: dockHeight } : null,
            ]}
            onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
              contentOffsetY.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            onContentSizeChange={() => {
              if (keyboardVisible || inputFocused) runScrollIntoView();
            }}
          >
            {imeOpen ? null : <BrandWordmark onLongPress={onWordmarkLongPress} />}
            <Text style={[type.title, { color: colors.ink }]}>{title}</Text>
            {subtitle && !keyboardVisible ? (
              <Text style={[type.body, { color: colors.inkMuted }]}>{subtitle}</Text>
            ) : null}
            <View style={styles.fields}>{children}</View>
          </ScrollView>
        </View>
        <View
          testID="auth-dock"
          style={[styles.dock, { paddingBottom: dockBottomPad }]}
          onLayout={(event) => {
            const next = event.nativeEvent.layout.height;
            setDockHeight(next);
            if (keyboardVisible || inputFocused) {
              requestAnimationFrame(() => {
                setTimeout(runScrollIntoView, 16);
              });
            }
          }}
        >
          {banner}
          {cta}
          {footer && !(hideFooterWhenKeyboard && keyboardVisible) ? footer : null}
        </View>
      </SafeAreaView>
    </AuthChromeContext.Provider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    overflow: "hidden",
  },
  flex: {
    flex: 1,
    overflow: "hidden",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    minHeight: 44,
    gap: spacing.sm,
  },
  topLeading: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  back: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  chrome: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.sm,
  },
  scroll: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  fields: {
    gap: spacing.fieldGap,
    width: "100%",
  },
  dock: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    overflow: "hidden",
  },
});
