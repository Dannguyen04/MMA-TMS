import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { MEDICAL_STATUSES } from "@/api";
import { Icon } from "@/components/icon";
import { StaggerList } from "@/components/motion/motion";
import { EmptyLine, RolePage } from "@/components/navigation/role-page";
import { WEIGHT_CLASSES, type WeightClass } from "@/constants/weight-classes";
import { coachRo } from "@/i18n/coach/coach-ro";
import { doctorRest as t } from "@/i18n/doctor/doctor-rest";
import { fighterLine, statusMark, weightLabel } from "@/screens/coach/fighters/fighter-model";
import { FilterChips, FilterRow } from "@/screens/coach/fighters/fighters-list";
import { FighterPick } from "@/screens/coach/fighter-pick";
import { fighterName, vnDate } from "@/screens/coach/readonly/ro-format";
import { DoctorBell } from "@/screens/doctor/today/doctor-bell";
import { CampTabs } from "@/shared/ui/camp-lit";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useAiEnabled } from "@/screens/video-ai/ai-data";
import { jointText, severityLabel, severityTone } from "@/screens/video-ai/ai-model";
import { useImpairments } from "@/screens/video-ai/doctor-ai-alerts";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";

import { DoctorAiDisclaimer } from "./ai-disclaimer";
import { filterRoster, statusFromParam, type RosterStatusFilter } from "./doctor-format";
import { doctorVideoHref } from "./doctor-paths";
import { useDoctorRoster } from "./doctor-roster";

export const DOCTOR_DETAIL_PATH = "/(doctor)/vo-si/chi-tiet";
type Seg = "fighters" | "ai";

/**
 * Doctor Võ sĩ (redesign step 21): tabs Võ sĩ · Cảnh báo AI (count on the tab). Võ sĩ: search, weight and status chips
 * that apply on tap, one row per fighter (mark, name, status word · weight · gym). Cảnh báo AI: a fighter field and one
 * row per analysis (severity word · joint · alerts · date); a row opens the one video page.
 */
export function DoctorFightersScreen() {
  const roster = useDoctorRoster();
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const params = useLocalSearchParams<{ status?: string; t?: string; seg?: string; fighterId?: string }>();
  const [seg, setSeg] = useState<Seg>("fighters");
  const [aiFighter, setAiFighter] = useState("");
  const aiEnabled = useAiEnabled();
  const impairments = useImpairments(aiEnabled && roster.enabled);
  const names = useMemo(() => Object.fromEntries(roster.items.map((f) => [f.id, fighterName(f)])), [roster.items]);
  const [search, setSearch] = useState("");
  const [wc, setWc] = useState<WeightClass | "">("");
  const [status, setStatus] = useState<RosterStatusFilter>("");

  // Tôi and Hôm nay open this tab with a preset (status, or the AI tab for one fighter).
  useEffect(() => {
    const next = statusFromParam(params.status);
    if (next !== null) setStatus(next);
    if (params.seg === "ai") {
      setSeg("ai");
      setAiFighter(typeof params.fighterId === "string" ? params.fighterId : "");
    } else if (next !== null) setSeg("fighters");
  }, [params.status, params.t, params.seg, params.fighterId]);

  const weights = useMemo(() => [{ value: "" as const, label: t.weightAll }, ...WEIGHT_CLASSES.map((w) => ({ value: w, label: weightLabel(w) }))], []);
  const statuses = useMemo(() => [
    { value: "" as RosterStatusFilter, label: t.statusAll },
    { value: "attention" as RosterStatusFilter, label: t.attention },
    ...MEDICAL_STATUSES.map((s) => ({ value: s as RosterStatusFilter, label: coachRo.medicalStatus[s] })),
  ], []);

  const visible = useMemo(() => filterRoster(roster.items, { search, weightClass: wc, status }), [roster.items, search, wc, status]);
  const oneGym = useMemo(() => new Set(roster.items.map(f => f.gym ?? "")).size <= 1, [roster.items]);
  const firstLoad = !roster.loaded || (roster.loading && roster.items.length === 0 && !roster.error);
  const filtered = Boolean(search.trim() || wc || status);
  const empty = roster.loaded && !roster.loading && !roster.error && visible.length === 0;
  const aiRows = useMemo(() => (impairments.data ?? []).filter((r) => !aiFighter || r.fighterId === aiFighter), [impairments.data, aiFighter]);
  const aiCount = impairments.data?.length ?? 0;

  return <RolePage testID="doctor-fighters" title={t.fighters} right={<DoctorBell/>}
    onRefresh={() => Promise.all([roster.refresh(), seg === "ai" ? impairments.refresh() : null])}>
    <CampTabs alertLabel="" value={seg} onChange={(k) => setSeg(k as Seg)}
      tabs={[{ key: "fighters", label: t.tabFighters }, { key: "ai", label: t.tabAi, count: aiCount || undefined, a11y: t.tabAiA11y(aiCount) }]}/>

    {seg === "fighters" ? <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 12, borderWidth: 1.5, borderColor: c.controlBorder }}>
        <Icon name="search" size={20} color={c.inkMuted}/>
        <TextInput testID="doctor-search" value={search} onChangeText={setSearch} placeholder={t.search} placeholderTextColor={c.inkSubtle} accessibilityLabel={t.search}
          style={{ ...readableTextStyle(15), flex: 1, minWidth: 0, color: c.ink, paddingVertical: 10 }}/>
      </View>
      <FilterRow>
        <FilterChips testID="filter-weight" label={t.weightGroup} options={weights} value={wc} onChange={setWc}/>
        <FilterChips testID="filter-status" label={t.statusGroup} options={statuses} value={status} onChange={setStatus}/>
      </FilterRow>

      {roster.error ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={() => void roster.reload()}/> : null}
      {firstLoad && !roster.error ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
      {empty ? <View style={{ gap: 10 }}>
        <EmptyLine testID="doctor-fighters-empty" title={filtered && roster.items.length ? t.emptyFiltered : t.empty}/>
        {filtered ? <Pressable accessibilityRole="button" onPress={() => { setSearch(""); setWc(""); setStatus(""); }} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
          <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.clear}</Text>
        </Pressable> : null}
      </View> : null}
      {visible.length ? <StaggerList testID="doctor-fighters-list">
        {visible.map((f, k) => {
          const name = fighterName(f);
          const m = statusMark(f.currentMedicalStatus);
          // One gym for the whole roster says nothing per row (owner 2026-11-18, as on the coach list); several gyms do.
          const line = fighterLine(f, { gym: oneGym === false });
          return <SlipRow key={f.id} testID={`doctor-fighter-${f.id}`} lead={m.lead} icon={m.icon} leadTone={m.tone} title={name} word={m.word} wordTone={m.wordTone} line={line}
            a11y={`${name}, ${m.word}, ${line}`} last={k === visible.length - 1}
            onPress={() => router.push({ pathname: DOCTOR_DETAIL_PATH, params: { id: f.id } } as never)}/>;
        })}
      </StaggerList> : null}
    </> : <>
      <FighterPick testID="ai-pick-fighter" placeholder={t.pickFighter} allLabel={t.allFighters} empty={t.empty} failed={t.loadFailed} retry={t.retry}
        state={roster.error ? "error" : roster.loaded ? "ok" : "loading"} fighters={roster.items} value={aiFighter} onChange={setAiFighter} onRetry={() => void roster.reload()}/>
      {impairments.loading && !impairments.data ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : null}
      {impairments.error && !impairments.data ? <RetryRow message={t.aiFailed} retry={t.retry} onRetry={() => void impairments.reload()}/> : null}
      {impairments.data && !aiRows.length ? <EmptyLine testID="doctor-ai-empty" title={aiFighter ? t.aiEmptyFighter : t.aiEmpty}/> : null}
      {aiRows.length ? <StaggerList testID="doctor-ai-list">
        {aiRows.map((r, k) => {
          const name = names[r.fighterId] ?? t.fighterFallback;
          const sev = r.severity ? severityLabel(r.severity) : "";
          const line = [jointText(r.joint), r.count ? t.alerts(r.count) : "", vnDate(r.createdAt).slice(0, 5)].filter(Boolean).join(" · ");
          return <SlipRow key={r.jobId} testID={`doctor-ai-${r.jobId}`} lead="!" leadTone={sev && severityTone(r.severity) === "danger" ? "warn" : undefined} title={name}
            word={sev || undefined} wordTone="warn" line={line} a11y={[name, sev, line].filter(Boolean).join(", ")} last={k === aiRows.length - 1}
            onPress={() => router.push(doctorVideoHref(r.jobId, r.videoId) as never)}/>;
        })}
      </StaggerList> : null}
      {impairments.data ? <DoctorAiDisclaimer/> : null}
    </>}
  </RolePage>;
}
