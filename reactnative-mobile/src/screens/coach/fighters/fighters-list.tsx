import { type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { coachApi } from "@/api/coach";
import { MEDICAL_STATUSES, type MedicalStatus } from "@/api/types";
import { Icon } from "@/components/icon";
import { OptionPick } from "@/components/option-pick";
import { StaggerList } from "@/components/motion";
import { EmptyLine, RolePage } from "@/components/role-page";
import { isWeightClass, WEIGHT_CLASSES, type WeightClass } from "@/constants/weight-classes";
import { coachFighters as t } from "@/i18n/coach-fighters";
import { coachRo } from "@/i18n/coach-ro";
import { RoHeaderAction } from "@/screens/coach/readonly/ro-ui";
import { useCoachEnabled, useDebounced } from "@/screens/coach/readonly/use-coach";
import { usePagedList } from "@/screens/coach/readonly/use-paged-list";
import { fighterName } from "@/screens/coach/readonly/ro-format";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useSession } from "@/session/session-context";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";
import { COACH_FIGHTER_PATH, fighterLine, statusMark, weightLabel } from "./fighter-model";
import { loadLiveSuspensionsByFighter, suspensionNote } from "./fighter-suspensions";

/** Filters with this many options or more open a bottom sheet instead of a chip row (owner 2026-11-13). */
export const SHEET_FROM = 4;

/**
 * A filter that applies on pick. Up to three options: a chip row. Four or more (owner 2026-11-13, step 25 sweep): a
 * labelled field that opens a bottom sheet (`OptionPick`); put two of them in a `FilterRow` to sit side by side.
 */
export function FilterChips<T extends string>({ label, options, value, onChange, testID }: { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void; testID?: string }) {
  const { colors: c } = useThemePreference();
  if (options.length >= SHEET_FROM) {
    return <View style={{ flex: 1, minWidth: 0 }}>
      <OptionPick testID={testID ?? `filter-${label}`} label={label} title={label} options={options} value={value} onChange={onChange}/>
    </View>;
  }
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={label}
    style={{ flexGrow: 0, marginHorizontal: -22 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 22 }}>
    {options.map(o => {
      const on = o.value === value;
      return <Pressable key={o.value || "all"} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} onPress={() => onChange(o.value)}
        style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1.5, borderColor: on ? c.ink : c.controlBorder, backgroundColor: on ? c.ink : "transparent", opacity: pressed ? 0.75 : 1 })}>
        <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: on ? c.bg : c.ink }}>{o.label}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

/** Two filter fields on one line. */
export function FilterRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 10 }}>{children}</View>;
}

/**
 * Võ sĩ (redesign step 16): one row per fighter (status mark and word, name, weight class and gym), a search field,
 * weight-class chips that apply on tap. Coach: "Trận thi đấu" is the first row. Admin passes its own detail path
 * and gets the medical-status chips too (preset through `weightClass`, `medicalStatus` and a fresh `t`).
 */
export function CoachFightersScreen({ title = t.title, detailPath = COACH_FIGHTER_PATH, statusFilter = false }: {
  title?: string; detailPath?: string; statusFilter?: boolean;
} = {}) {
  const enabled = useCoachEnabled();
  const router = useRouter();
  const { gate } = useSession();
  const { colors: c } = useThemePreference();
  const bell = useContext(RoHeaderAction);
  const [search, setSearch] = useState("");
  const [wc, setWc] = useState<WeightClass | "">("");
  const [ms, setMs] = useState<MedicalStatus | "">("");
  const q = useDebounced(search.trim(), 400);
  const params = useLocalSearchParams<{ weightClass?: string; medicalStatus?: string; t?: string }>();

  useEffect(() => {
    if (!statusFilter || params.t === undefined) return;
    setSearch("");
    setWc(params.weightClass && isWeightClass(params.weightClass) ? params.weightClass : "");
    setMs(params.medicalStatus && (MEDICAL_STATUSES as readonly string[]).includes(params.medicalStatus) ? params.medicalStatus as MedicalStatus : "");
  }, [statusFilter, params.t, params.weightClass, params.medicalStatus]);

  const list = usePagedList(enabled, `f|${q}|${wc}|${ms}`, page =>
    coachApi.listFighters({ page, limit: 20, search: q || undefined, weightClass: wc || undefined, medicalStatus: ms || undefined }));
  // Suspensions are not a medical status, so the list reads them on their own: a suspended fighter must never look
  // like a plain "Khỏe" row to the coach. A failed load only drops the extra line; the list still works.
  const [susp, , refreshSusp] = useSource(() => enabled ? loadLiveSuspensionsByFighter() : Promise.resolve(new Map()), enabled);
  const suspended = susp.state === "ok" ? susp.data : null;
  const refresh = async () => { await Promise.all([list.refresh(), refreshSusp()]); };
  const weights = useMemo(() => [{ value: "" as const, label: t.weightAll }, ...WEIGHT_CLASSES.map(w => ({ value: w, label: weightLabel(w) }))], []);
  const statuses = useMemo(() => [{ value: "" as const, label: t.statusAll }, ...MEDICAL_STATUSES.map(s => ({ value: s, label: coachRo.medicalStatus[s] }))], []);

  const firstLoad = !list.loaded || (list.loading && list.items.length === 0 && !list.error);
  const filtered = Boolean(q || wc || ms);
  const empty = list.loaded && !list.loading && !list.error && list.items.length === 0;

  return <RolePage testID="coach-fighters" title={title} right={bell} onRefresh={refresh}>
    {gate === "coach" ? <SlipRow testID="fighters-bouts" icon="martialArts" title={t.bouts} line={t.boutsLine} a11y={t.bouts} last
      onPress={() => router.push("/(coach)/fight-camp" as never)}/> : null}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 12, borderWidth: 1.5, borderColor: c.controlBorder }}>
      <Icon name="search" size={20} color={c.inkMuted}/>
      <TextInput value={search} onChangeText={setSearch} placeholder={t.search} placeholderTextColor={c.inkSubtle} accessibilityLabel={t.search}
        style={{ ...readableTextStyle(15), flex: 1, minWidth: 0, color: c.ink, paddingVertical: 10 }}/>
    </View>
    <FilterRow>
      <FilterChips testID="filter-weight" label={t.weightGroup} options={weights} value={wc} onChange={setWc}/>
      {statusFilter ? <FilterChips testID="filter-status" label={t.statusGroup} options={statuses} value={ms} onChange={setMs}/> : null}
    </FilterRow>

    {list.error ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={() => void list.reload()}/> : null}
    {firstLoad && !list.error ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {empty ? <View style={{ gap: 10 }}>
      <EmptyLine testID="fighters-empty" title={filtered ? t.emptyFiltered : t.empty} line={filtered ? undefined : t.emptyLine}/>
      {filtered ? <Pressable accessibilityRole="button" onPress={() => { setSearch(""); setWc(""); setMs(""); }} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.clear}</Text>
      </Pressable> : null}
    </View> : null}

    {list.items.length ? <StaggerList testID="fighters-list">
      {list.items.map((f, k) => {
        const name = fighterName(f);
        const m = statusMark(f.currentMedicalStatus);
        const line = fighterLine(f);
        const s = suspended?.get(f.id)?.[0];
        const note = s ? suspensionNote(s) : undefined;
        return <SlipRow key={f.id} testID={`fighter-row-${f.id}`} lead={s ? "!" : m.lead} icon={s ? undefined : m.icon} leadTone={s ? "warn" : m.tone} title={name} word={m.word} wordTone={m.wordTone} line={line}
          note={note} a11y={t.rowA11y(name, note ? `${note}. ${m.word}, ${line}` : `${m.word}, ${line}`)} last={k === list.items.length - 1}
          onPress={() => router.push({ pathname: detailPath, params: { id: f.id } } as never)}/>;
      })}
    </StaggerList> : null}
    {list.hasNext ? <Pressable accessibilityRole="button" onPress={list.loadMore} disabled={list.loadingMore} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
      {list.loadingMore ? <ActivityIndicator color={c.lotus}/> : <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.more}</Text>}
    </Pressable> : null}
  </RolePage>;
}
