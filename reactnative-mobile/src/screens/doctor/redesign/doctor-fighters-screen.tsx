import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { MEDICAL_STATUSES } from "@/api";
import { FilterSelect, type FilterOption } from "@/components/filter-sheet";
import { WEIGHT_CLASSES, type WeightClass } from "@/constants/weight-classes";
import { doctorRo } from "@/i18n/doctor-ro";
import { vi } from "@/i18n/vi";
import { fighterName, MEDICAL_CHIP } from "@/screens/coach/readonly/ro-format";
import { Avatar, RoRow, RoScreen, RowSkeletons, SearchBar, Stack, useGo } from "@/screens/coach/readonly/ro-ui";
import { ActionButton, ConnectionBanner, MessageCard, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { vai } from "@/i18n/video-ai";
import { DetailTabs } from "@/screens/doctor/detail/detail-ui";
import { DoctorAiAlerts, useImpairments } from "@/screens/video-ai/doctor-ai-alerts";
import { useAiEnabled } from "@/screens/video-ai/ai-data";

import { filterRoster, statusFromParam, type RosterStatusFilter } from "./doctor-format";
import { useDoctorRoster } from "./doctor-roster";

const weightLabels = vi.weightClass as Record<string, string>;
export const DOCTOR_DETAIL_PATH = "/(doctor)/vo-si/chi-tiet";

/** Tab Võ sĩ của Doctor: tên, hạng cân, chip y tế; tìm theo tên, lọc hạng cân và tình trạng. */
export function DoctorFightersScreen() {
  const roster = useDoctorRoster();
  const go = useGo();
  const p = useFighterPalette();
  const params = useLocalSearchParams<{ status?: string; t?: string; seg?: string; fighterId?: string }>();
  const [seg, setSeg] = useState<"fighters" | "ai">("fighters");
  const [aiFighter, setAiFighter] = useState("");
  const aiEnabled = useAiEnabled();
  const impairments = useImpairments(aiEnabled && roster.enabled);
  const names = useMemo(() => Object.fromEntries(roster.items.map((f) => [f.id, fighterName(f)])), [roster.items]);
  const [search, setSearch] = useState("");
  const [wc, setWc] = useState<WeightClass | "">("");
  const [status, setStatus] = useState<RosterStatusFilter>("");
  const chipRow = useRef<ScrollView>(null);

  // Ô "Cần chú ý" / "Võ sĩ phụ trách" ở màn Tôi mở tab này với bộ lọc tình trạng đặt sẵn.
  useEffect(() => {
    const next = statusFromParam(params.status);
    if (next !== null) setStatus(next);
    // Lọc đặt sẵn từ màn Tôi: cuộn hàng chip để chip Tình trạng đang bật luôn nhìn thấy.
    if (next) requestAnimationFrame(() => chipRow.current?.scrollToEnd({ animated: false }));
    if (params.seg === "ai") {
      setSeg("ai");
      setAiFighter(typeof params.fighterId === "string" ? params.fighterId : "");
    } else if (next !== null) setSeg("fighters");
  }, [params.status, params.t, params.seg, params.fighterId]);

  const weightOptions = useMemo<FilterOption<WeightClass | "">[]>(
    () => [{ value: "", label: doctorRo.fighters.weightAll }, ...WEIGHT_CLASSES.map((w) => ({ value: w, label: weightLabels[w] ?? w }))],
    [],
  );
  const statusOptions = useMemo<FilterOption<RosterStatusFilter>[]>(
    () => [
      { value: "", label: doctorRo.fighters.statusAll },
      { value: "attention", label: doctorRo.fighters.attention },
      ...MEDICAL_STATUSES.map((s) => ({ value: s, label: MEDICAL_CHIP[s].label })),
    ],
    [],
  );

  const visible = useMemo(() => filterRoster(roster.items, { search, weightClass: wc, status }), [roster.items, search, wc, status]);
  const firstLoad = !roster.loaded || (roster.loading && roster.items.length === 0 && !roster.error);
  const skeleton = useDelayedFlag(firstLoad);
  const filtered = Boolean(search.trim() || wc || status);
  const empty = roster.loaded && !roster.loading && !roster.error && visible.length === 0;

  return (
    <RoScreen
      title={doctorRo.fighters.title}
      onRefresh={() => Promise.all([roster.refresh(), seg === "ai" ? impairments.refresh() : null])}
      refreshing={roster.loading && roster.items.length === 0}
    >
      <Stack>
        <DetailTabs
          value={seg}
          onChange={setSeg}
          tabs={[
            { key: "fighters", label: vai.segFighters },
            { key: "ai", label: vai.segAi },
          ]}
        />
        {seg === "ai" ? <DoctorAiAlerts load={impairments} names={names} fighterId={aiFighter || undefined} onClearFighter={() => setAiFighter("")} /> : null}
        {seg === "fighters" ? (
        <>
        <SearchBar value={search} onChangeText={setSearch} placeholder={doctorRo.fighters.search} />
        {/* Một hàng chip lọc cuộn ngang (Hạng cân + Tình trạng), cao 48dp. */}
        <ScrollView
          ref={chipRow}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chips}
          style={styles.chipRow}
        >
          <FilterSelect
            mutedColor={p.filterMuted}
            label={doctorRo.fighters.weightFilter}
            value={wc}
            onChange={setWc}
            options={weightOptions}
            allValue=""
            style={styles.chip}
          />
          <FilterSelect
            mutedColor={p.filterMuted}
            label={doctorRo.fighters.statusFilter}
            value={status}
            onChange={setStatus}
            options={statusOptions}
            allValue=""
            style={styles.chip}
          />
        </ScrollView>

        {roster.error ? (
          <ConnectionBanner error={roster.error} onRetry={roster.reload} retrying={roster.loading} hasData={roster.items.length > 0} />
        ) : null}

        {firstLoad && !roster.error && skeleton ? <RowSkeletons count={5} height={96} /> : null}

        {empty ? (
          <MessageCard
            icon="fighters"
            title={filtered && roster.items.length > 0 ? doctorRo.fighters.emptyFiltered : doctorRo.fighters.emptyTitle}
            description={filtered && roster.items.length > 0 ? doctorRo.fighters.emptyFilteredDesc : doctorRo.fighters.emptyDesc}
          >
            {filtered && roster.items.length > 0 ? (
              <ActionButton
                label={doctorRo.fighters.clear}
                variant="secondary"
                icon="close"
                onPress={() => {
                  setSearch("");
                  setWc("");
                  setStatus("");
                }}
              />
            ) : null}
          </MessageCard>
        ) : null}

        {visible.length > 0 ? (
          <Stack>
            {visible.map((f) => {
              const name = fighterName(f);
              return (
                <RoRow
                  key={f.id}
                  leading={<Avatar name={name} uri={f.profileImageUrl} />}
                  title={name}
                  lines={[weightLabels[f.weightClass] ?? f.weightClass]}
                  chip={MEDICAL_CHIP[f.currentMedicalStatus]}
                  onPress={() => go(DOCTOR_DETAIL_PATH, f.id)}
                />
              );
            })}
          </Stack>
        ) : null}
        </>
        ) : null}
      </Stack>
    </RoScreen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexGrow: 0 },
  chips: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2, paddingRight: 16 },
  chip: { minHeight: 48, height: 48, maxWidth: 360 },
});
