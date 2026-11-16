/**
 * Keyboard handling for every screen (react-native-keyboard-controller).
 *
 * The app draws edge to edge, so on Android `adjustResize` no longer shrinks
 * the window when the keyboard opens: fields and the save button ended up under
 * it. The provider in the root layout reports the real keyboard frame, and the
 * page shells use these two pieces:
 *
 * - `KeyboardFrame` shrinks the shell to end at the keyboard, so its pinned
 *   footer (e.g. "Lưu thay đổi") sits on the keyboard, on Android as on iOS.
 * - `KeyboardScroll` is the shell's scroll view: once the frame has shrunk, it
 *   scrolls the focused field into the part that is still visible.
 *
 * The scroll view adds no space of its own for the keyboard: the frame already
 * made room. (The library's KeyboardAwareScrollView adds the keyboard height
 * again under the content, which left a blank keyboard-sized gap at the end of
 * every page while the keyboard was up.)
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";
import { KeyboardAvoidingView, KeyboardProvider, useFocusedInputHandler } from "react-native-keyboard-controller";
import { runOnJS } from "react-native-reanimated";

/** Space kept between the focused field and the edge of what is visible. */
export const KEYBOARD_GAP = 24;

/** Root of the app: the app draws under the status and navigation bars. */
export function KeyboardRoot({ children }: { children: ReactNode }) {
  return (
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
      {children}
    </KeyboardProvider>
  );
}

export function KeyboardFrame(props: ComponentProps<typeof KeyboardAvoidingView>) {
  return <KeyboardAvoidingView behavior="padding" {...props} />;
}

export type KeyboardScrollProps = ScrollViewProps;
export type KeyboardScrollRef = ScrollView;

/** Scroll offset that shows a field (relative to the content) inside a viewport, or null when it already shows. */
export function revealOffset(field: { y: number; height: number }, offset: number, viewport: number, gap = KEYBOARD_GAP): number | null {
  const top = field.y - gap;
  const bottom = field.y + field.height + gap;
  if (top < offset) return Math.max(0, top);
  if (bottom > offset + viewport) {
    // A field taller than the viewport keeps its top in view.
    return Math.max(0, Math.min(bottom - viewport, top));
  }
  return null;
}

const styles = StyleSheet.create({ grow: { flexGrow: 1 } });

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

export const KeyboardScroll = forwardRef<KeyboardScrollRef, KeyboardScrollProps>(function KeyboardScroll(
  { children, onScroll, onLayout, scrollEventThrottle, contentContainerStyle, ...props },
  ref,
) {
  const scrollRef = useRef<ScrollView | null>(null);
  const contentRef = useRef<View>(null);
  const offset = useRef(0);
  const viewport = useRef(0);
  const keyboardUp = useRef(false);

  const reveal = useCallback(() => {
    if (Platform.OS === "web") return;
    const field = TextInput.State.currentlyFocusedInput?.();
    const content = contentRef.current;
    if (!field || !content || viewport.current <= 0) return;
    try {
      field.measureLayout(
        content,
        (_x, y, _w, height) => {
          const next = revealOffset({ y, height }, offset.current, viewport.current);
          if (next != null) scrollRef.current?.scrollTo({ y: next, animated: true });
        },
        () => undefined,
      );
    } catch {
      // The focused field is not in this scroll view.
    }
  }, []);

  // Keyboard opened: the frame shrinks over the next frames, and onLayout reveals again once it has.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => {
      keyboardUp.current = true;
      requestAnimationFrame(reveal);
    });
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      keyboardUp.current = false;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [reveal]);

  // Another field focused (or the caret moved to a new line) while the keyboard stays up.
  const revealSoon = useCallback(() => {
    if (keyboardUp.current) requestAnimationFrame(reveal);
  }, [reveal]);
  useFocusedInputHandler(
    {
      onSelectionChange: () => {
        "worklet";
        runOnJS(revealSoon)();
      },
    },
    [revealSoon],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = e.nativeEvent.contentOffset.y;
      onScroll?.(e);
    },
    [onScroll],
  );

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const next = e.nativeEvent.layout.height;
      const shrank = next < viewport.current;
      viewport.current = next;
      if (shrank && keyboardUp.current) reveal();
      onLayout?.(e);
    },
    [onLayout, reveal],
  );

  return (
    <ScrollView
      ref={(node) => {
        scrollRef.current = node;
        setRef(ref, node);
      }}
      keyboardShouldPersistTaps="handled"
      {...props}
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle ?? 16}
      onLayout={handleLayout}
      contentContainerStyle={styles.grow}
    >
      {/* The caller's content style goes on the measured view, so its gap and padding still apply. */}
      <View ref={contentRef} collapsable={false} style={contentContainerStyle}>
        {children}
      </View>
    </ScrollView>
  );
});
