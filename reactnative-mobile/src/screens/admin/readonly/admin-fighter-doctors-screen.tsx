import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { adminApi } from "@/api/admin";
import { coachApi } from "@/api/coach";
import { adminRo } from "@/i18n/admin-ro";
import { ActionButton, ConnectionBanner, MessageCard, TEXT, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { Avatar, LoadMore, RoRow, RoScreen, RowSkeletons, Stack } from "@/screens/coach/readonly/ro-ui";
import { fighterName, vnDate, type ChipSpec } from "@/screens/coach/readonly/ro-format";
import { useCoachEnabled } from "@/screens/coach/readonly/use-coach";
import { usePagedList } from "@/screens/coach/readonly/use-paged-list";
import { doctorRows } from "./admin-format";
import type { CoachAssignment } from "@/api/types";
import { ot } from "@/i18n/one-tap";
import { useEndAssignment } from "@/screens/one-tap/status-actions";
import { MoreMenu } from "@/screens/one-tap/video-actions";

const CURRENT: ChipSpec = { label: adminRo.doctors.current, tone: "success", icon: "success" };
const ENDED: ChipSpec = { label: adminRo.doctors.ended, tone: "neutral", icon: "circle" };

/**
 * A-4 (màn thêm): phụ thuộc endpoint ĐÓNG BĂNG GET /fighters/:id/doctors (qua adminApi.listFighterDoctors).
 * Tắt nhanh bằng ADMIN_FIGHTER_DOCTORS_ENABLED trong admin-flags.ts (route bac-si và dòng liên kết cùng ẩn).
 * Bác sĩ phụ trách một võ sĩ + thời gian phụ trách. Mở bằng /vo-si/bac-si?id=... */
export function AdminFighterDoctorsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const fid = typeof id === "string" ? id : "";
  const enabled = useCoachEnabled() && Boolean(fid);
  const router = useRouter();
  const p = useFighterPalette();
  const [fighter, setFighter] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});

  const list = usePagedList(enabled, `fd|${fid}`, (page) => adminApi.listFighterDoctors(fid, { page, limit: 20 }));
  const load = useCallback(() => {
    if (!enabled) return;
    coachApi.getFighter(fid).then((f) => setFighter(fighterName(f))).catch(() => undefined);
    adminApi
      .listUsers({ role: "DOCTOR", limit: 100 })
      .then((r) =>
        setNames(
          Object.fromEntries(
            r.items.flatMap((u) => (u.profile ? [[u.profile.id, `${u.profile.firstName} ${u.profile.lastName}`.trim()] as const] : [])),
          ),
        ),
      )
      .catch(() => undefined);
  }, [enabled, fid]);
  useEffect(load, [load]);

  const firstLoad = !list.loaded || (list.loading && list.items.length === 0 && !list.error);
  const skeleton = useDelayedFlag(firstLoad);
  const empty = list.loaded && !list.loading && !list.error && list.items.length === 0;
  // Kết thúc phân công (ADMIN: mọi phân công HLV/bác sĩ). Đã kết thúc → đổi chip ngay, không toast.
  const [ended, setEnded] = useState<ReadonlySet<string>>(new Set());
  const markEnded = (aid: string) => setEnded((s) => new Set(s).add(aid));
  const endDoctor = useEndAssignment({ kind: "doctor", fighterId: fid, onDone: markEnded });
  const endCoach = useEndAssignment({ kind: "coach", fighterId: fid, onDone: markEnded });
  const [coaches, setCoaches] = useState<CoachAssignment[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    adminApi.listFighterCoaches(fid).then(setCoaches).catch(() => setCoaches([]));
  }, [enabled, fid]);
  const coachRows = (coaches ?? [])
    .map((c) => ({ id: c.id, name: c.coachName?.trim() || "HLV", current: c.endsAt == null && !ended.has(c.id), from: c.startsAt, to: c.endsAt }))
    .sort((a, b) => Number(b.current) - Number(a.current) || Date.parse(b.from) - Date.parse(a.from));
  const rows = doctorRows(list.items, names).map((r) => (ended.has(r.id) ? { ...r, current: false } : r));

  return (
    <RoScreen title={adminRo.doctors.title} back onRefresh={list.refresh} refreshing={list.loading && list.items.length === 0}>
      <Stack>
        {fighter ? <Text style={[TEXT.cardTitle, { color: p.ink }]}>{fighter}</Text> : null}
        {!fid ? (
          <MessageCard icon="stethoscope" title={adminRo.doctors.notFoundTitle} description={adminRo.doctors.notFoundDesc}>
            <ActionButton label={adminRo.doctors.back} variant="secondary" icon="back" onPress={() => router.back()} />
          </MessageCard>
        ) : null}
        {list.error ? (
          <ConnectionBanner error={list.error} onRetry={() => void list.reload()} retrying={list.loading} hasData={list.items.length > 0} />
        ) : null}
        {firstLoad && !list.error && skeleton ? <RowSkeletons count={3} height={96} /> : null}
        {empty && fid ? <MessageCard icon="stethoscope" title={adminRo.doctors.emptyTitle} description={adminRo.doctors.emptyDesc} /> : null}
        {rows.map((r) => (
          <RoRow
            key={r.id}
            leading={<Avatar name={r.name} />}
            title={r.name}
            lines={[r.to ? adminRo.doctors.range(vnDate(r.from), vnDate(r.to)) : adminRo.doctors.since(vnDate(r.from))]}
            chip={r.current ? CURRENT : ENDED}
          >
            {r.current ? (
              <View style={{ alignItems: "flex-end" }}>
                <MoreMenu items={[{ key: "end", label: ot.endAssign, icon: "ban", danger: true, onPress: () => endDoctor.open(r.id, r.name) }]} />
              </View>
            ) : null}
          </RoRow>
        ))}
        {list.hasNext ? <LoadMore onPress={list.loadMore} loading={list.loadingMore} /> : null}
        {fid && coaches ? (
          <Text accessibilityRole="header" style={[TEXT.cardTitle, { color: p.ink, marginTop: 8 }]}>
            {ot.coachesTitle}
          </Text>
        ) : null}
        {fid && coaches && coachRows.length === 0 ? <Text style={[TEXT.body, { color: p.ink }]}>{ot.noCoaches}</Text> : null}
        {coachRows.map((r) => (
          <RoRow
            key={r.id}
            leading={<Avatar name={r.name} />}
            title={r.name}
            lines={[r.to ? adminRo.doctors.range(vnDate(r.from), vnDate(r.to)) : adminRo.doctors.since(vnDate(r.from))]}
            chip={r.current ? CURRENT : ENDED}
          >
            {r.current ? (
              <View style={{ alignItems: "flex-end" }}>
                <MoreMenu items={[{ key: "end", label: ot.endAssign, icon: "ban", danger: true, onPress: () => endCoach.open(r.id, r.name) }]} />
              </View>
            ) : null}
          </RoRow>
        ))}
      </Stack>
      {endDoctor.sheet}
      {endCoach.sheet}
    </RoScreen>
  );
}
