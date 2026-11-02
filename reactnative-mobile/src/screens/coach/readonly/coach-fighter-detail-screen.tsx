import { useCallback, useRef, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { coachApi } from "@/api/coach";
import { WeightChart, type WeightPoint } from "@/components/visuals/charts";
import {
  clearanceTypeLabel,
  eligibilityReasonLabel,
  jointLabel,
  jointStateLabel,
  measurementContextLabel,
  severityLabel,
} from "@/components/medical/medical-format";
import { BodyMapSection, bodyText } from "@/components/body3d/body-map-section";
import { Icon } from "@/components/icon";
import { adminRo } from "@/i18n/admin-ro";
import { AiAlertsBlock, RecentVideosBlock } from "@/screens/video-ai/ai-ui";
import { useAiEnabled } from "@/screens/video-ai/ai-data";
import { coachRo } from "@/i18n/coach-ro";
import { vi } from "@/i18n/vi";
import { ActionButton, ConnectionBanner, MessageCard, TEXT, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";
import { useThemePreference } from "@/theme";
import {
  ageFromDob,
  fighterName,
  kgText,
  MEDICAL_CHIP,
  planPct,
  PLAN_CHIP,
  vnDate,
  weightChange,
  weightSeries,
} from "./ro-format";
import { Avatar, InfoLine, LoadMore, ProgressBar, RoCard, RoRow, RoScreen, RowSkeletons, SegmentTabs, StatusChip, Stack, useGo } from "./ro-ui";
import { SessionGroups } from "./session-groups";
import { useSessionRole } from "@/session/session-context";
import { useCoachEnabled } from "./use-coach";
import { usePagedList } from "./use-paged-list";

type TabKey = "overview" | "weight" | "schedule" | "medical";
const TABS = [
  { key: "overview", label: coachRo.detail.tabs.overview },
  { key: "weight", label: coachRo.detail.tabs.weight },
  { key: "schedule", label: coachRo.detail.tabs.schedule },
  { key: "medical", label: coachRo.detail.tabs.medical },
] as const;

const weightLabels = vi.weightClass as Record<string, string>;
const stanceLabels = (vi as unknown as { stance?: Record<string, string> }).stance ?? {};

/** C-2: hồ sơ võ sĩ (chỉ đọc) với 4 tab. */
export function CoachFighterDetailScreen({ admin = false, doctorsPath }: { admin?: boolean; doctorsPath?: string } = {}) {
  const { id, tab: tabParam } = useLocalSearchParams<{ id?: string; tab?: string }>();
  const fighterId = typeof id === "string" ? id : "";
  const enabled = useCoachEnabled();
  const router = useRouter();
  const go = useGo();
  const p = useFighterPalette();
  const [tab, setTab] = useState<TabKey>(tabParam === "medical" ? "medical" : "overview");
  const tabRefresh = useRef<(() => Promise<unknown>) | null>(null);
  const bind = useCallback((fn: (() => Promise<unknown>) | null) => {
    tabRefresh.current = fn;
  }, []);

  const run = useCallback(() => coachApi.getFighter(fighterId), [fighterId]);
  const fighter = useLoad(enabled && Boolean(fighterId), `fd|${fighterId}`, run, { keepOnError: true });
  const skeleton = useDelayedFlag(fighter.loading && !fighter.data);

  const refresh = useCallback(async () => {
    await Promise.all([fighter.refresh(), tabRefresh.current?.()]);
  }, [fighter]);

  const f = fighter.data;
  const missing = !fighterId;

  return (
    <RoScreen title={coachRo.detail.title} back onRefresh={refresh} refreshing={fighter.loading && !f}>
      <Stack>
        {fighter.error ? (
          <ConnectionBanner error={fighter.error} onRetry={fighter.reload} retrying={fighter.loading} hasData={Boolean(f)} />
        ) : null}
        {missing ? (
          <MessageCard icon="fighters" title={coachRo.detail.notFoundTitle} description={coachRo.detail.notFoundDesc}>
            <ActionButton label={coachRo.detail.back} variant="secondary" icon="back" onPress={() => router.back()} />
          </MessageCard>
        ) : null}
        {!f && !fighter.error && fighter.loading && skeleton ? <RowSkeletons count={2} height={120} /> : null}
        {f ? (
          <>
            <FighterHeaderCard f={f} />
            {admin && doctorsPath ? (
              <RoRow
                title={adminRo.doctors.rowTitle}
                lines={[adminRo.doctors.rowDesc]}
                onPress={() => go(doctorsPath, f.id)}
              />
            ) : null}
            <SegmentTabs tabs={TABS} value={tab} onChange={setTab} />
            {tab === "overview" ? <OverviewTab key="o" fighterId={f.id} f={f} bind={bind} admin={admin} /> : null}
            {tab === "weight" ? <WeightTab key="w" fighterId={f.id} bind={bind} /> : null}
            {tab === "schedule" ? <ScheduleTab key="s" fighterId={f.id} bind={bind} admin={admin} /> : null}
            {tab === "medical" ? <MedicalTab key="m" fighterId={f.id} fallback={f.currentMedicalStatus} bind={bind} /> : null}
          </>
        ) : null}
      </Stack>
    </RoScreen>
  );
}

/** Thẻ đầu hồ sơ: avatar, tên, hạng cân · chiều cao, CLB, chip y tế (dùng lại ở chi tiết võ sĩ của Doctor). */
export function FighterHeaderCard({ f }: { f: import("@/api/types").PublicFighter }) {
  const p = useFighterPalette();
  return (
    <RoCard>
      <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
        <Avatar name={fighterName(f)} uri={f.profileImageUrl} size={64} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[TEXT.cardTitle, { color: p.ink }]}>{fighterName(f)}</Text>
          <Text style={[TEXT.body, { color: p.ink }]}>
            {[weightLabels[f.weightClass] ?? f.weightClass, f.heightCm ? coachRo.detail.height(f.heightCm) : ""].filter(Boolean).join(" · ")}
          </Text>
          {f.gym ? <Text style={[TEXT.detail, { color: p.ink }]}>{f.gym}</Text> : null}
        </View>
      </View>
      <StatusChip spec={MEDICAL_CHIP[f.currentMedicalStatus]} />
    </RoCard>
  );
}

export type Bind = (fn: (() => Promise<unknown>) | null) => void;

/** Nguồn dữ liệu cho tab Y tế: Coach/Admin dùng coachApi; Doctor truyền API của mình. */
export type MedicalSource = Pick<typeof coachApi, "getMedical" | "getMedicalSummary">;

function useTabLoad<T>(enabled: boolean, key: string, run: () => Promise<T>, bind: Bind) {
  const res = useLoad(enabled, key, run, { keepOnError: true });
  const refreshRef = useRef(res.refresh);
  refreshRef.current = res.refresh;
  const stable = useCallback(() => refreshRef.current(), []);
  bind(stable);
  const skeleton = useDelayedFlag(res.loading && !res.data);
  return { ...res, skeleton };
}

function TabState({ error, reload, loading, hasData, skeleton, height = 120 }: { error: string; reload: () => void; loading: boolean; hasData: boolean; skeleton: boolean; height?: number }) {
  return (
    <>
      {error ? <ConnectionBanner error={error} onRetry={reload} retrying={loading} hasData={hasData} /> : null}
      {!hasData && !error && loading && skeleton ? <RowSkeletons count={2} height={height} /> : null}
    </>
  );
}

/** "Xem tất cả" video/cảnh báo AI: HLV → tab Video (lọc sẵn võ sĩ); Admin → thư viện / danh sách phân tích. */
function useOpenVideos() {
  const router = useRouter();
  return (admin: boolean, fighterId: string, seg: "library" | "review") => {
    if (admin) {
      router.push({ pathname: seg === "library" ? "/(admin)/quan-tri/thu-vien-video" : "/(admin)/quan-tri/phan-tich-ai", params: { fighterId, status: "ALL" } } as never);
      return;
    }
    router.navigate({ pathname: "/(coach)/video-analysis", params: { fighterId, seg, t: String(Date.now()) } } as never);
  };
}

function OverviewTab({ fighterId, f, bind, admin }: { fighterId: string; f: import("@/api/types").PublicFighter; bind: Bind; admin: boolean }) {
  const enabled = useCoachEnabled();
  const go = useGo();
  const p = useFighterPalette();
  const run = useCallback(
    async () => {
      const [coaches, plans] = await Promise.all([
        coachApi.listCoaches(fighterId),
        coachApi.listPlans({ fighterId, isActive: true, limit: 1 }),
      ]);
      return { coaches, plan: plans.data[0] ?? null };
    },
    [fighterId],
  );
  const { data, error, reload, loading, refresh, skeleton } = useTabLoad(enabled, `ov|${fighterId}`, run, bind);
  void refresh;
  const aiEnabled = useAiEnabled();
  const openVideos = useOpenVideos();
  const age = ageFromDob(f.dateOfBirth);
  const stance = f.dominantStance ? stanceLabels[f.dominantStance] ?? "" : "";
  return (
    <Stack>
      <RoCard title={coachRo.detail.profile}>
        <InfoLine label={coachRo.detail.dob} value={`${vnDate(f.dateOfBirth)}${age != null ? ` · ${coachRo.detail.age(age)}` : ""}`} />
        {f.nationality ? <InfoLine label={coachRo.detail.nationality} value={f.nationality} /> : null}
        {stance ? <InfoLine label={coachRo.detail.stance} value={stance} /> : null}
        {f.reachCm ? <InfoLine label={coachRo.detail.reach} value={coachRo.detail.height(f.reachCm)} /> : null}
      </RoCard>
      <TabState error={error} reload={reload} loading={loading} hasData={Boolean(data)} skeleton={skeleton} />
      {data ? (
        <>
          <RoCard title={coachRo.detail.coaches}>
            {data.coaches.length === 0 ? (
              <Text style={[TEXT.body, { color: p.ink }]}>{coachRo.detail.noCoach}</Text>
            ) : (
              data.coaches.map((c) => (
                <InfoLine
                  key={c.id}
                  label={c.endsAt ? coachRo.detail.coachEnded : coachRo.detail.coachActive}
                  value={`${c.coachName ?? coachRo.detail.coaches} · ${coachRo.detail.since(vnDate(c.startsAt))}`}
                />
              ))
            )}
          </RoCard>
          <RoCard title={coachRo.detail.activePlan}>
            {data.plan ? (
              <RoRow
                title={data.plan.title}
                lines={[coachRo.phase[data.plan.phase], `${planPct(data.plan)}%`]}
                chip={PLAN_CHIP[data.plan.status]}
                onPress={admin ? undefined : () => go("/(coach)/plans/chi-tiet", data.plan!.id)}
              />
            ) : (
              <Text style={[TEXT.body, { color: p.ink }]}>{coachRo.detail.noPlan}</Text>
            )}
          </RoCard>
        </>
      ) : null}
      <RecentVideosBlock fighterId={fighterId} enabled={aiEnabled} onSeeAll={() => openVideos(admin, fighterId, "library")} />
    </Stack>
  );
}

function WeightTab({ fighterId, bind }: { fighterId: string; bind: Bind }) {
  const enabled = useCoachEnabled();
  const p = useFighterPalette();
  const { colors } = useThemePreference();
  const run = useCallback(() => coachApi.listMeasurements(fighterId, { limit: 50 }), [fighterId]);
  const { data, error, reload, loading, skeleton } = useTabLoad(enabled, `wt|${fighterId}`, run, bind);
  const series = data ? weightSeries(data.data) : [];
  const latest = series[series.length - 1];
  const delta = weightChange(series);
  const points: WeightPoint[] = series.map((m) => ({ id: m.id, weightKg: m.weightKg, measuredAt: m.measuredAt }));
  return (
    <Stack>
      <TabState error={error} reload={reload} loading={loading} hasData={Boolean(data)} skeleton={skeleton} />
      {data && !latest ? <MessageCard icon="body" title={coachRo.weight.emptyTitle} description={coachRo.weight.emptyDesc} /> : null}
      {latest ? (
        <>
          <RoCard title={coachRo.weight.latest}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text style={[TEXT.bigNumber, { color: p.ink }]}>{kgText(latest.weightKg)}</Text>
              <Text style={[TEXT.kg, { color: p.ink }]}>kg</Text>
            </View>
            <Text style={[TEXT.body, { color: p.ink }]}>{coachRo.weight.on(vnDate(latest.measuredAt))}</Text>
            {delta != null ? (
              <Text style={[TEXT.body, { color: p.ink }]}>
                {delta === 0 ? coachRo.weight.same : coachRo.weight.change(`${delta > 0 ? "+" : "−"}${kgText(Math.abs(delta))}`)}
              </Text>
            ) : null}
          </RoCard>
          {series.length >= 2 ? (
            <RoCard title={coachRo.weight.history}>
              <WeightChart colors={colors} points={points} unit="kg" hideLatest />
            </RoCard>
          ) : null}
          <Stack gap={8}>
            {[...series].reverse().map((m) => (
              <RoRow
                key={m.id}
                title={`${kgText(m.weightKg)} kg`}
                lines={[`${vnDate(m.measuredAt)} · ${measurementContextLabel(m.measurementContext)}`]}
              />
            ))}
          </Stack>
        </>
      ) : null}
    </Stack>
  );
}

function ScheduleTab({ fighterId, bind, admin }: { fighterId: string; bind: Bind; admin: boolean }) {
  const enabled = useCoachEnabled();
  const go = useGo();
  const list = usePagedList(enabled, `fs|${fighterId}`, (page) => coachApi.listFighterSessions(fighterId, { page, limit: 20 }));
  const refreshRef = useRef(list.refresh);
  refreshRef.current = list.refresh;
  bind(useCallback(() => refreshRef.current(), []));
  const firstLoad = !list.loaded || (list.loading && list.items.length === 0);
  const skeleton = useDelayedFlag(firstLoad && !list.error);
  const empty = list.loaded && !list.loading && !list.error && list.items.length === 0;
  return (
    <Stack>
      {list.error ? <ConnectionBanner error={list.error} onRetry={() => void list.reload()} retrying={list.loading} hasData={list.items.length > 0} /> : null}
      {firstLoad && !list.error && skeleton ? <RowSkeletons count={3} height={96} /> : null}
      {empty ? <MessageCard icon="schedule" title={coachRo.schedule.emptyTitle} description={coachRo.schedule.emptyDesc} /> : null}
      {list.items.length > 0 ? <SessionGroups sessions={list.items} onOpen={admin ? undefined : (sid) => go("/(coach)/schedule/chi-tiet", sid)} /> : null}
      {list.hasNext ? <LoadMore onPress={list.loadMore} loading={list.loadingMore} /> : null}
    </Stack>
  );
}

export function MedicalTab({
  fighterId,
  fallback,
  bind,
  source,
  enabled: enabledOverride,
  clearanceTitle,
}: {
  fighterId: string;
  fallback: import("@/api/types").MedicalStatus;
  bind: Bind;
  source?: MedicalSource;
  enabled?: boolean;
  /** Tiêu đề thẻ giấy phép (mặc định của Coach). */
  clearanceTitle?: string;
}) {
  const coachEnabled = useCoachEnabled();
  const enabled = enabledOverride ?? coachEnabled;
  const api = source ?? coachApi;
  const p = useFighterPalette();
  const aiEnabled = useAiEnabled();
  const openVideos = useOpenVideos();
  const isAdminRole = useSessionRole() === "ADMIN";
  const { width } = useWindowDimensions();
  const run = useCallback(async () => {
    const [dossier, summary] = await Promise.allSettled([api.getMedical(fighterId), api.getMedicalSummary(fighterId)]);
    if (dossier.status === "rejected" && summary.status === "rejected") throw dossier.reason;
    return {
      dossier: dossier.status === "fulfilled" ? dossier.value : null,
      summary: summary.status === "fulfilled" ? summary.value : null,
    };
  }, [api, fighterId]);
  const { data, error, reload, loading, skeleton } = useTabLoad(enabled, `md|${fighterId}`, run, bind);
  const eligibility = data?.dossier?.eligibility.training;
  const injuries = data?.summary?.activeInjuries ?? [];
  const validClearances = data?.dossier
    ? data.dossier.activeClearances.filter((c) => c.isCurrentlyValid)
    : data?.summary?.activeClearance
      ? [data.summary.activeClearance]
      : [];
  return (
    <Stack>
      <TabState error={error} reload={reload} loading={loading} hasData={Boolean(data)} skeleton={skeleton} height={140} />
      {data ? (
        <>
          {eligibility ? (
            <RoCard title={coachRo.medical.training} tone={eligibility.eligible ? undefined : "error"}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name={eligibility.eligible ? "success" : "ban"} size={24} color={eligibility.eligible ? p.success : p.danger} />
                <Text style={[TEXT.bodyBold, { color: p.ink, flex: 1 }]}>
                  {eligibility.eligible ? coachRo.medical.eligible : coachRo.medical.notEligible}
                </Text>
              </View>
              {!eligibility.eligible && eligibility.reasons.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <Text style={[TEXT.captionBold, { color: p.ink }]}>{coachRo.medical.reasons}</Text>
                  {eligibility.reasons.map((r) => (
                    <Text key={r} style={[TEXT.body, { color: p.ink }]}>
                      • {eligibilityReasonLabel(r)}
                    </Text>
                  ))}
                </View>
              ) : null}
            </RoCard>
          ) : null}
          {data.summary ? (
            <RoCard title={bodyText.title}>
              <BodyMapSection
                injuries={data.summary.activeInjuries}
                jointStates={data.summary.jointStates}
                stateText={jointStateLabel}
                severityText={severityLabel}
                height={width >= 768 ? 460 : 380}
              />
            </RoCard>
          ) : null}
          <RoCard title={coachRo.medical.injuries}>
            {injuries.length === 0 ? (
              <Text style={[TEXT.body, { color: p.ink }]}>{coachRo.medical.noInjury}</Text>
            ) : (
              injuries.map((i) => (
                <InfoLine
                  key={i.id}
                  label={`${jointLabel(i.affectedJoint)} · ${severityLabel(i.severity)}`}
                  value={`${i.injuryType} · ${coachRo.medical.since(vnDate(i.occurredAt))}`}
                />
              ))
            )}
          </RoCard>
          <RoCard title={clearanceTitle ?? coachRo.medical.clearance}>
            {validClearances.length === 0 ? (
              <Text style={[TEXT.body, { color: p.ink }]}>{coachRo.medical.noClearance}</Text>
            ) : (
              validClearances.map((c) => (
                <InfoLine
                  key={c.id}
                  label={clearanceTypeLabel(c.clearanceType)}
                  value={c.validUntil ? coachRo.medical.validUntil(vnDate(c.validUntil)) : coachRo.medical.noEnd}
                />
              ))
            )}
          </RoCard>
          <AiAlertsBlock fighterId={fighterId} enabled={aiEnabled} onSeeAll={() => openVideos(isAdminRole, fighterId, "review")} />
          {!data.dossier || !data.summary ? (
            <MessageCard icon="info" title={coachRo.medical.errorPartial} />
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
