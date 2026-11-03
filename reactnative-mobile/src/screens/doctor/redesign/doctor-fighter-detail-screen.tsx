import { useCallback, useRef, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { doctorRoApi } from "@/api/doctor-ro";
import type { PublicFighter } from "@/api/types";
import { doctorRo } from "@/i18n/doctor-ro";
import { coachRo } from "@/i18n/coach-ro";
import { vi } from "@/i18n/vi";
import { fighterName, MEDICAL_CHIP } from "@/screens/coach/readonly/ro-format";
import { Avatar, RoCard, RoScreen, RowSkeletons, StatusChip, Stack } from "@/screens/coach/readonly/ro-ui";
import { ActionButton, ConnectionBanner, MessageCard, TEXT, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";
import { headerFacts } from "@/screens/doctor/detail/detail-format";
import { DetailTabs } from "@/screens/doctor/detail/detail-ui";
import { AiTab } from "@/screens/doctor/detail/ai-tab";
import { aiText } from "@/screens/doctor/detail/ai-format";
import { ExamsTab, HistoryTab, OverviewTab, WIDE_MIN } from "@/screens/doctor/detail/doctor-detail-tabs";

import { useDoctorRoster } from "./doctor-roster";
import { ot } from "@/i18n/one-tap";
import { useEndAssignment, useOptionalSession } from "@/screens/one-tap/status-actions";
import { MoreMenu } from "@/screens/one-tap/video-actions";

const t = doctorRo.detail2;
type TabKey = "overview" | "exams" | "history" | "ai";

function DoctorFighterHeader({ f }: { f: PublicFighter }) {
  const p = useFighterPalette();
  const facts = headerFacts(f);
  const weight = (vi.weightClass as Record<string, string>)[f.weightClass] ?? "";
  return (
    <RoCard>
      <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
        <Avatar name={fighterName(f)} uri={f.profileImageUrl} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[TEXT.cardTitle, { color: p.ink }]}>{fighterName(f)}</Text>
          <Text style={[TEXT.detail, { color: p.ink }]}>{[weight, f.gym ?? ""].filter(Boolean).join(" · ")}</Text>
          {facts.line ? <Text style={[TEXT.detail, { color: p.ink }]}>{facts.line}</Text> : null}
          {facts.nationality ? <Text style={[TEXT.detail, { color: p.ink }]}>{`${coachRo.detail.nationality}: ${facts.nationality}`}</Text> : null}
        </View>
      </View>
      <StatusChip spec={MEDICAL_CHIP[f.currentMedicalStatus]} />
    </RoCard>
  );
}

/**
 * Chi tiết võ sĩ cho Doctor (doctor-detail-v2, phần A): đầu hồ sơ đầy đủ + 3 tab Tổng quan / Khám / Hồ sơ.
 * Thông tin võ sĩ lấy từ danh sách phụ trách (bác sĩ không có quyền GET /fighters/:id).
 * API: /fighters/:id/medical, /medical-examinations, /medical-review-requests, /medical/history, /doctors.
 */
export function DoctorFighterDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const fighterId = typeof id === "string" ? id : "";
  const router = useRouter();
  const p = useFighterPalette();
  const wide = useWindowDimensions().width >= WIDE_MIN;
  const roster = useDoctorRoster();
  const [tab, setTab] = useState<TabKey>("overview");
  const binds = useRef<Record<string, (() => Promise<unknown>) | null>>({});
  const bind = useCallback((key: string, fn: (() => Promise<unknown>) | null) => {
    binds.current[key] = fn;
  }, []);

  const loadDossier = useCallback(() => doctorRoApi.getDossier(fighterId), [fighterId]);
  const f = roster.items.find((row) => row.id === fighterId) ?? null;
  const enabled = roster.enabled && !!f;
  const dossier = useLoad(enabled, `dossier:${fighterId}`, loadDossier, { keepOnError: true });
  const waiting = !f && (!roster.loaded || roster.loading) && !roster.error;
  const skeleton = useDelayedFlag(waiting);
  const missing = !f && !waiting && !roster.error;
  const openCount = dossier.data?.openReviewRequests.length ?? 0;

  // Kết thúc phụ trách: chỉ phân công đang hiệu lực của chính bác sĩ đăng nhập (máy chủ trả 403 nếu không phải).
  const session = useOptionalSession();
  const me = session.profileId;
  const loadAssign = useCallback(() => doctorRoApi.listDoctors(fighterId, { page: 1, limit: 50 }), [fighterId]);
  const assigns = useLoad(enabled, `own-assign:${fighterId}`, loadAssign, { keepOnError: true });
  const own = ownAssignment(assigns.data?.data ?? [], me, session.isDemo);
  const end = useEndAssignment({ kind: "doctor", fighterId, own: true, onDone: () => back() });

  const refresh = useCallback(async () => {
    await Promise.all([roster.refresh(), dossier.refresh(), tab === "overview" ? null : binds.current[tab]?.()]);
  }, [roster, dossier, tab]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(doctor)/vo-si" as never));

  // Con trực tiếp của ScrollView: [thông báo, đầu hồ sơ, thanh tab (ghim), nội dung] — thứ tự cố định để ghim đúng chỉ số 2.
  return (
    <RoScreen
      title={doctorRo.detail.title}
      back
      onRefresh={refresh}
      refreshing={waiting}
      wide={wide}
      stickyHeaderIndices={f ? [2] : undefined}
      trailing={own ? <MoreMenu items={[{ key: "end", label: ot.endOwn, icon: "ban", danger: true, onPress: () => end.open(own.id, "") }]} /> : undefined}
    >
      <Stack>
        {roster.error && !f ? <ConnectionBanner error={roster.error} onRetry={roster.reload} retrying={roster.loading} hasData={false} /> : null}
        {dossier.error && dossier.data ? <ConnectionBanner error={dossier.error} onRetry={dossier.reload} retrying={dossier.loading} hasData /> : null}
        {waiting && skeleton ? <RowSkeletons count={2} height={120} /> : null}
        {missing ? (
          <MessageCard icon="fighters" title={doctorRo.detail.notFoundTitle} description={doctorRo.detail.notFoundDesc}>
            <ActionButton label={doctorRo.detail.back} variant="secondary" icon="back" onPress={back} />
          </MessageCard>
        ) : null}
      </Stack>
      {f ? <DoctorFighterHeader f={f} /> : <View />}
      {f ? (
        <View style={{ backgroundColor: p.bg, marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 8, marginVertical: -8 }}>
          <DetailTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "overview", label: t.tabs.overview },
              { key: "exams", label: t.tabs.exams, badge: openCount, a11y: openCount ? t.tabBadge(t.tabs.exams, openCount) : undefined },
              { key: "history", label: t.tabs.history },
              { key: "ai", label: aiText.tab },
            ]}
          />
        </View>
      ) : (
        <View />
      )}
      {f ? (
        <View>
          {tab === "overview" ? <OverviewTab fighterId={f.id} dossier={dossier} enabled={enabled} onSeeAllAi={() => setTab("ai")} /> : null}
          {tab === "exams" ? <ExamsTab fighterId={f.id} enabled={enabled} bind={bind} /> : null}
          {tab === "history" ? <HistoryTab fighterId={f.id} enabled={enabled} bind={bind} /> : null}
          {tab === "ai" ? <AiTab fighterId={f.id} enabled={enabled} bind={bind} /> : null}
        </View>
      ) : (
        <View />
      )}
      {end.sheet}
    </RoScreen>
  );
}

/** Phân công đang hiệu lực của chính mình (demo: phân công đang hiệu lực đầu tiên). */
export function ownAssignment<T extends { doctorId: string; endsAt: string | null }>(rows: readonly T[], me: string | null, demo: boolean): T | null {
  const current = rows.filter((r) => r.endsAt == null);
  return current.find((r) => r.doctorId === me) ?? (demo ? current[0] ?? null : null);
}
