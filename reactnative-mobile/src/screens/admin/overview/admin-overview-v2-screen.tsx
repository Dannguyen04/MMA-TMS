import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { adminApi } from "@/api/admin";
import { listApplications } from "@/api/admissions";
import { coachApi } from "@/api/coach";
import type { MedicalStatus, PublicFighter, TrainingSession, UserRole } from "@/api/types";
import { MEDICAL_STATUSES } from "@/api/types";
import { videoAiApi } from "@/api/video-ai";
import { Icon, type IconName } from "@/components/icon";
import { PressableScale, StaggerList } from "@/components/motion";
import { RolePage } from "@/components/role-page";
import type { WeightClass } from "@/constants/weight-classes";
import { adminOverview as t } from "@/i18n/admin-overview";
import { countActionable } from "@/screens/admin/admin-actionable";
import { fighterName } from "@/screens/coach/readonly/ro-format";
import { useCoachEnabled } from "@/screens/coach/readonly/use-coach";
import { Frame } from "@/screens/fight-camp/camp-ui";
import { CampTabs } from "@/screens/fight-camp/camp-lit";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useLoad } from "@/screens/fighter/use-load";
import { EvHead } from "@/screens/media/evidence/evidence-panels";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { adminVideosHref } from "@/screens/admin/tools/admin-paths";

import { ColumnChart, Donut, HBarRow, LegendGrid, LegendInline, StackedBar, type Segment } from "./overview-charts";
import { CHART_COLORS } from "./overview-colors";
import {
  attentionList,
  completionRate,
  groupTotals,
  legendGroups,
  medicalCounts,
  num,
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
  const admissions = useLoad(enabled, "ov2-admissions", useCallback(() => listApplications({ page: 1, limit: 100 }).then((page) => countActionable(page.items)), []), { keepOnError: true });

  const loads: Load<unknown>[] = [usersTotal, fightersTotal, todayTotal, fighters, sessions, roles, aiJobs, admissions];
  const [updated, setUpdated] = useState<number | null>(null);
  const [tab, setTab] = useState<"medical" | "sessions" | "users">("medical");
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
  const ai = aiJobs.data;
  const tools: { key: string; icon: IconName; title: string; line?: string; path: string }[] = [
    { key: "admissions", icon: "folderPlus", title: t.tools.admissions, line: admissions.data == null ? undefined : admissions.data ? t.tools.admissionsLine(admissions.data) : t.tools.admissionsNone, path: "/(admin)/quan-tri/nhap-hoc" },
    { key: "assign", icon: "stethoscope", title: t.tools.assign, path: "/(admin)/quan-tri/phan-cong-bac-si" },
    { key: "videos", icon: "video", title: t.tools.videos, line: ai ? t.tools.aiLine(ai.active, ai.failed) || undefined : undefined, path: "/(admin)/quan-tri/video" },
  ];

  const medItems = medSegments.map((s) => ({ ...s, onPress: () => openFighters({ medicalStatus: s.key as MedicalStatus }) }));
  const roleItems = roleSegments.map((s) => ({ ...s, onPress: () => openUsers({ role: s.key as UserRole }) }));

  // Owner 2026-11-19: the page scrolled too far. The tools are one row of three, the charts sit under tabs (each
  // about one screen), legends are a two-column grid or one line, and the latest notifications live on Thông báo.
  return <RolePage testID="admin-overview" title={t.title} onRefresh={refresh}>
    <StaggerList gap={14}>
      {offline ? <Text accessibilityRole="alert" style={{ ...readableTextStyle(14, true), color: c.ink }}>{t.offline(vnClock(updated!))}</Text>
        : updated != null ? <Text style={{ ...readableTextStyle(13.5), color: c.inkMuted }}>{t.updatedAt(vnClock(updated))}</Text> : null}

      <View testID="ov-stats" style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }}>
        {stats.map((s, k) => {
          const v = s.load.data;
          const text = v == null ? "–" : num(v);
          const press = s.load.error && v == null ? () => void s.load.reload() : s.onPress;
          return <PressableScale key={s.key} testID={`ov-stat-${s.key}`} scaleTo={0.97} disabled={!press} accessibilityRole={press ? "button" : undefined}
            accessibilityLabel={`${s.label}: ${text}`} onPress={press}
            style={{ flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, borderLeftWidth: k ? 1 : 0, borderLeftColor: c.line }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(24), lineHeight: lh(28), color: v ? c.ink : c.inkSubtle }}>{text}</Text>
            <Text numberOfLines={2} style={{ ...readableTextStyle(12.5), textAlign: "center", color: c.ink }}>{s.label}</Text>
          </PressableScale>;
        })}
      </View>

      {ai && ai.failed > 0 ? <SlipRow testID="ov-ai-failed" lead={num(ai.failed)} leadTone="warn" title={t.failed} a11y={`${t.failed}: ${ai.failed}`} last onPress={() => openJobs("FAILED")}/> : null}

      {med && injured + notCleared > 0 ? <Frame tone="accent" pad={14}>
        <View testID="ov-attention" style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 4 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(25), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink }}>{t.attention.title}</Text>
            <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(26), lineHeight: lh(30), color: c.danger }}>{num(injured + notCleared)}</Text>
          </View>
          {attention.slice(0, ATTENTION_MAX).map((f) => <AttentionRow key={f.id} name={fighterName(f)} word={t.medicalLabel[f.currentMedicalStatus]}
            weight={t.weightLabel[f.weightClass] ?? ""} onPress={() => openFighter(f.id)}/>)}
          {attention.length > ATTENTION_MAX ? <Text style={{ ...readableTextStyle(14), color: c.ink, paddingTop: 6 }}>{t.attention.more(num(attention.length - ATTENTION_MAX))}</Text> : null}
          <View style={{ flexDirection: "row", gap: 18, flexWrap: "wrap" }}>
            {injured > 0 ? <Link label={t.attention.injuredBtn(num(injured))} onPress={() => openFighters({ medicalStatus: "INJURED" })}/> : null}
            {notCleared > 0 ? <Link label={t.attention.notClearedBtn(num(notCleared))} onPress={() => openFighters({ medicalStatus: "NOT_CLEARED" })}/> : null}
          </View>
        </View>
      </Frame> : null}

      <View testID="ov-tools" accessibilityLabel={t.tools.title} style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }}>
        {tools.map((x, k) => <PressableScale key={x.key} testID={`ov-tool-${x.key}`} scaleTo={0.97} accessibilityRole="button"
          accessibilityLabel={[x.title, x.line].filter(Boolean).join(", ")} onPress={go(x.path)}
          style={{ flex: 1, minWidth: 0, minHeight: 76, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, paddingHorizontal: 4, borderLeftWidth: k ? 1 : 0, borderLeftColor: c.line }}>
          <Icon name={x.icon} size={24} color={c.ink}/>
          <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(14.5), lineHeight: lh(20), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{x.title}</Text>
          {x.line ? <Text numberOfLines={2} style={{ ...readableTextStyle(12), textAlign: "center", color: c.ink }}>{x.line}</Text> : null}
        </PressableScale>)}
      </View>

      <View style={{ gap: 12 }}>
        <CampTabs tabs={[{ key: "medical", label: t.tabs.medical }, { key: "sessions", label: t.tabs.sessions }, { key: "users", label: t.tabs.users }]}
          value={tab} onChange={setTab} alertLabel=""/>

        {tab === "medical" ? <>
          <Block title={t.medical.title} aside={fighters.data && fighterCount ? t.medical.count(num(fighterCount)) : undefined} load={fighters}>
            {fighterCount === 0 ? <Zero text={t.medical.empty}/> : <View style={{ gap: 10 }} accessibilityLabel={t.medical.a11y(medSegments.map((s) => `${num(s.count)} ${s.label.toLowerCase()}`).join(", "))}>
              <StackedBar segments={medSegments}/>
              <LegendGrid items={medItems} total={fighterCount} hint={t.block.open}/>
            </View>}
          </Block>
          <Block title={t.weight.title} load={fighters}>
            {weights.length === 0 ? <Zero text={t.weight.empty}/> : <View accessibilityLabel={t.weight.a11y(weights.map((w) => `${t.weightLabel[w.weightClass]} ${num(w.count)}`).join(", "))}>
              {weights.map((w, k) => <HBarRow key={w.weightClass} label={t.weightLabel[w.weightClass]} value={w.count} max={maxW} color={colors.weight} hint={t.block.open}
                last={k === weights.length - 1} onPress={() => openFighters({ weightClass: w.weightClass })}/>)}
            </View>}
          </Block>
        </> : null}

        {tab === "sessions" ? <Block title={t.sessions.title} load={sessions}>
          {sessions.data ? <View style={{ gap: 10 }}>
            {rate == null ? <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.sessions.rateNone}</Text>
              : <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
                <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(30), lineHeight: lh(34), color: c.ink }}>{rate}<Text style={{ fontSize: fz(15) }}>%</Text></Text>
                <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), flex: 1, color: c.ink }}>{t.sessions.rateLine}</Text>
              </View>}
            {cols.every((x) => x.total === 0) ? <Zero text={t.sessions.empty}/> : <View accessible accessibilityLabel={t.sessions.a11y(legendGroups(totals).map((g) => `${num(totals[g])} ${t.sessionLabel[g].toLowerCase()}`).join(", "))}>
              <ColumnChart height={120} columns={cols.map((x) => ({ key: x.key, label: x.label, today: x.today, total: x.total,
                parts: SESSION_GROUPS.map((g) => ({ key: g, label: t.sessionLabel[g], count: x.counts[g], color: colors.session[g] })) }))}/>
            </View>}
            {legendGroups(totals).length ? <LegendInline items={legendGroups(totals).map((g) => ({ key: g, label: t.sessionLabel[g], count: totals[g], color: colors.session[g] }))}/> : null}
            <Pair items={[
              { label: t.sessions.todayLabel, value: t.sessions.count(num(cols.find((x) => x.today)?.total ?? 0)) },
              { label: t.sessions.next7Label, value: t.sessions.count(num(sessions.data.next)) },
            ]}/>
          </View> : null}
        </Block> : null}

        {tab === "users" ? <Block title={t.roles.title} load={roles}>
          {roles.data ? roleTotal === 0 ? <Zero text={t.roles.empty}/> : <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View accessible accessibilityLabel={t.roles.a11y(roleSegments.map((s) => `${num(s.count)} ${s.label}`).join(", "))}><Donut segments={roleSegments} size={92} stroke={11}/></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Pair items={[{ label: t.roles.activeLabel, value: num(roles.data.active) }, { label: t.roles.lockedShort, value: num(roles.data.locked), danger: roles.data.locked > 0,
                  testID: "ov-locked", a11y: `${t.roles.lockedRow}: ${roles.data.locked}`, onPress: () => openUsers({ status: "INACTIVE" }) }]}/>
              </View>
            </View>
            <LegendGrid items={roleItems} hint={t.block.open}/>
          </View> : null}
        </Block> : null}
      </View>
    </StaggerList>
  </RolePage>;
}

/** One line in the Cần chú ý frame: "!", the name, then the status word (red) and the weight class. */
function AttentionRow({ name, word, weight, onPress }: { name: string; word: string; weight: string; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${word}`} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: c.line, opacity: pressed ? 0.7 : 1 })}>
    <Text style={{ width: 16, fontFamily: fonts.displayExtraBold, fontSize: fz(22), lineHeight: lh(26), color: c.danger }}>!</Text>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(16), lineHeight: lh(21), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{name}</Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(13), color: c.ink }}><Text style={{ ...readableTextStyle(13, true), color: c.danger }}>{word}</Text>{weight ? ` · ${weight}` : ""}</Text>
    </View>
    <Icon name="chevron" size={18} color={c.inkSubtle}/>
  </Pressable>;
}

/** Two facts side by side in one ruled row (instead of a row each). */
function Pair({ items }: { items: { label: string; value: string; danger?: boolean; testID?: string; a11y?: string; onPress?: () => void }[] }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }}>
    {items.map((x, k) => <Pressable key={x.label} testID={x.testID} accessibilityRole={x.onPress ? "button" : undefined} accessibilityLabel={x.a11y ?? `${x.label}: ${x.value}`}
      disabled={!x.onPress} onPress={x.onPress}
      style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 56, justifyContent: "center", paddingHorizontal: 10, borderLeftWidth: k ? 1 : 0, borderLeftColor: c.line, backgroundColor: pressed ? c.surfaceMuted : "transparent" })}>
      <Text numberOfLines={1} style={{ ...readableTextStyle(13), color: c.ink }}>{x.label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(19), lineHeight: lh(24), color: x.danger ? c.danger : c.ink, flexShrink: 1 }}>{x.value}</Text>
        {x.onPress ? <Icon name="chevron" size={16} color={c.inkSubtle}/> : null}
      </View>
    </Pressable>)}
  </View>;
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

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t.block.open} onPress={onPress} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{label}</Text>
  </Pressable>;
}
