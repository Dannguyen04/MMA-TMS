import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { adminApi } from "@/api/admin";
import { listApplications } from "@/api/admissions";
import { coachApi } from "@/api/coach";
import type { MedicalStatus, PublicFighter, TrainingSession, UserRole } from "@/api/types";
import { MEDICAL_STATUSES } from "@/api/types";
import { videoAiApi } from "@/api/video-ai";
import type { IconName } from "@/components/icon";
import { PressableScale, StaggerList } from "@/components/motion";
import { RolePage } from "@/components/role-page";
import type { WeightClass } from "@/constants/weight-classes";
import { adminOverview as t } from "@/i18n/admin-overview";
import { countActionable } from "@/screens/admin/admin-actionable";
import { fighterName } from "@/screens/coach/readonly/ro-format";
import { useCoachEnabled } from "@/screens/coach/readonly/use-coach";
import { Frame } from "@/screens/fight-camp/camp-ui";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useLoad } from "@/screens/fighter/use-load";
import { EvHead } from "@/screens/media/evidence/evidence-panels";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { adminVideosHref } from "@/screens/admin/tools/admin-paths";

import { ColumnChart, Donut, HBarRow, LegendRow, StackedBar, type Segment } from "./overview-charts";
import { CHART_COLORS } from "./overview-colors";
import {
  attentionList,
  completionRate,
  groupTotals,
  latestNotifications,
  legendGroups,
  medicalCounts,
  num,
  relativeTime,
  ROLE_ORDER,
  SESSION_GROUPS,
  sessionColumns,
  vnClock,
  vnRange,
  weightCounts,
} from "./overview-data";

/** Tablet (iPad dọc 820): kept for callers; the page is one column now. */
export const WIDE_MIN = 768;
const PAGE = 100;
const MAX_PAGES = 5;
/** Most names in the Cần chú ý frame. */
const ATTENTION_MAX = 5;

async function allPages<T>(fetch: (page: number) => Promise<{ data: T[]; hasNextPage: boolean }>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await fetch(page);
    rows.push(...res.data);
    if (!res.hasNextPage || res.data.length === 0) break;
  }
  return rows;
}

type Load<T> = { data: T | null; error: string; loading: boolean; reload: () => unknown; refresh: () => Promise<void> };

/**
 * Admin Tổng quan (redesign step 22): a strip of four numbers, the failed-analysis row, the one framed spotlight
 * (Cần chú ý), then flat sections (Tình trạng y tế, Buổi tập 7 ngày, Hạng cân, Vai trò, Thông báo mới) and the Quản trị
 * rows. Each block loads and fails on its own; every legend row opens the filtered list.
 */
export function AdminOverviewV2Screen() {
  const enabled = useCoachEnabled();
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const colors = CHART_COLORS[useFighterPalette().scheme];

  // ----- Sources (existing API only; counts = list `total` with limit=1) -----
  const usersTotal = useLoad(enabled, "ov2-users", useCallback(() => adminApi.listUsers({ page: 1, limit: 1 }).then((r) => r.total), []), { keepOnError: true });
  const fightersTotal = useLoad(enabled, "ov2-fighters", useCallback(() => coachApi.listFighters({ page: 1, limit: 1 }).then((r) => r.total), []), { keepOnError: true });
  const todayTotal = useLoad(enabled, "ov2-today", useCallback(() => coachApi.listSessions({ page: 1, limit: 1, ...vnRange(0, 0) }).then((r) => r.total), []), { keepOnError: true });
  const fighters = useLoad(enabled, "ov2-fighter-rows", useCallback(() => allPages<PublicFighter>((page) => coachApi.listFighters({ page, limit: PAGE })), []), { keepOnError: true });
  const sessions = useLoad(enabled, "ov2-sessions", useCallback(async () => {
    const [rows, next] = await Promise.all([
      allPages<TrainingSession>((page) => coachApi.listSessions({ page, limit: PAGE, ...vnRange(-6, 0) })),
      coachApi.listSessions({ page: 1, limit: 1, status: "SCHEDULED", ...vnRange(1, 7) }).then((r) => r.total),
    ]);
    return { rows, next };
  }, []), { keepOnError: true });
  const roles = useLoad(enabled, "ov2-roles", useCallback(async () => {
    const counts = await Promise.all(ROLE_ORDER.map((role) => adminApi.listUsers({ page: 1, limit: 1, role }).then((r) => r.total)));
    const [active, locked] = await Promise.all([
      adminApi.listUsers({ page: 1, limit: 1, status: "ACTIVE" }).then((r) => r.total),
      adminApi.listUsers({ page: 1, limit: 1, status: "INACTIVE" }).then((r) => r.total),
    ]);
    return { byRole: Object.fromEntries(ROLE_ORDER.map((r, i) => [r, counts[i]!])) as Record<UserRole, number>, active, locked };
  }, []), { keepOnError: true });
  const aiJobs = useLoad(enabled, "ov2-ai-jobs", useCallback(() => videoAiApi.listJobs().then((jobs) => ({
    active: jobs.filter((j) => j.status === "PENDING" || j.status === "PROCESSING").length,
    failed: jobs.filter((j) => j.status === "FAILED").length,
  })), []), { keepOnError: true });
  const aiActive: Load<number> = { ...aiJobs, data: aiJobs.data?.active ?? null };
  const notifs = useLoad(enabled, "ov2-notifs", useCallback(() => adminApi.listNotifications({ page: 1, limit: 3 }).then((r) => r.data), []), { keepOnError: true });
  const admissions = useLoad(enabled, "ov2-admissions", useCallback(() => listApplications({ page: 1, limit: 100 }).then((page) => countActionable(page.items)), []), { keepOnError: true });

  const loads: Load<unknown>[] = [usersTotal, fightersTotal, todayTotal, fighters, sessions, roles, notifs, aiJobs, admissions];
  const [updated, setUpdated] = useState<number | null>(null);
  const dataStamp = loads.map((l) => l.data);
  useEffect(() => {
    if (loads.some((l) => l.data != null)) setUpdated(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dataStamp);
  const offline = updated != null && loads.some((l) => l.error && l.data != null);

  const refresh = async () => {
    const res = await Promise.allSettled(loads.map((l) => l.refresh()));
    if (res.every((r) => r.status === "rejected")) throw (res[0] as PromiseRejectedResult).reason;
  };

  // ----- Navigation -----
  const stamp = () => String(Date.now());
  const openFighters = (params: { medicalStatus?: MedicalStatus; weightClass?: WeightClass } = {}) =>
    router.navigate({ pathname: "/(admin)/vo-si", params: { medicalStatus: params.medicalStatus ?? "", weightClass: params.weightClass ?? "", t: stamp() } } as unknown as Href);
  const openUsers = (params: { role?: UserRole; status?: "INACTIVE" } = {}) =>
    router.navigate({ pathname: "/(admin)/nguoi-dung", params: { role: params.role ?? "", status: params.status ?? "", t: stamp() } } as unknown as Href);
  const openInbox = () => router.navigate("/(admin)/thong-bao" as Href);
  const openJobs = (status: "ALL" | "FAILED") => router.push(adminVideosHref({ seg: "ai", status: status === "ALL" ? undefined : status }) as never);
  const openFighter = (id: string) => router.push({ pathname: "/(admin)/vo-si/chi-tiet", params: { id } } as never);
  const go = (path: string) => () => router.push(path as Href);

  // ----- Figures -----
  const med = useMemo(() => (fighters.data ? medicalCounts(fighters.data) : null), [fighters.data]);
  const attention = useMemo(() => (fighters.data ? attentionList(fighters.data) : []), [fighters.data]);
  const weights = useMemo(() => (fighters.data ? weightCounts(fighters.data) : []), [fighters.data]);
  const cols = useMemo(() => (sessions.data ? sessionColumns(sessions.data.rows) : []), [sessions.data]);
  const totals = useMemo(() => groupTotals(cols), [cols]);
  const rate = completionRate(totals);
  const fighterCount = fighters.data?.length ?? 0;
  const injured = med?.INJURED ?? 0;
  const notCleared = med?.NOT_CLEARED ?? 0;

  const stats: { key: string; label: string; load: Load<number>; onPress?: () => void }[] = [
    { key: "users", label: t.tiles.users, load: usersTotal, onPress: () => openUsers() },
    { key: "fighters", label: t.tiles.fighters, load: fightersTotal, onPress: () => openFighters() },
    { key: "today", label: t.tiles.sessionsToday, load: todayTotal },
    { key: "ai", label: t.tiles.ai, load: aiActive, onPress: () => openJobs("ALL") },
  ];

  const medSegments: Segment[] = MEDICAL_STATUSES.map((s) => ({ key: s, label: t.medicalLabel[s], count: med?.[s] ?? 0, color: colors.medical[s] }));
  const roleSegments: Segment[] = ROLE_ORDER.map((r) => ({ key: r, label: t.roleLabel[r], count: roles.data?.byRole[r] ?? 0, color: colors.role[r] }));
  const roleTotal = roleSegments.reduce((s, x) => s + x.count, 0);
  const maxW = Math.max(1, ...weights.map((w) => w.count));
  const notifRows = notifs.data ? latestNotifications(notifs.data) : [];
  const ai = aiJobs.data;
  const tools: { key: string; icon: IconName; title: string; line?: string; path: string }[] = [
    { key: "admissions", icon: "folderPlus", title: t.tools.admissions, line: admissions.data == null ? undefined : admissions.data ? t.tools.admissionsLine(admissions.data) : t.tools.admissionsNone, path: "/(admin)/quan-tri/nhap-hoc" },
    { key: "assign", icon: "stethoscope", title: t.tools.assign, path: "/(admin)/quan-tri/phan-cong-bac-si" },
    { key: "videos", icon: "video", title: t.tools.videos, line: ai ? t.tools.aiLine(ai.active, ai.failed) || undefined : undefined, path: "/(admin)/quan-tri/video" },
  ];

  return <RolePage testID="admin-overview" title={t.title} onRefresh={refresh}>
    <StaggerList gap={16}>
      {offline ? <Text accessibilityRole="alert" style={{ ...readableTextStyle(14, true), color: c.ink }}>{t.offline(vnClock(updated!))}</Text>
        : updated != null ? <Text style={{ ...readableTextStyle(14), color: c.ink }}>{t.updatedAt(vnClock(updated))}</Text> : null}

      <View testID="ov-stats" style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }}>
        {stats.map((s, k) => {
          const v = s.load.data;
          const text = v == null ? "–" : num(v);
          const press = s.load.error && v == null ? () => void s.load.reload() : s.onPress;
          return <PressableScale key={s.key} testID={`ov-stat-${s.key}`} scaleTo={0.97} disabled={!press} accessibilityRole={press ? "button" : undefined}
            accessibilityLabel={`${s.label}: ${text}`} onPress={press}
            style={{ flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderLeftWidth: k ? 1 : 0, borderLeftColor: c.line }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(24), lineHeight: lh(28), color: v ? c.ink : c.inkSubtle }}>{text}</Text>
            <Text numberOfLines={2} style={{ ...readableTextStyle(12.5), textAlign: "center", color: c.ink }}>{s.label}</Text>
          </PressableScale>;
        })}
      </View>

      {ai && ai.failed > 0 ? <SlipRow testID="ov-ai-failed" lead={num(ai.failed)} leadTone="warn" title={t.failed} a11y={`${t.failed}: ${ai.failed}`} last onPress={() => openJobs("FAILED")}/> : null}

      {med && injured + notCleared > 0 ? <Frame tone="accent" pad={16}>
        <View testID="ov-attention" style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(19), lineHeight: lh(22), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink }}>{t.attention.title}</Text>
            <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(30), lineHeight: lh(32), color: c.danger }}>{num(injured + notCleared)}</Text>
          </View>
          {attention.slice(0, ATTENTION_MAX).map((f, k) => {
            const word = t.medicalLabel[f.currentMedicalStatus];
            const wl = t.weightLabel[f.weightClass] ?? "";
            return <SlipRow key={f.id} lead="!" leadTone="warn" title={fighterName(f)} word={word} wordTone="warn" line={wl}
              a11y={`${fighterName(f)}, ${word}`} last={k === Math.min(attention.length, ATTENTION_MAX) - 1} onPress={() => openFighter(f.id)}/>;
          })}
          {attention.length > ATTENTION_MAX ? <Text style={{ ...readableTextStyle(14), color: c.ink, paddingTop: 6 }}>{t.attention.more(num(attention.length - ATTENTION_MAX))}</Text> : null}
          <View style={{ flexDirection: "row", gap: 18, flexWrap: "wrap" }}>
            {injured > 0 ? <Link label={t.attention.injuredBtn(num(injured))} onPress={() => openFighters({ medicalStatus: "INJURED" })}/> : null}
            {notCleared > 0 ? <Link label={t.attention.notClearedBtn(num(notCleared))} onPress={() => openFighters({ medicalStatus: "NOT_CLEARED" })}/> : null}
          </View>
        </View>
      </Frame> : null}

      <Block title={t.medical.title} aside={fighters.data && fighterCount ? t.medical.count(num(fighterCount)) : undefined} load={fighters}>
        {fighterCount === 0 ? <Zero text={t.medical.empty}/> : <View style={{ gap: 12 }} accessibilityLabel={t.medical.a11y(medSegments.map((s) => `${num(s.count)} ${s.label.toLowerCase()}`).join(", "))}>
          <StackedBar segments={medSegments}/>
          <View>{medSegments.map((s, k) => <LegendRow key={s.key} color={s.color} label={s.label} value={s.count} total={fighterCount} hint={t.block.open}
            last={k === medSegments.length - 1} onPress={() => openFighters({ medicalStatus: s.key as MedicalStatus })}/>)}</View>
        </View>}
      </Block>

      <Block title={t.sessions.title} load={sessions}>
        {sessions.data ? <View style={{ gap: 12 }}>
          {rate == null ? <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.sessions.rateNone}</Text>
            : <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
              <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(34), lineHeight: lh(38), color: c.ink }}>{rate}<Text style={{ fontSize: fz(16) }}>%</Text></Text>
              <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), flex: 1, color: c.ink }}>{t.sessions.rateLine}</Text>
            </View>}
          {cols.every((x) => x.total === 0) ? <Zero text={t.sessions.empty}/> : <View accessible accessibilityLabel={t.sessions.a11y(legendGroups(totals).map((g) => `${num(totals[g])} ${t.sessionLabel[g].toLowerCase()}`).join(", "))}>
            <ColumnChart columns={cols.map((x) => ({ key: x.key, label: x.label, today: x.today, total: x.total,
              parts: SESSION_GROUPS.map((g) => ({ key: g, label: t.sessionLabel[g], count: x.counts[g], color: colors.session[g] })) }))}/>
          </View>}
          {legendGroups(totals).length ? <View>{legendGroups(totals).map((g, k, all) => <LegendRow key={g} color={colors.session[g]} label={t.sessionLabel[g]} value={totals[g]} last={k === all.length - 1}/>)}</View> : null}
          <View>
            <Fact label={t.sessions.todayLabel} value={t.sessions.count(num(cols.find((x) => x.today)?.total ?? 0))}/>
            <Fact label={t.sessions.next7Label} value={t.sessions.count(num(sessions.data.next))} last/>
          </View>
        </View> : null}
      </Block>

      <Block title={t.weight.title} load={fighters}>
        {weights.length === 0 ? <Zero text={t.weight.empty}/> : <View accessibilityLabel={t.weight.a11y(weights.map((w) => `${t.weightLabel[w.weightClass]} ${num(w.count)}`).join(", "))}>
          {weights.map((w, k) => <HBarRow key={w.weightClass} label={t.weightLabel[w.weightClass]} value={w.count} max={maxW} color={colors.weight} hint={t.block.open}
            last={k === weights.length - 1} onPress={() => openFighters({ weightClass: w.weightClass })}/>)}
        </View>}
      </Block>

      <Block title={t.roles.title} load={roles}>
        {roles.data ? roleTotal === 0 ? <Zero text={t.roles.empty}/> : <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View accessible accessibilityLabel={t.roles.a11y(roleSegments.map((s) => `${num(s.count)} ${s.label}`).join(", "))}><Donut segments={roleSegments}/></View>
            <View style={{ flex: 1, minWidth: 0 }}>{roleSegments.map((s, k) => <LegendRow key={s.key} color={s.color} label={s.label} value={s.count} hint={t.block.open}
              last={k === roleSegments.length - 1} onPress={() => openUsers({ role: s.key as UserRole })}/>)}</View>
          </View>
          <Fact label={t.roles.activeLabel} value={num(roles.data.active)} last/>
          <SlipRow testID="ov-locked" lead={num(roles.data.locked)} leadTone={roles.data.locked ? "warn" : "dim"} title={t.roles.lockedRow} a11y={`${t.roles.lockedRow}: ${roles.data.locked}`}
            last onPress={() => openUsers({ status: "INACTIVE" })}/>
        </View> : null}
      </Block>

      <Block title={t.notifications.title} load={notifs}>
        {notifs.data ? notifRows.length === 0 ? <Zero text={t.notifications.empty}/> : <View>
          {notifRows.map((n, k) => <SlipRow key={n.id} icon="notifications" leadTone={n.isRead ? "dim" : undefined} dot={!n.isRead} title={n.title} line={relativeTime(n.createdAt)}
            a11y={[n.isRead ? "" : t.notifications.unread, n.title, relativeTime(n.createdAt)].filter(Boolean).join(", ")} last={k === notifRows.length - 1} onPress={openInbox}/>)}
          <Link label={t.notifications.seeAll} onPress={openInbox}/>
        </View> : null}
      </Block>

      <View testID="ov-tools" style={{ gap: 8 }}>
        <EvHead title={t.tools.title}/>
        <View>{tools.map((x, k) => <SlipRow key={x.key} testID={`ov-tool-${x.key}`} icon={x.icon} title={x.title} line={x.line}
          a11y={[x.title, x.line].filter(Boolean).join(", ")} last={k === tools.length - 1} onPress={go(x.path)}/>)}</View>
      </View>
    </StaggerList>
  </RolePage>;
}

/** Section head, then the body: spinner on first load, "Thử lại" on error, else the content. */
function Block({ title, aside, load, children }: { title: string; aside?: string; load: Load<unknown>; children: ReactNode }) {
  const { colors: c } = useThemePreference();
  return <View style={{ gap: 8 }}>
    <EvHead title={title} aside={aside}/>
    {load.data != null ? children
      : load.error ? <RetryRow message={t.block.error} retry={t.block.retry} onRetry={() => void load.reload()}/>
        : <ActivityIndicator accessibilityLabel="Đang tải" color={c.lotus} style={{ paddingVertical: 16 }}/>}
  </View>;
}

function Zero({ text }: { text: string }) {
  return <SlipRow lead="0" leadTone="dim" title={text} a11y={text} last/>;
}

function Fact({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors: c } = useThemePreference();
  return <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: c.line, ...(last ? { borderBottomWidth: 1, borderBottomColor: c.line } : null) }}>
    <Text style={{ ...readableTextStyle(14.5), color: c.ink }}>{label}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.ink }}>{value}</Text>
  </View>;
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t.block.open} onPress={onPress} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{label}</Text>
  </Pressable>;
}
