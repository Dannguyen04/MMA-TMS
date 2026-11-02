import { Pressable, StyleSheet, Text, View } from "react-native";

import { ev } from "@/i18n/video-evidence";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useTypography } from "@/theme";

export type EvidenceTab = "timeline" | "review" | "metrics";

/** Doctors get no "Nhận xét" tab: they cannot read coaching state. */
export function tabsFor(role: "fighter" | "coach" | "doctor"): EvidenceTab[] {
  return role === "doctor" ? ["timeline", "metrics"] : ["timeline", "review", "metrics"];
}

export function EvidenceTabs({ tabs, value, onChange }: { tabs: EvidenceTab[]; value: EvidenceTab; onChange: (t: EvidenceTab) => void }) {
  const c = useFighterPalette();
  const live = useTypography();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { borderBottomColor: c.line }]}>
      {tabs.map((t) => {
        const on = t === value;
        return (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={ev.tabs[t]}
            testID={`tab-${t}`}
            onPress={() => onChange(t)}
            style={styles.tab}
          >
            <Text style={{ color: on ? c.ink : c.muted, fontFamily: on ? live.faces.semibold : live.faces.regular, fontSize: 15 }}>{ev.tabs[t]}</Text>
            <View style={[styles.rule, { backgroundColor: on ? c.accent : "transparent" }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, gap: 20 },
  tab: { minHeight: 44, justifyContent: "flex-end", gap: 10 },
  rule: { height: 2, borderRadius: 1 },
});
