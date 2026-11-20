/**
 * Focused writing (owner 2026-11-16): tapping a note field opens it on its own over the page, so the coach writes
 * without the page's pinned tabs, cards and buttons crowding the few lines left above the keyboard, and without
 * scrolling to find the field. Only the field's label, the text, its count and "Xong" show. The text is the
 * field's own value: every keystroke goes straight to the page, so closing never loses or needs to save anything.
 */
import { useContext, useEffect, useRef } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { useThemePreference } from "@/theme/index";
import { readableTextStyle } from "@/theme/typography";

export type FocusEditorProps = Pick<TextInputProps, "value" | "onChangeText" | "placeholder" | "maxLength" | "autoCapitalize" | "keyboardType" | "inputMode"> & {
  visible: boolean;
  label: string;
  helper?: string;
  error?: string;
  onClose: () => void;
};

export function FocusEditor({ visible, label, helper, error, onClose, value, ...input }: FocusEditorProps) {
  const { colors: c } = useThemePreference();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const ref = useRef<TextInput>(null);
  // The keyboard already covers the navigation bar: its inset under the footer would leave a blank strip.
  const keyboardUp = useKeyboardState(s => s.isVisible);

  // Focus once the modal is on screen (autoFocus inside a Modal is unreliable on Android).
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => ref.current?.focus(), Platform.OS === "android" ? 120 : 0);
    return () => clearTimeout(id);
  }, [visible]);

  if (!visible) return null;
  return (
    // Transparent window over a full-screen layer in the theme background (light or dark): the modal window's own default background used to
    // flash white in the strip the frame gives up just before the keyboard draws (owner 2026-11-16).
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: keyboardUp && Platform.OS === "android" ? 0 : insets.bottom }]}
      >
        <View style={[styles.head, { borderBottomColor: c.line }]}>
          <Text accessibilityRole="header" numberOfLines={2} style={{ ...readableTextStyle(16, true), color: c.ink, flex: 1 }}>{label}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Xong" onPress={onClose} hitSlop={8} style={({ pressed }) => [styles.done, { opacity: pressed ? 0.7 : 1 }]}>
            <Text style={{ ...readableTextStyle(16, true), color: c.lotus }}>Xong</Text>
          </Pressable>
        </View>
        <TextInput
          ref={ref}
          {...input}
          value={value}
          multiline
          accessibilityLabel={label}
          placeholderTextColor={c.inkSubtle}
          selectionColor={c.ring}
          textAlignVertical="top"
          style={[styles.input, { ...readableTextStyle(18), color: c.ink }]}
        />
        {error || helper ? (
          <Text style={[styles.foot, { ...readableTextStyle(13), color: error ? c.danger : c.inkMuted, borderTopColor: c.line }]}>{error ?? helper}</Text>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 20, borderBottomWidth: 1 },
  done: { minHeight: 48, minWidth: 56, alignItems: "flex-end", justifyContent: "center" },
  input: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  foot: { paddingHorizontal: 20, paddingVertical: 10, borderTopWidth: 1 },
});
