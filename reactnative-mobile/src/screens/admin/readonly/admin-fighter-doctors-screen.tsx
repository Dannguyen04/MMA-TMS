import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { adminApi } from "@/api/admin";
import { coachApi } from "@/api/coach";
import type { CoachAssignment, PublicFighter } from "@/api/types";
import { StaggerList } from "@/components/motion";
import { EmptyLine, RolePage } from "@/components/role-page";
import { adminRest as t } from "@/i18n/admin-rest";
import { fighterLine } from "@/screens/coach/fighters/fighter-model";
import { fighterName, vnDate } from "@/screens/coach/readonly/ro-format";
import { useCoachEnabled } from "@/screens/coach/readonly/use-coach";
import { usePagedList } from "@/screens/coach/readonly/use-paged-list";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { EvHead } from "@/screens/media/evidence/evidence-panels";
import { useEndAssignment } from "@/screens/one-tap/status-actions";
import { MoreMenu } from "@/screens/one-tap/video-actions";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

import { doctorRows, type DoctorRow } from "./admin-format";
import { userInitials } from "./admin-users-screen";

/** Line for one assignment: "từ dd/mm/yyyy" while current, else the range. */
export function assignmentLine(r: Pick<DoctorRow, "from" | "to">): string {
  return r.to ? t.range(vnDate(r.from), vnDate(r.to)) : t.since(vnDate(r.from));
}

/**
 * Admin Bác sĩ phụ trách (redesign step 22), `vo-si/bac-si?id=<fighterId>`: the fighter's name and line, then sections
 * Bác sĩ and Huấn luyện viên with one row per assignment (current first; ended rows dim with "Đã kết thúc").
 * "⋯" lists Kết thúc phụ trách for each current assignment (GET /fighters/:id/doctors is frozen; see admin-flags).
 */
export function AdminFighterDoctorsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const fid = typeof id === "string" ? id : "";
  const enabled = useCoachEnabled() && Boolean(fid);
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const [fighter, setFighter] = useState<PublicFighter | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [coaches, setCoaches] = useState<CoachAssignment[] | null>(null);
  const [ended, setEnded] = useState<ReadonlySet<string>>(new Set());

  const list = usePagedList(enabled, `fd|${fid}`, (page) => adminApi.listFighterDoctors(fid, { page, limit: 20 }));
  const loadExtra = useCallback(() => {
    if (!enabled) return;
    coachApi.getFighter(fid).then(setFighter).catch(() => undefined);
    adminApi.listUsers({ role: "DOCTOR", limit: 100 })
      .then((r) => setNames(Object.fromEntries(r.items.flatMap((u) => (u.profile ? [[u.profile.id, `${u.profile.firstName} ${u.profile.lastName}`.trim()] as const] : [])))))
      .catch(() => undefined);
    adminApi.listFighterCoaches(fid).then(setCoaches).catch(() => setCoaches([]));
  }, [enabled, fid]);
  useEffect(loadExtra, [loadExtra]);

  const markEnded = (aid: string) => setEnded((s) => new Set(s).add(aid));
  const endDoctor = useEndAssignment({ kind: "doctor", fighterId: fid, onDone: markEnded });
  const endCoach = useEndAssignment({ kind: "coach", fighterId: fid, onDone: markEnded });
  const doctors = doctorRows(list.items, names).map((r) => (ended.has(r.id) ? { ...r, current: false } : r));
  const coachRows: DoctorRow[] = (coaches ?? [])
    .map((x) => ({ id: x.id, name: x.coachName?.trim() || t.coaches, current: x.endsAt == null && !ended.has(x.id), from: x.startsAt, to: x.endsAt }))
    .sort((a, b) => Number(b.current) - Number(a.current) || Date.parse(b.from) - Date.parse(a.from));
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(admin)/vo-si" as never));
  const menu = [
    ...doctors.filter((r) => r.current).map((r) => ({ key: `d-${r.id}`, label: t.endOne(r.name), icon: "ban" as const, danger: true, onPress: () => endDoctor.open(r.id, r.name) })),
    ...coachRows.filter((r) => r.current).map((r) => ({ key: `c-${r.id}`, label: t.endOne(r.name), icon: "ban" as const, danger: true, onPress: () => endCoach.open(r.id, r.name) })),
  ];
  const firstLoad = !list.loaded || (list.loading && list.items.length === 0 && !list.error);

  const rows = (items: DoctorRow[], prefix: string) => <StaggerList testID={`${prefix}-list`}>
    {items.map((r, k) => {
      const line = assignmentLine(r);
      return <SlipRow key={r.id} testID={`${prefix}-${r.id}`} lead={userInitials(r.name)} leadTone={r.current ? undefined : "dim"} title={r.name}
        word={r.current ? undefined : t.ended} line={line} a11y={[r.name, r.current ? "" : t.ended, line].filter(Boolean).join(", ")} last={k === items.length - 1}/>;
    })}
  </StaggerList>;

  return <RolePage testID="admin-fighter-doctors" title={t.doctorsTitle} onBack={back}
    onRefresh={async () => { loadExtra(); await list.refresh(); }} right={menu.length ? <MoreMenu items={menu}/> : undefined}>
    {!fid ? <View style={{ gap: 10 }}>
      <EmptyLine title={t.fighterMissing}/>
      <Pressable accessibilityRole="button" onPress={back} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.backToList}</Text>
      </Pressable>
    </View> : null}
    {fighter ? <View style={{ gap: 2 }}>
      <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(26), lineHeight: lh(30), textTransform: "uppercase", color: c.ink }}>{fighterName(fighter)}</Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.ink }}>{fighterLine(fighter)}</Text>
    </View> : null}
    {fid ? <View style={{ gap: 8 }}>
      <EvHead title={t.doctors} aside={doctors.length ? String(doctors.length) : undefined}/>
      {firstLoad && !list.error ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 24 }}/> : null}
      {list.error && !list.items.length ? <RetryRow message={t.doctorsFailed} retry={t.retry} onRetry={() => void list.reload()}/> : null}
      {list.loaded && !list.error && !doctors.length ? <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.noDoctors}</Text> : null}
      {doctors.length ? rows(doctors, "fd-doctor") : null}
      {list.hasNext ? <Pressable accessibilityRole="button" onPress={list.loadMore} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.more}</Text>
      </Pressable> : null}
    </View> : null}
    {fid && coaches ? <View style={{ gap: 8 }}>
      <EvHead title={t.coaches} aside={coachRows.length ? String(coachRows.length) : undefined}/>
      {coachRows.length ? rows(coachRows, "fd-coach") : <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.noCoaches}</Text>}
    </View> : null}
    {endDoctor.sheet}
    {endCoach.sheet}
  </RolePage>;
}
