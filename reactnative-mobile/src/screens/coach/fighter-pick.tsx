import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import type { PublicFighter } from "@/api/types";
import { BottomSheet } from "@/components/forms/filter-sheet";
import { Icon } from "@/components/icon";
import { fighterName } from "@/screens/coach/readonly/ro-format";
import { RetryRow } from "@/screens/fighter/redesign/tab-page";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";

/**
 * The coach forms' fighter field (redesign steps 17–18): a bordered row with the chosen name that opens a sheet of
 * the coach's fighters. A failed load shows one "Thử lại" row in its place. As a list filter (step 19) it has no label
 * and an `allLabel` first row that clears the choice (value "").
 */
export function FighterPick({ testID, label, placeholder, allLabel, empty, failed, retry, state, fighters, value, onChange, onRetry }: {
  testID: string; label?: string; placeholder: string; allLabel?: string; empty: string; failed: string; retry: string;
  state: "loading" | "ok" | "error"; fighters: readonly PublicFighter[]; value: string;
  onChange: (id: string) => void; onRetry: () => void;
}) {
  const { colors: c } = useThemePreference();
  const [open, setOpen] = useState(false);
  const chosen = fighters.find(f => f.id === value);
  return <View style={{ gap: 7 }}>
    {label ? <Text style={{ ...readableTextStyle(15, true), color: c.ink }}>{label}</Text> : null}
    {state === "error" ? <RetryRow message={failed} retry={retry} onRetry={onRetry}/>
      : <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${placeholder}${chosen ? `, ${fighterName(chosen)}` : ""}`} onPress={() => setOpen(true)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", minHeight: 50, paddingHorizontal: 13, borderWidth: 1.5, borderColor: c.controlBorder, opacity: pressed ? 0.75 : 1 })}>
        <Text numberOfLines={1} style={{ ...readableTextStyle(16, !!chosen || !!allLabel), color: c.ink, flex: 1 }}>{chosen ? fighterName(chosen) : allLabel ?? placeholder}</Text>
        {state === "loading" ? <ActivityIndicator color={c.lotus}/> : <Icon name="chevron" size={18} color={c.inkSubtle}/>}
      </Pressable>}
    <BottomSheet visible={open} onClose={() => setOpen(false)} title={placeholder}>
      {allLabel ? <Pressable testID="pick-all" accessibilityRole="radio" accessibilityState={{ checked: !value }} onPress={() => { onChange(""); setOpen(false); }}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, opacity: pressed ? 0.75 : 1 })}>
        <View style={{ width: 28, alignItems: "center" }}>{!value ? <Icon name="check" size={20} color={c.success}/> : null}</View>
        <Text numberOfLines={1} style={{ ...readableTextStyle(15.5, !value), color: c.ink, flex: 1 }}>{allLabel}</Text>
      </Pressable> : null}
      {fighters.length ? fighters.map(f => <Pressable key={f.id} testID={`pick-${f.id}`} accessibilityRole="radio" accessibilityState={{ checked: f.id === value }}
        onPress={() => { onChange(f.id); setOpen(false); }}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderTopColor: c.line, borderTopWidth: 1, opacity: pressed ? 0.75 : 1 })}>
        <View style={{ width: 28, alignItems: "center" }}>{f.id === value ? <Icon name="check" size={20} color={c.success}/> : null}</View>
        <Text numberOfLines={1} style={{ ...readableTextStyle(15.5, f.id === value), color: c.ink, flex: 1 }}>{fighterName(f)}</Text>
      </Pressable>) : <Text style={{ ...readableTextStyle(15), color: c.ink, paddingVertical: 12 }}>{empty}</Text>}
    </BottomSheet>
  </View>;
}
