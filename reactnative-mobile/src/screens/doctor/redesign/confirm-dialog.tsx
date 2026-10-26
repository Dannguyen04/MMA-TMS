import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";

/** Hộp xác nhận giữa màn: tiêu đề + [Hủy] [hành động nguy hiểm]. Nút cao 48dp. */
export function ConfirmDialog({
  visible,
  title,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const p = useFighterPalette();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.fill}>
        <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onCancel} />
        <View accessibilityRole="alert" style={[styles.card, { backgroundColor: p.surface, borderColor: p.line }]}>
          <Text accessibilityRole="header" style={[TEXT.cardTitle, { color: p.ink, textAlign: "center" }]}>
            {title}
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.button, { borderColor: p.line, backgroundColor: p.surface, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[TEXT.bodyBold, { color: p.ink }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [styles.button, { borderColor: p.danger, backgroundColor: p.surface, borderWidth: 2, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[TEXT.bodyBold, { color: p.danger }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  backdrop: { backgroundColor: "rgba(0,0,0,0.55)" },
  card: { width: "100%", maxWidth: 360, borderRadius: 16, borderWidth: 1, padding: 24, gap: 24 },
  actions: { flexDirection: "row", gap: 12 },
  button: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
});
