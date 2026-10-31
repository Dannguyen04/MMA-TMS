import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MedicalDossier } from "@/api/types";
import { BottomSheet } from "@/components/filter-sheet";
import { formatMedicalDay, jointLabel, sessionTypeName, techniqueLabel } from "@/components/medical/medical-format";
import { scopeState, type EligibilityLevel, type EligibilityScope, type ScopeState } from "@/components/medical/eligibility-model";
import { fighterBody as t } from "@/i18n/fighter-body";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";

export function reasonLine(code: string): string {
  return t.reason[code] ?? t.reasonUnknown;
}

function useTone(level: EligibilityLevel) {
  const c = useFighterPalette();
  return level === "eligible"
    ? { fg: c.success, bg: c.successSoft }
    : level === "restricted"
      ? { fg: c.accent, bg: c.accentSoft }
      : { fg: c.warning, bg: c.warningSoft };
}

export function LevelChip({ level }: { level: EligibilityLevel }) {
  const tone = useTone(level);
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <View style={[styles.dot, { backgroundColor: tone.fg }]} />
      <Text style={[styles.chipText, { color: tone.fg }]}>{t.chip[level]}</Text>
    </View>
  );
}

/** Thẻ "Hôm nay": một câu trả lời + việc cần làm tiếp. */
export function TodayCard({ dossier, onRequest }: { dossier: MedicalDossier; onRequest: () => void }) {
  const c = useFighterPalette();
  const training = scopeState(dossier, "training");
  const competition = scopeState(dossier, "competition");
  const tone = useTone(training.level);
  const pending = dossier.openReviewRequests.length > 0;
  const firstReason = training.value.reasons[0];
  const next =
    training.level === "notEligible"
      ? firstReason
        ? reasonLine(firstReason)
        : t.reasonUnknown
      : training.level === "restricted"
        ? t.today.restrictedNext
        : competition.level === "notEligible"
          ? t.today.competitionNo
          : t.today.allClear;
  const icon = training.level === "notEligible" ? "shield-off-outline" : "shield-check-outline";
  return (
    <View style={[styles.today, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.todayRow}>
        <MaterialCommunityIcons name={icon} size={26} color={tone.fg} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[styles.todayTitle, { color: c.ink }]}>
            {t.today[training.level]}
          </Text>
          <Text style={[styles.body, { color: c.muted }]}>{next}</Text>
        </View>
      </View>
      {pending ? (
        <View style={[styles.pending, { backgroundColor: c.surface2 }]}>
          <MaterialCommunityIcons name="clock-outline" size={16} color={c.muted} />
          <Text style={[styles.body, { color: c.ink }]}>{t.today.pending}</Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onRequest}
          style={({ pressed }) => [styles.button, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.buttonText, { color: c.onAccent }]}>{t.today.request}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** 2 ô Tập luyện / Thi đấu, cao cố định; chạm mở sheet. */
export function EligibilityTiles({ dossier, onRequest }: { dossier: MedicalDossier; onRequest: () => void }) {
  const [open, setOpen] = useState<EligibilityScope | null>(null);
  return (
    <>
      <View style={styles.tiles}>
        {(["training", "competition"] as const).map((scope) => (
          <Tile key={scope} scope={scope} state={scopeState(dossier, scope)} onPress={() => setOpen(scope)} />
        ))}
      </View>
      <ScopeSheet dossier={dossier} scope={open} onClose={() => setOpen(null)} onRequest={onRequest} />
    </>
  );
}

function Tile({ scope, state, onPress }: { scope: EligibilityScope; state: ScopeState; onPress: () => void }) {
  const c = useFighterPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.scope[scope]}: ${t.chip[state.level]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: c.surface, borderColor: c.line, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.tileTop}>
        <Text style={[styles.tileLabel, { color: c.ink }]}>{t.scope[scope]}</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={c.muted} />
      </View>
      <LevelChip level={state.level} />
    </Pressable>
  );
}

function limitRows(state: ScopeState): { label: string; value: string }[] {
  const sources = [state.exam?.restrictions, state.clearance?.restrictions];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value && !rows.some((r) => r.label === label && r.value === value)) rows.push({ label, value });
  };
  for (const r of sources) {
    if (!r) continue;
    add(t.sheet.avoidJoints, r.excludedJoints?.map(jointLabel).join(", "));
    add(t.sheet.allowedSessions, r.allowedSessionTypes?.map(sessionTypeName).join(", "));
    add(t.sheet.allowedTechniques, r.allowedTechniqueTypes?.map(techniqueLabel).join(", "));
    add(t.sheet.note, r.notes?.trim());
  }
  return rows;
}

function ScopeSheet({
  dossier,
  scope,
  onClose,
  onRequest,
}: {
  dossier: MedicalDossier;
  scope: EligibilityScope | null;
  onClose: () => void;
  onRequest: () => void;
}) {
  const c = useFighterPalette();
  const s = scope ?? "training";
  const state = scopeState(dossier, s);
  const tone = useTone(state.level);
  const reasons = state.value.eligible ? [] : state.value.reasons.length ? state.value.reasons : [""];
  const todos = [...new Set(state.value.reasons.map((code) => t.todo[code]).filter(Boolean))];
  const limits = limitRows(state);
  const until = state.clearance?.validUntil ?? state.exam?.validUntil ?? null;
  const pending = dossier.openReviewRequests.length > 0;
  const canRequest = !pending && state.level !== "eligible";
  return (
    <BottomSheet
      visible={scope !== null}
      onClose={onClose}
      title={t.scope[s]}
      footer={
        canRequest ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onClose();
              onRequest();
            }}
            style={({ pressed }) => [styles.button, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.buttonText, { color: c.onAccent }]}>{t.today.request}</Text>
          </Pressable>
        ) : undefined
      }
    >
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <LevelChip level={state.level} />
          {until ? (
            <Text style={[styles.body, { color: c.muted }]}>
              {t.sheet.validUntil} {formatMedicalDay(until)}
            </Text>
          ) : null}
        </View>
        {reasons.length ? (
          <Block title={t.sheet.why}>
            {reasons.map((code) => (
              <Bullet key={code || "unknown"} text={code ? reasonLine(code) : t.reasonUnknown} color={tone.fg} />
            ))}
          </Block>
        ) : null}
        {todos.length ? (
          <Block title={t.sheet.todo}>
            {todos.map((text) => (
              <Bullet key={text} text={text} color={c.ink} />
            ))}
          </Block>
        ) : null}
        {limits.length ? (
          <Block title={t.sheet.limits}>
            {limits.map((row) => (
              <View key={row.label + row.value} style={styles.limit}>
                <Text style={[styles.body, { color: c.muted }]}>{row.label}</Text>
                <Text style={[styles.value, { color: c.ink }]}>{row.value}</Text>
              </View>
            ))}
          </Block>
        ) : null}
        {s === "training" && state.value.eligible ? <Text style={[styles.body, { color: c.muted }]}>{t.sheet.trainingNote}</Text> : null}
      </View>
    </BottomSheet>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useFighterPalette();
  return (
    <View style={styles.block}>
      <Text style={[styles.blockTitle, { color: c.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ text, color }: { text: string; color: string }) {
  const c = useFighterPalette();
  return (
    <View style={styles.bullet}>
      <View style={[styles.bulletDot, { backgroundColor: color }]} />
      <Text style={[styles.value, styles.flex, { color: c.ink }]}>{text}</Text>
    </View>
  );
}

/** Nút ⓘ gộp mọi ghi chú vào một sheet. */
export function HealthInfoButton() {
  const c = useFighterPalette();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.info.label}
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={[styles.info, { backgroundColor: c.surface2 }]}
      >
        <MaterialCommunityIcons name="information-outline" size={22} color={c.ink} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t.info.label}>
        <View style={styles.sheet}>
          {t.info.lines.map((line) => (
            <Bullet key={line} text={line} color={c.muted} />
          ))}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  today: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, gap: 14 },
  todayRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  todayTitle: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20 },
  value: { fontSize: 15, lineHeight: 21 },
  pending: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, minHeight: 44, paddingHorizontal: 12 },
  button: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonText: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  tiles: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, height: 84, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, justifyContent: "space-between" },
  tileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tileLabel: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  sheet: { gap: 16, paddingBottom: 8 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  block: { gap: 8 },
  blockTitle: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
  bullet: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  limit: { gap: 2 },
  info: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
