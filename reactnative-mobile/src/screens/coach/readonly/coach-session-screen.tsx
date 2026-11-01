import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { coachApi } from "@/api/coach";
import { sessionTypeName } from "@/components/medical/medical-format";
import { coachRo } from "@/i18n/coach-ro";
import { ActionButton, ConnectionBanner, MessageCard, TEXT, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";
import { dayLabel, durationText, SESSION_CHIP, timeHm, vnDate } from "./ro-format";
import { InfoLine, RoCard, RoRow, RoScreen, RowSkeletons, StatusChip, Stack, useGo } from "./ro-ui";
import { useCoachEnabled } from "./use-coach";
import type { SessionStatusValue } from "@/api/one-tap.types";
import { useSessionActions } from "@/screens/one-tap/status-actions";
import { MoreMenu } from "@/screens/one-tap/video-actions";

/** C-6: chi tiết buổi tập (chỉ đọc). Mở bằng /schedule/chi-tiet?id=... */
export function CoachSessionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const sid = typeof id === "string" ? id : "";
  const enabled = useCoachEnabled() && Boolean(sid);
  const router = useRouter();
  const go = useGo();
  const p = useFighterPalette();

  const run = useCallback(async () => {
    const session = await coachApi.getSession(sid);
    const [fighter, plan] = await Promise.all([
      coachApi.getFighter(session.fighterId).catch(() => null),
      session.planId ? coachApi.getPlan(session.planId).catch(() => null) : Promise.resolve(null),
    ]);
    return { session, fighter, plan };
  }, [sid]);
  const { data, error, loading, reload, refresh } = useLoad(enabled, `sd|${sid}`, run, { keepOnError: true });
  const skeleton = useDelayedFlag(loading && !data);

  // Trạng thái mới sau khi đổi (máy chủ trả bản ghi; giữ cục bộ tới lần tải lại kế tiếp).
  const [override, setOverride] = useState<{ sid: string; status: SessionStatusValue } | null>(null);
  const loaded = data?.session;
  const s = loaded && override?.sid === loaded.id ? { ...loaded, status: override.status } : loaded;
  const actions = useSessionActions({
    sessionId: sid,
    status: (s?.status ?? "COMPLETED") as SessionStatusValue,
    onChanged: (status) => setOverride({ sid, status }),
    onReload: () => {
      setOverride(null);
      reload();
    },
    onOpenMedical: () => {
      if (s) router.push({ pathname: "/(coach)/fighters/chi-tiet", params: { id: s.fighterId, tab: "medical" } } as never);
    },
  });
  return (
    <RoScreen title={coachRo.session.title} back onRefresh={refresh} refreshing={loading && !data} trailing={s ? <MoreMenu items={actions.more} /> : undefined}>
      <Stack>
        {error ? <ConnectionBanner error={error} onRetry={reload} retrying={loading} hasData={Boolean(data)} /> : null}
        {!sid ? (
          <MessageCard icon="schedule" title={coachRo.session.notFoundTitle} description={coachRo.session.notFoundDesc}>
            <ActionButton label={coachRo.session.back} variant="secondary" icon="back" onPress={() => router.back()} />
          </MessageCard>
        ) : null}
        {!data && !error && loading && skeleton ? <RowSkeletons count={3} height={120} /> : null}
        {s ? (
          <>
            <RoCard>
              <Text style={[TEXT.cardTitle, { color: p.ink }]}>{s.title}</Text>
              <StatusChip spec={SESSION_CHIP[s.status]} />
              <InfoLine label={coachRo.session.when} value={`${dayLabel(s.scheduledAt)} · ${vnDate(s.scheduledAt)} · ${timeHm(s.scheduledAt)}`} />
              <InfoLine label={coachRo.session.type} value={sessionTypeName(s.sessionType)} />
              {s.location ? <InfoLine label={coachRo.session.where} value={s.location} /> : null}
              {data?.fighter ? <InfoLine label={coachRo.session.fighter} value={`${data.fighter.firstName} ${data.fighter.lastName}`.trim()} /> : null}
              {s.cancellationReason ? <InfoLine label={coachRo.session.cancel} value={s.cancellationReason} /> : null}
              {actions.primary}
            </RoCard>
            <RoCard>
              <InfoLine label={coachRo.session.planned} value={durationText(s.plannedDurationSec) ?? coachRo.session.notDone} />
              <InfoLine label={coachRo.session.actual} value={durationText(s.actualDurationSec) ?? coachRo.session.notDone} />
              <InfoLine label={coachRo.session.rounds} value={String(s.roundCount)} />
              <InfoLine label={coachRo.session.rpe} value={s.reportedRpe != null ? `${s.reportedRpe}/10` : coachRo.session.rpeNone} />
            </RoCard>
            <RoCard title={coachRo.session.coachNotes}>
              <Text style={[TEXT.body, { color: p.ink }]}>{s.coachNotes ?? coachRo.session.noNotes}</Text>
            </RoCard>
            <RoCard title={coachRo.session.plan}>
              {data?.plan ? (
                <RoRow title={data.plan.title} lines={[coachRo.phase[data.plan.phase]]} onPress={() => go("/(coach)/plans/chi-tiet", data.plan!.id)} />
              ) : (
                <Text style={[TEXT.body, { color: p.ink }]}>{coachRo.session.noPlan}</Text>
              )}
            </RoCard>
            <View />
          </>
        ) : null}
      </Stack>
      {actions.sheets}
    </RoScreen>
  );
}
