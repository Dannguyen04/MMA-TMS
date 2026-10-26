import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { BottomSheet } from "@/components/filter-sheet";
import { Icon } from "@/components/icon";
import { ot } from "@/i18n/one-tap";
import { TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";

import { reasonValue } from "./write";

export const OTHER_MAX = 100;

/** Nút trong sheet: cao 48dp; danger = nền danger chữ trắng; spinner + khóa khi gửi. */
export function SheetButton({
  label,
  onPress,
  kind = "primary",
  loading = false,
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "danger" | "outline";
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const p = useFighterPalette();
  const locked = loading || disabled;
  const bg = kind === "primary" ? p.accent : kind === "danger" ? p.danger : p.surface;
  const fg = kind === "outline" ? p.ink : p.onAccent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={loading ? `${label}, ${ot.sending}` : label}
      accessibilityState={{ disabled: locked, busy: loading }}
      disabled={locked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: kind === "outline" ? p.ring : bg, opacity: disabled && !loading ? 0.45 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : null}
      <Text style={[TEXT.bodyBold, { color: fg }]} numberOfLines={1}>
        {loading ? ot.sending : label}
      </Text>
    </Pressable>
  );
}

/** Dòng báo không có quyền (danger + icon), hiện ngay trong sheet/thẻ. */
export function ForbiddenLine({ text }: { text: string }) {
  const p = useFighterPalette();
  if (!text) return null;
  return (
    <View testID="forbidden-line" accessibilityLiveRegion="polite" style={[styles.forbid, { borderColor: p.danger, backgroundColor: p.surface }]}>
      <Icon name="lock" size={20} color={p.danger} />
      <Text style={[TEXT.bodyBold, { color: p.danger, flex: 1 }]}>{text}</Text>
    </View>
  );
}

/**
 * Sheet xác nhận: tiêu đề câu hỏi, 1 dòng hệ quả, (tuỳ chọn) chip lý do chọn đơn + "Khác" 1 dòng ≤100 ký tự,
 * [Hủy] outlined trái, nút chính phải (danger nếu phá hủy; không tự focus).
 */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  danger = false,
  reasons,
  sending,
  forbidden,
  onCancel,
  onConfirm,
  otherMax = OTHER_MAX,
  children,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  reasons?: readonly string[];
  sending: boolean;
  forbidden: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  /** Giới hạn ô "Khác" theo DTO backend (mặc định 100). */
  otherMax?: number;
  children?: React.ReactNode;
}) {
  const p = useFighterPalette();
  const [chip, setChip] = useState<string | null>(null);
  const [other, setOther] = useState("");
  useEffect(() => {
    if (visible) {
      setChip(null);
      setOther("");
    }
  }, [visible]);
  const reason = reasonValue(chip, other);
  const needReason = Boolean(reasons?.length);
  const ready = !needReason || reason.length > 0;
  return (
    <BottomSheet
      visible={visible}
      onClose={sending ? () => undefined : onCancel}
      title={title}
      footer={
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <SheetButton testID="sheet-cancel" label={ot.cancel} kind="outline" onPress={onCancel} disabled={sending} />
          </View>
          <View style={{ flex: 1 }}>
            <SheetButton
              testID="sheet-confirm"
              label={confirmLabel}
              kind={danger ? "danger" : "primary"}
              onPress={() => onConfirm(reason)}
              loading={sending}
              disabled={!ready || Boolean(forbidden)}
            />
          </View>
        </View>
      }
    >
      <View style={styles.body}>
        <Text style={[TEXT.body, { color: p.ink }]}>{body}</Text>
        {children}
        {needReason ? (
          <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={ot.pickReason}>
            <Text style={[TEXT.captionBold, { color: p.ink }]}>{ot.pickReason}</Text>
            <View style={styles.chips}>
              {reasons!.map((r) => {
                const on = chip === r;
                return (
                  <Pressable
                    key={r}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on, disabled: sending }}
                    disabled={sending}
                    onPress={() => setChip(r)}
                    style={[styles.chip, { borderColor: on ? p.accentSoft : p.line, backgroundColor: on ? p.accentSoft : p.surface }]}
                  >
                    {on ? <Icon name="check" size={16} color={p.link} /> : null}
                    <Text style={[TEXT.body, { color: on ? p.link : p.ink, fontWeight: on ? "700" : "400" }]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
            {chip === ot.other ? (
              <View style={{ gap: 4 }}>
                <TextInput
                  testID="reason-other"
                  value={other}
                  onChangeText={(v) => setOther(v.replace(/\n/g, " ").slice(0, otherMax))}
                  maxLength={otherMax}
                  editable={!sending}
                  placeholder={otherMax === OTHER_MAX ? ot.otherPlaceholder : ot.otherPlaceholderN(otherMax)}
                  placeholderTextColor={p.filterMuted}
                  accessibilityLabel={otherMax === OTHER_MAX ? ot.otherPlaceholder : ot.otherPlaceholderN(otherMax)}
                  returnKeyType="done"
                  style={[styles.input, TEXT.body, { color: p.ink, borderColor: p.ring, backgroundColor: p.surface }]}
                />
                <Text style={[TEXT.caption, { color: p.ink, alignSelf: "flex-end" }]}>{ot.otherCountN(other.length, otherMax)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <ForbiddenLine text={forbidden} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: 48, borderRadius: 12, borderWidth: 2, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  footer: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  body: { gap: 16, paddingBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 48, borderRadius: 24, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 2, paddingHorizontal: 12 },
  forbid: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 2, borderRadius: 12, padding: 12 },
});
