import { useEffect, useRef } from "react";
import { Keyboard, Platform, ScrollView, TextInput, View } from "react-native";

import { spacing } from "@/theme/spacing";

/**
 * For a sheet drawn in an RN Modal (its own window, outside the keyboard
 * provider): the sheet shrinks to sit on the keyboard, but its scroll view
 * stays where it was, so the field could end up at the bottom edge with what
 * follows it (the send button) cut off. Once the keyboard is up, bring the
 * focused field to the top of the sheet.
 *
 * Put `contentRef` on a `collapsable={false}` View wrapping the scroll
 * view's children, and `scrollRef` on the scroll view.
 */
export function useRevealFocusedField(active: boolean) {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);

  useEffect(() => {
    if (!active || Platform.OS === "web") return;
    const sub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => {
      requestAnimationFrame(() => {
        const field = TextInput.State.currentlyFocusedInput?.();
        const content = contentRef.current;
        if (!field || !content) return;
        try {
          field.measureLayout(
            content,
            (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.sm), animated: true }),
            () => undefined,
          );
        } catch {
          // The focused field is not in this sheet.
        }
      });
    });
    return () => sub.remove();
  }, [active]);

  return { scrollRef, contentRef };
}
