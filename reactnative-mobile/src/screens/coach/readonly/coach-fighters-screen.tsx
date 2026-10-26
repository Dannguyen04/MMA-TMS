import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSession } from "@/session/session-context";


import { coachApi } from "@/api/coach";
import { MEDICAL_STATUSES, type MedicalStatus } from "@/api/types";
import { isWeightClass } from "@/constants/weight-classes";
import { FilterSelect, type FilterOption } from "@/components/filter-sheet";
import { WEIGHT_CLASSES, type WeightClass } from "@/constants/weight-classes";
import { coachRo } from "@/i18n/coach-ro";
import { vi } from "@/i18n/vi";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { ActionButton, ConnectionBanner, MessageCard, useDelayedFlag } from "@/screens/fighter/bout-states";
import { fighterName, MEDICAL_CHIP } from "./ro-format";
import { Avatar, LoadMore, RoRow, RoScreen, RowSkeletons, SearchBar, Stack, useGo } from "./ro-ui";
import { useCoachEnabled, useDebounced } from "./use-coach";
import { usePagedList } from "./use-paged-list";

const weightLabels = vi.weightClass as Record<string, string>;

/** C-1: danh sách võ sĩ phụ trách (chỉ đọc). */
export function CoachFightersScreen({
  title = coachRo.fighters.title,
  detailPath = "/(coach)/fighters/chi-tiet",
  statusFilter = false,
}: {
  title?: string;
  detailPath?: string;
  /** Admin: thêm lọc Tình trạng y tế và nhận bộ lọc đặt sẵn qua đường dẫn (`weightClass`, `medicalStatus`, `t`). */
  statusFilter?: boolean;
} = {}) {
  const enabled = useCoachEnabled();
  const router = useRouter();
  const { gate } = useSession();
  const go = useGo();
  const p = useFighterPalette();
  const [search, setSearch] = useState("");
  const [wc, setWc] = useState<WeightClass | "">("");
  const [ms, setMs] = useState<MedicalStatus | "">("");
  const chipRow = useRef<ScrollView>(null);
  const q = useDebounced(search.trim(), 400);
  const params = useLocalSearchParams<{ weightClass?: string; medicalStatus?: string; t?: string }>();

  // Tổng quan Admin mở danh sách với bộ lọc đặt sẵn (mỗi lần bấm có `t` mới).
  useEffect(() => {
    if (!statusFilter || params.t === undefined) return;
    setSearch("");
    setWc(params.weightClass && isWeightClass(params.weightClass) ? params.weightClass : "");
    const status = params.medicalStatus && (MEDICAL_STATUSES as readonly string[]).includes(params.medicalStatus) ? (params.medicalStatus as MedicalStatus) : "";
    setMs(status);
    // Chip Tình trạng nằm sau: cuộn để chip đang lọc luôn nhìn thấy.
    requestAnimationFrame(() => (status ? chipRow.current?.scrollToEnd({ animated: false }) : chipRow.current?.scrollTo({ x: 0, animated: false })));
  }, [statusFilter, params.t, params.weightClass, params.medicalStatus]);

  const list = usePagedList(enabled, `f|${q}|${wc}|${ms}`, (page) =>
    coachApi.listFighters({ page, limit: 20, search: q || undefined, weightClass: wc || undefined, medicalStatus: ms || undefined }),
  );
  const statusOptions = useMemo<FilterOption<MedicalStatus | "">[]>(
    () => [{ value: "", label: coachRo.fighters.statusAll }, ...MEDICAL_STATUSES.map((s) => ({ value: s, label: MEDICAL_CHIP[s].label }))],
    [],
  );
  const options = useMemo<FilterOption<WeightClass | "">[]>(
    () => [{ value: "", label: coachRo.fighters.all }, ...WEIGHT_CLASSES.map((w) => ({ value: w, label: weightLabels[w] ?? w }))],
    [],
  );

  const firstLoad = !list.loaded || (list.loading && list.items.length === 0 && !list.error);
  const skeleton = useDelayedFlag(firstLoad);
  const filtered = Boolean(q || wc || ms);
  const empty = list.loaded && !list.loading && !list.error && list.items.length === 0;

  return (
    <RoScreen title={title} onRefresh={list.refresh} refreshing={list.loading && list.items.length === 0}>
      <Stack>
        {gate === "coach" ? <ActionButton label="Trận thi đấu · Fight Camp" variant="secondary" onPress={() => router.push("/(coach)/fight-camp" as never)} /> : null}
        <SearchBar value={search} onChangeText={setSearch} placeholder={coachRo.fighters.search} />
        {statusFilter ? (
          <ScrollView ref={chipRow} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipRow}>
            <FilterSelect mutedColor={p.filterMuted} label={coachRo.fighters.weightFilter} value={wc} onChange={setWc} options={options} allValue="" style={styles.chip} />
            <FilterSelect mutedColor={p.filterMuted} label={coachRo.fighters.statusFilter} value={ms} onChange={setMs} options={statusOptions} allValue="" style={styles.chip} />
          </ScrollView>
        ) : (
          <FilterSelect mutedColor={p.filterMuted} label={coachRo.fighters.weightFilter} value={wc} onChange={setWc} options={options} allValue="" />
        )}

        {list.error ? (
          <ConnectionBanner error={list.error} onRetry={() => void list.reload()} retrying={list.loading} hasData={list.items.length > 0} />
        ) : null}

        {firstLoad && !list.error ? skeleton ? <RowSkeletons count={5} height={96} /> : null : null}

        {empty ? (
          <MessageCard
            icon="fighters"
            title={filtered ? coachRo.fighters.emptyFiltered : coachRo.fighters.emptyTitle}
            description={filtered ? coachRo.fighters.emptyFilteredDesc : coachRo.fighters.emptyDesc}
          >
            {filtered ? (
              <ActionButton
                label={coachRo.fighters.clear}
                variant="secondary"
                icon="close"
                onPress={() => {
                  setSearch("");
                  setWc("");
                  setMs("");
                }}
              />
            ) : null}
          </MessageCard>
        ) : null}

        {list.items.length > 0 ? (
          <Stack>
            {list.items.map((f) => {
              const name = fighterName(f);
              return (
                <RoRow
                  key={f.id}
                  leading={<Avatar name={name} uri={f.profileImageUrl} />}
                  title={name}
                  lines={[weightLabels[f.weightClass] ?? f.weightClass, f.gym ?? ""].filter(Boolean)}
                  chip={MEDICAL_CHIP[f.currentMedicalStatus]}
                  onPress={() => go(detailPath, f.id)}
                />
              );
            })}
            {list.hasNext ? <LoadMore onPress={list.loadMore} loading={list.loadingMore} /> : null}
          </Stack>
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
