import { useMemo, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";

import { BottomSheet } from "./filter-sheet";
import { Icon } from "@/components/icon";
import { useThemePreference } from "@/theme/index";
import { readableTextStyle } from "@/theme/typography";

export type PickOption<T extends string> = { value: T; label: string };

/**
 * A long choice as a field (redesign step 24, owner 2026-11-13): a bordered row with the chosen label that opens a
 * bottom sheet of options, the chosen one bold with a check. Tapping an option picks it and closes the sheet.
 * `search` adds a find box at the top of the sheet (countries). Same look as FighterPick.
 */
export function OptionPick<T extends string>({ testID, label, title, placeholder, options, value, onChange, search, emptySearch }: {
  testID: string; label?: string; title: string; placeholder?: string;
  options: readonly PickOption<T>[]; value: T | ""; onChange: (v: T) => void;
  search?: { placeholder: string; match?: (o: PickOption<T>, q: string) => boolean }; emptySearch?: string;
}) {
  const { colors: c } = useThemePreference();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const chosen = options.find(o => o.value === value);
  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("vi");
    if (!search || !needle) return options;
    return options.filter(o => (search.match ? search.match(o, q) : o.label.toLocaleLowerCase("vi").includes(needle)));
  }, [options, q, search]);
  const close = () => { setOpen(false); setQ(""); };
  return <View style={{ gap: 7 }}>
    {label ? <Text style={{ ...readableTextStyle(15, true), color: c.ink }}>{label}</Text> : null}
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${label ?? title}: ${chosen?.label ?? placeholder ?? ""}`} onPress={() => setOpen(true)}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", minHeight: 50, paddingHorizontal: 13, borderWidth: 1.5, borderColor: c.controlBorder, opacity: pressed ? 0.75 : 1 })}>
      <Text numberOfLines={1} style={{ ...readableTextStyle(16, !!chosen), color: chosen ? c.ink : c.inkSubtle, flex: 1 }}>{chosen?.label ?? placeholder ?? ""}</Text>
      <Icon name="chevron" size={18} color={c.inkSubtle}/>
    </Pressable>
    <BottomSheet visible={open} onClose={close} title={title}>
      {search ? <TextInput testID={`${testID}-search`} value={q} onChangeText={setQ} placeholder={search.placeholder} placeholderTextColor={c.inkSubtle} accessibilityLabel={search.placeholder}
        style={{ ...readableTextStyle(16), color: c.ink, minHeight: 48, paddingHorizontal: 13, borderWidth: 1.5, borderColor: c.controlBorder, marginBottom: 8, ...(Platform.OS === "web" ? { outlineStyle: "none" } as object : {}) }}/> : null}
      {shown.length ? shown.map((o, k) => {
        const on = o.value === value;
        return <Pressable key={o.value} testID={`${testID}-opt-${o.value}`} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={o.label}
          onPress={() => { onChange(o.value); close(); }}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderTopColor: c.line, borderTopWidth: k ? 1 : 0, opacity: pressed ? 0.75 : 1 })}>
          <Text numberOfLines={1} style={{ ...readableTextStyle(15.5, on), color: c.ink, flex: 1 }}>{o.label}</Text>
          <View style={{ width: 22, alignItems: "center" }}>{on ? <Icon name="check" size={20} color={c.lotus}/> : null}</View>
        </Pressable>;
      }) : <Text style={{ ...readableTextStyle(15), color: c.ink, paddingVertical: 12 }}>{emptySearch ?? ""}</Text>}
    </BottomSheet>
  </View>;
}
