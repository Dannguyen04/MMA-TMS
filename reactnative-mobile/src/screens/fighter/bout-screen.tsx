import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ACTIVE_BOUT_STATES, pickActiveBout, type Bout, type BoutRequirement, type RequirementStatus } from "@/api/bouts";
import { FilterSelect } from "@/components/filter-sheet";
import { Icon } from "@/components/icon";
import { fighterBout as t } from "@/i18n/fighter-bout";
import { fighterHref } from "@/navigation/role-href";
import {
  ActionButton,
  CardSkeleton,
  ConnectionBanner,
  EmptyBouts,
  SPEC,
  TEXT,
  useDelayedFlag,
} from "@/screens/fighter/bout-states";
import { BoutWeightCard } from "@/screens/fighter/bout-weight-card";
import { FighterScreen } from "@/screens/fighter/screen";
import { useFighterPalette, type FighterPalette } from "@/screens/fighter/redesign/palette";
import { setSelectedBoutId, useSelectedBoutId } from "@/screens/fighter/selected-bout";
import { useBouts } from "@/screens/fighter/use-active-bout";
import { vnDaysUntil, vnShortDate, vnTimeAndDate } from "@/utils/vn-date";

function requirementTone(colors: FighterPalette, status: RequirementStatus) {
  switch (status) {
    case "CONFIRMED":
      return { fg: colors.success, bg: colors.successSoft, icon: "success" as const };
    case "REJECTED":
      return { fg: colors.danger, bg: colors.dangerSoft, icon: "xCircle" as const };
    case "PROVIDED":
      return { fg: colors.ink, bg: colors.surface2, icon: "send" as const };
    default:
      return { fg: colors.ink, bg: colors.surface2, icon: "circle" as const };
  }
}

function RequirementRow({ item, last }: { item: BoutRequirement; last: boolean }) {
  const colors = useFighterPalette();
  const tone = requirementTone(colors, item.status);
  return (
    <View
      accessibilityLabel={`${t.requirements.kind[item.kind]}: ${t.requirements.status[item.status]}`}
      style={[styles.reqRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }]}
    >
      <Icon name={tone.icon} size={24} color={tone.fg} />
      <Text style={[TEXT.body, styles.reqLabel, { color: colors.ink }]}>{t.requirements.kind[item.kind]}</Text>
      <View style={[styles.reqChip, { backgroundColor: tone.bg }]}>
        <Text style={[TEXT.captionBold, { color: tone.fg }]}>{t.requirements.status[item.status]}</Text>
      </View>
    </View>
  );
}

function Hero({ bout }: { bout: Bout }) {
  const colors = useFighterPalette();
  const days = vnDaysUntil(bout.weighInAt);
  return (
    <View style={[styles.hero, { backgroundColor: colors.agenda }]}>
      <View style={[styles.stateChip, { backgroundColor: colors.day }]}>
        <Text style={[TEXT.captionBold, { color: colors.agendaInk }]}>{t.state[bout.status]}</Text>
      </View>
      <Text accessibilityRole="header" style={[TEXT.cardTitle, { color: colors.agendaInk }]}>
        {t.weigh.forBout(bout.opponentName)}
      </Text>
      <Text style={[TEXT.body, { color: colors.agendaInk }]}>{bout.eventName}</Text>
      <View style={[styles.heroFacts, { borderTopColor: colors.day }]}>
        <Fact label={t.weighInAt} value={vnTimeAndDate(bout.weighInAt)} />
        <Fact label={t.fightAt} value={vnTimeAndDate(bout.scheduledAt)} />
      </View>
      <Text style={[TEXT.body, { color: colors.agendaInk }]}>{bout.venue}</Text>
      {ACTIVE_BOUT_STATES.includes(bout.status) && bout.status !== "WEIGHED_IN" ? (
        <View style={[styles.countdown, { backgroundColor: colors.accent }]}>
          <Text style={[TEXT.bodyBold, { color: colors.onAccent }]}>{t.weighInIn(days)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const colors = useFighterPalette();
  return (
    <View style={styles.fact}>
      <Text style={[TEXT.caption, { color: colors.agendaInk }]}>{label}</Text>
      <Text style={[TEXT.bodyBold, { color: colors.agendaInk }]}>{value}</Text>
    </View>
  );
}

/** Skeleton đúng kích thước 3 thẻ thật (hero · cân nặng · việc cần xong), đo ở 412 dp, thẻ cân nặng khi chưa vượt hạng. */
export const BOUT_SKELETON_HEIGHTS = { hero: 257, weight: 466, requirements: 314 };
export function BoutSkeleton() {
  return (
    <View style={styles.stack}>
      <CardSkeleton height={BOUT_SKELETON_HEIGHTS.hero} />
      <CardSkeleton height={BOUT_SKELETON_HEIGHTS.weight} />
      <CardSkeleton height={BOUT_SKELETON_HEIGHTS.requirements} />
    </View>
  );
}

export function FighterBoutScreen() {
  const colors = useFighterPalette();
  const router = useRouter();
  const selectedId = useSelectedBoutId();
  const { data, error, loading, reload, refresh } = useBouts(selectedId);

  // Quay lại từ màn ghi cân: tải lại âm thầm để thấy số cân mới.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void Promise.resolve(refreshRef.current()).catch(() => undefined);
    }, []),
  );

  const active = data?.active ?? null;
  const track = data?.track ?? null;
  const showSkeleton = useDelayedFlag(loading && !data && !error);
  const canWeigh = !!active && ACTIVE_BOUT_STATES.includes(active.status);
  const options = (data?.bouts ?? []).map((bout) => ({
    value: bout.id,
    label: `${bout.opponentName} · ${vnShortDate(bout.weighInAt)}`,
    hint: t.state[bout.status],
  }));

  return (
    <FighterScreen title={t.title} onBack specLayout refreshing={loading && !data} onRefresh={refresh}>
      {error ? <ConnectionBanner error={error} onRetry={reload} retrying={loading} hasData={!!data} /> : null}
      {showSkeleton ? <BoutSkeleton /> : null}
      {data && !active ? <EmptyBouts onAction={() => router.replace(fighterHref.home)} /> : null}
      {data && active && track ? (
        <View style={styles.stack}>
          {options.length > 1 ? (
            <FilterSelect label={t.pickBout} options={options} value={active.id}
              allValue={pickActiveBout(data?.bouts ?? [])?.id ?? active.id}
              onChange={setSelectedBoutId}
            />
          ) : null}
          <Hero bout={active} />
          <BoutWeightCard
            bout={active}
            track={track}
            action={
              canWeigh ? (
                <ActionButton
                  label={t.weight.recordToday}
                  icon="edit"
                  onPress={() => router.push({ pathname: "/(fighter)/tran/can-nang", params: { bout: active.id } })}
                />
              ) : null
            }
          />
          <View style={[styles.reqCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[TEXT.cardTitle, { color: colors.ink }]}>{t.requirements.title}</Text>
            {active.requirements.map((item, index) => (
              <RequirementRow key={item.id} item={item} last={index === active.requirements.length - 1} />
            ))}
          </View>
        </View>
      ) : null}
    </FighterScreen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPEC.gap },
  hero: { borderRadius: SPEC.radius, padding: SPEC.card, gap: 8 },
  stateChip: { alignSelf: "flex-start", borderRadius: 99, paddingHorizontal: 8, minHeight: 24, justifyContent: "center" },
  heroFacts: { flexDirection: "row", gap: SPEC.gap, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  fact: { flex: 1 },
  countdown: { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: SPEC.card, paddingVertical: 8 },
  reqCard: { borderWidth: 1, borderRadius: SPEC.radius, padding: SPEC.card, gap: 8 },
  reqRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 56 },
  reqLabel: { flex: 1 },
  reqChip: { borderRadius: 99, paddingHorizontal: 8, minHeight: 24, justifyContent: "center" },
});
