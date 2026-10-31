import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter, type Href } from "expo-router";

import { adminApi } from "@/api/admin";
import { coachApi } from "@/api/coach";
import type { MedicalStatus, PublicFighter, TrainingSession, UserRole } from "@/api/types";
import { MEDICAL_STATUSES } from "@/api/types";
import { Icon, type IconName } from "@/components/icon";
import { Skeleton } from "@/components/motion";
import type { WeightClass } from "@/constants/weight-classes";
import { adminOverview as t } from "@/i18n/admin-overview";
import { fighterName, MEDICAL_CHIP } from "@/screens/coach/readonly/ro-format";
import { RoScreen, StatusChip } from "@/screens/coach/readonly/ro-ui";
import { useCoachEnabled } from "@/screens/coach/readonly/use-coach";
import { ActionButton, SPEC, TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";
import { videoAiApi } from "@/api/video-ai";
import { vai } from "@/i18n/video-ai";

import { CHART_COLORS } from "./overview-colors";
import { ColumnChart, Donut, HBarRow, LegendRow, StackedBar, type Segment } from "./overview-charts";
import {
  attentionList,
  completionRate,
  groupTotals,
  latestNotifications,
  medicalCounts,
  num,
  relativeTime,
  legendGroups,
  ROLE_ORDER,
  SESSION_GROUPS,
  sessionColumns,
  vnClock,
  vnRange,
  weightCounts,
} from "./overview-data";

/** Tablet (iPad dọc 820): lưới 2 cột. */
export const WIDE_MIN = 768;
const PAGE = 100;
const MAX_PAGES = 5;
/** Số tên tối đa trong thẻ Cần chú ý. */
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

/** Phần trạng thái tải mà khung khối cần. */
type Load<T> = { data: T | null; error: string; loading: boolean; reload: () => unknown; refresh: () => Promise<void> };

/** Admin · Tổng quan v2 (admin-overview-v2.md). Mỗi khối tải riêng, lỗi riêng. */
export function AdminOverviewV2Screen() {
  const enabled = useCoachEnabled();
  const router = useRouter();
  const p = useFighterPalette();
  const colors = CHART_COLORS[p.scheme];
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_MIN;

  // ----- Nguồn dữ liệu (chỉ API có sẵn; số đếm = `total` của danh sách, limit=1) -----
  const usersTotal = useLoad(enabled, "ov2-users", useCallback(() => adminApi.listUsers({ page: 1, limit: 1 }).then((r) => r.total), []), { keepOnError: true });
  const fightersTotal = useLoad(enabled, "ov2-fighters", useCallback(() => coachApi.listFighters({ page: 1, limit: 1 }).then((r) => r.total), []), { keepOnError: true });
  const todayTotal = useLoad(
    enabled,
    "ov2-today",
    useCallback(() => coachApi.listSessions({ page: 1, limit: 1, ...vnRange(0, 0) }).then((r) => r.total), []),
    { keepOnError: true },
  );
  const unread = useLoad(enabled, "ov2-unread", useCallback(() => adminApi.unreadCount().then((r) => r.count), []), { keepOnError: true });
  const fighters = useLoad(
    enabled,
    "ov2-fighter-rows",
    useCallback(() => allPages<PublicFighter>((page) => coachApi.listFighters({ page, limit: PAGE })), []),
    { keepOnError: true },
  );
  const sessions = useLoad(
    enabled,
    "ov2-sessions",
    useCallback(async () => {
      const [rows, next] = await Promise.all([
        allPages<TrainingSession>((page) => coachApi.listSessions({ page, limit: PAGE, ...vnRange(-6, 0) })),
        coachApi.listSessions({ page: 1, limit: 1, status: "SCHEDULED", ...vnRange(1, 7) }).then((r) => r.total),
      ]);
      return { rows, next };
    }, []),
    { keepOnError: true },
  );
  const roles = useLoad(
    enabled,
    "ov2-roles",
    useCallback(async () => {
      const counts = await Promise.all(ROLE_ORDER.map((role) => adminApi.listUsers({ page: 1, limit: 1, role }).then((r) => r.total)));
      const [active, locked] = await Promise.all([
        adminApi.listUsers({ page: 1, limit: 1, status: "ACTIVE" }).then((r) => r.total),
        adminApi.listUsers({ page: 1, limit: 1, status: "INACTIVE" }).then((r) => r.total),
      ]);
      return { byRole: Object.fromEntries(ROLE_ORDER.map((r, i) => [r, counts[i]!])) as Record<UserRole, number>, active, locked };
    }, []),
    { keepOnError: true },
  );
  const aiJobs = useLoad(
    enabled,
    "ov2-ai-jobs",
    useCallback(
      () =>
        videoAiApi.listJobs().then((jobs) => ({
          active: jobs.filter((j) => j.status === "PENDING" || j.status === "PROCESSING").length,
          failed: jobs.filter((j) => j.status === "FAILED").length,
        })),
      [],
    ),
    { keepOnError: true },
  );
  const aiActive: Load<number> = { ...aiJobs, data: aiJobs.data?.active ?? null };
  const notifs = useLoad(enabled, "ov2-notifs", useCallback(() => adminApi.listNotifications({ page: 1, limit: 3 }).then((r) => r.data), []), { keepOnError: true });

  const loads: Load<unknown>[] = [usersTotal, fightersTotal, todayTotal, unread, fighters, sessions, roles, notifs, aiJobs];
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

  // ----- Điều hướng -----
  const stamp = () => String(Date.now());
  const openFighters = (params: { medicalStatus?: MedicalStatus; weightClass?: WeightClass } = {}) =>
    router.navigate({ pathname: "/(admin)/vo-si", params: { medicalStatus: params.medicalStatus ?? "", weightClass: params.weightClass ?? "", t: stamp() } } as unknown as Href);
  const openUsers = (params: { role?: UserRole; status?: "INACTIVE" } = {}) =>
    router.navigate({ pathname: "/(admin)/nguoi-dung", params: { role: params.role ?? "", status: params.status ?? "", t: stamp() } } as unknown as Href);
  const openInbox = () => router.navigate("/(admin)/thong-bao" as Href);
  const openJobs = (status: "ALL" | "FAILED") => router.push({ pathname: "/(admin)/quan-tri/phan-tich-ai", params: { status } } as never);
  const openFighter = (id: string) => router.push({ pathname: "/(admin)/vo-si/chi-tiet", params: { id } } as never);

  // ----- Tính toán -----
  const med = useMemo(() => (fighters.data ? medicalCounts(fighters.data) : null), [fighters.data]);
  const attention = useMemo(() => (fighters.data ? attentionList(fighters.data) : []), [fighters.data]);
  const weights = useMemo(() => (fighters.data ? weightCounts(fighters.data) : []), [fighters.data]);
  const cols = useMemo(() => (sessions.data ? sessionColumns(sessions.data.rows) : []), [sessions.data]);
  const totals = useMemo(() => groupTotals(cols), [cols]);
  const rate = completionRate(totals);
  const fighterCount = fighters.data?.length ?? 0;

  // ----- Khối -----
  const tiles = (
    <>
    <View style={[styles.tiles, wide && styles.tilesWide]}>
      <StatTile icon="fighters" label={t.tiles.users} load={usersTotal} onPress={() => openUsers()} wide={wide} />
      <StatTile icon="martialArts" label={t.tiles.fighters} load={fightersTotal} onPress={() => openFighters()} wide={wide} />
      <StatTile icon="schedule" label={t.tiles.sessionsToday} load={todayTotal} wide={wide} />
      <StatTile icon="notifications" label={t.tiles.unread} load={unread} onPress={openInbox} wide={wide} />
      <StatTile icon="aiJobs" label={vai.tilePending} load={aiActive} onPress={() => openJobs("ALL")} wide={wide} />
    </View>
    {aiJobs.data && aiJobs.data.failed > 0 ? (
        <Pressable
          testID="ov-ai-failed"
          accessibilityRole="button"
          accessibilityHint={t.block.open}
          onPress={() => openJobs("FAILED")}
          style={({ pressed }) => [styles.failedLine, { borderColor: p.danger, backgroundColor: p.surface, opacity: pressed ? 0.85 : 1 }]}
        >
          <Icon name="warning" size={20} color={p.danger} />
          <Text style={[TEXT.bodyBold, { color: p.danger, flex: 1 }]}>{vai.failedLine(aiJobs.data.failed)}</Text>
          <Icon name="chevron" size={20} color={p.danger} />
        </Pressable>
      ) : null}
    </>
  );

  const injured = med?.INJURED ?? 0;
  const notCleared = med?.NOT_CLEARED ?? 0;
  const attentionCard =
    med && injured + notCleared > 0 ? (
      <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.danger, borderWidth: 2 }]}>
        <View style={styles.cardHead}>
          <Icon name="warning" size={24} color={p.danger} />
          <Text style={[TEXT.cardTitle, { color: p.ink, flex: 1 }]} accessibilityRole="header">
            {t.attention.title}
          </Text>
        </View>
        <Text style={[TEXT.bodyBold, { color: p.ink }]}>
          {[injured > 0 ? t.attention.injured(num(injured)) : "", notCleared > 0 ? t.attention.notCleared(num(notCleared)) : ""].filter(Boolean).join(" · ")}
        </Text>
        <View>
          {attention.slice(0, ATTENTION_MAX).map((f) => {
            const chip = { ...MEDICAL_CHIP[f.currentMedicalStatus], label: t.medicalLabel[f.currentMedicalStatus] };
            return (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityLabel={`${fighterName(f)}, ${chip.label}`}
                onPress={() => openFighter(f.id)}
                style={({ pressed }) => [styles.nameRow, { backgroundColor: pressed ? p.surface2 : "transparent" }]}
              >
                {/* iPad: chip ngay sau tên, chevron ở mép phải. Điện thoại: tên chiếm phần còn lại. */}
                <Text style={[TEXT.body, { color: p.ink }, wide ? styles.nameWide : styles.flex]} numberOfLines={1}>
                  {fighterName(f)}
                </Text>
                <View style={styles.chipCenter}>
                  <StatusChip spec={chip} />
                </View>
                {wide ? <View style={styles.flex} /> : null}
                <Icon name="chevron" size={20} color={p.ink} />
              </Pressable>
            );
          })}
          {attention.length > ATTENTION_MAX ? (
            <Text style={[TEXT.detail, { color: p.ink }]}>{t.attention.more(num(attention.length - ATTENTION_MAX))}</Text>
          ) : null}
        </View>
        <View style={styles.btnRow}>
          {injured > 0 ? (
            <OutlineButton label={t.attention.injuredBtn(num(injured))} onPress={() => openFighters({ medicalStatus: "INJURED" })} />
          ) : null}
          {notCleared > 0 ? (
            <OutlineButton label={t.attention.notClearedBtn(num(notCleared))} onPress={() => openFighters({ medicalStatus: "NOT_CLEARED" })} />
          ) : null}
        </View>
      </View>
    ) : null;

  const medSegments: Segment[] = MEDICAL_STATUSES.map((s) => ({ key: s, label: t.medicalLabel[s], count: med?.[s] ?? 0, color: colors.medical[s] }));
  const medicalCard = (
    <BlockCard title={t.medical.title} load={fighters} skeletonHeight={16 + 5 * 48} grow={wide}>
      {fighterCount === 0 ? (
        <ZeroLine text={t.medical.empty} />
      ) : (
        <View
          accessible={false}
          accessibilityLabel={t.medical.a11y(medSegments.map((s) => `${num(s.count)} ${s.label.toLowerCase()}`).join(", "))}
          style={styles.gap12}
        >
          <StackedBar segments={medSegments} />
          <View>
            {medSegments.map((s) => (
              <LegendRow
                key={s.key}
                color={s.color}
                label={s.label}
                value={s.count}
                total={fighterCount}
                hint={t.block.open}
                onPress={() => openFighters({ medicalStatus: s.key as MedicalStatus })}
              />
            ))}
          </View>
        </View>
      )}
    </BlockCard>
  );

  const sessionsCard = (
    <BlockCard title={t.sessions.title} load={sessions} skeletonHeight={160 + 120} grow={wide}>
      {sessions.data ? (
        <View style={styles.gap12}>
          <Text style={[TEXT.bodyBold, { color: p.ink }]}>{rate == null ? t.sessions.rateNone : t.sessions.rate(`${rate}%`)}</Text>
          {cols.every((c) => c.total === 0) ? (
            <ZeroLine text={t.sessions.empty} />
          ) : (
            <View
              accessible
              accessibilityLabel={t.sessions.a11y(legendGroups(totals).map((g) => `${num(totals[g])} ${t.sessionLabel[g].toLowerCase()}`).join(", "))}
            >
              <ColumnChart
                columns={cols.map((c) => ({
                  key: c.key,
                  label: c.label,
                  today: c.today,
                  total: c.total,
                  parts: SESSION_GROUPS.map((g) => ({ key: g, label: t.sessionLabel[g], count: c.counts[g], color: colors.session[g] })),
                }))}
              />
            </View>
          )}
          <View style={styles.legendGrid}>
            {legendGroups(totals).map((g) => (
              <View key={g} style={styles.legendCell}>
                <LegendRow color={colors.session[g]} label={t.sessionLabel[g]} value={totals[g]} />
              </View>
            ))}
          </View>
          <View style={[styles.divider, { backgroundColor: p.line }]} />
          <Text style={[TEXT.body, { color: p.ink }]}>{t.sessions.today(num(cols.find((c) => c.today)?.total ?? 0))}</Text>
          <Text style={[TEXT.body, { color: p.ink }]}>{t.sessions.next7(num(sessions.data.next))}</Text>
        </View>
      ) : null}
    </BlockCard>
  );

  const maxW = Math.max(1, ...weights.map((w) => w.count));
  const weightCard = (
    <BlockCard title={t.weight.title} load={fighters} skeletonHeight={4 * 48} grow={wide}>
      {weights.length === 0 ? (
        <ZeroLine text={t.weight.empty} />
      ) : (
        <View accessibilityLabel={t.weight.a11y(weights.map((w) => `${t.weightLabel[w.weightClass]} ${num(w.count)}`).join(", "))}>
          {weights.map((w) => (
            <HBarRow
              key={w.weightClass}
              label={t.weightLabel[w.weightClass]}
              value={w.count}
              max={maxW}
              color={colors.weight}
              hint={t.block.open}
              onPress={() => openFighters({ weightClass: w.weightClass })}
            />
          ))}
        </View>
      )}
    </BlockCard>
  );

  const roleSegments: Segment[] = ROLE_ORDER.map((r) => ({ key: r, label: t.roleLabel[r], count: roles.data?.byRole[r] ?? 0, color: colors.role[r] }));
  const roleTotal = roleSegments.reduce((s, x) => s + x.count, 0);
  const rolesCard = (
    <BlockCard title={t.roles.title} load={roles} skeletonHeight={120 + 64} grow={wide}>
      {roles.data ? (
        roleTotal === 0 ? (
          <ZeroLine text={t.roles.empty} />
        ) : (
          <View style={styles.gap12}>
            <View style={styles.donutRow}>
              <View accessible accessibilityLabel={t.roles.a11y(roleSegments.map((s) => `${num(s.count)} ${s.label}`).join(", "))}>
                <Donut segments={roleSegments} centerLabel={t.roles.total} />
              </View>
              <View style={styles.flex}>
                {roleSegments.map((s) => (
                  <LegendRow key={s.key} color={s.color} label={s.label} value={s.count} hint={t.block.open} onPress={() => openUsers({ role: s.key as UserRole })} />
                ))}
              </View>
            </View>
            <View style={styles.activeRow}>
              <Text style={[TEXT.body, { color: p.ink }]}>{t.roles.active(num(roles.data.active))}</Text>
              <Text style={[TEXT.body, { color: p.ink }]}>·</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.roles.locked(num(roles.data.locked))}
                accessibilityHint={t.block.open}
                onPress={() => openUsers({ status: "INACTIVE" })}
                style={({ pressed }) => [styles.lockedBtn, { backgroundColor: pressed ? p.surface2 : "transparent" }]}
              >
                <Text style={[TEXT.bodyBold, { color: p.ink }]}>{t.roles.locked(num(roles.data.locked))}</Text>
                <Icon name="chevron" size={20} color={p.ink} />
              </Pressable>
            </View>
          </View>
        )
      ) : null}
    </BlockCard>
  );

  const notifRows = notifs.data ? latestNotifications(notifs.data) : [];
  const notifCard = (
    <BlockCard title={t.notifications.title} load={notifs} skeletonHeight={3 * 64}>
      {notifs.data ? (
        notifRows.length === 0 ? (
          <ZeroLine text={t.notifications.empty} />
        ) : (
          <View>
            {notifRows.map((n) => (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                accessibilityLabel={[n.isRead ? "" : t.notifications.unread, n.title, relativeTime(n.createdAt)].filter(Boolean).join(", ")}
                onPress={openInbox}
                style={({ pressed }) => [styles.notifRow, { backgroundColor: pressed ? p.surface2 : "transparent", borderBottomColor: p.line }]}
              >
                <View style={[styles.unreadDot, { backgroundColor: n.isRead ? "transparent" : p.accent }]} />
                <View style={styles.flex}>
                  <Text style={[TEXT.bodyBold, { color: p.ink }]} numberOfLines={2}>
                    {n.title}
                  </Text>
                  <Text style={[TEXT.detail, { color: p.ink }]}>{relativeTime(n.createdAt)}</Text>
                </View>
                <Icon name="chevron" size={20} color={p.ink} />
              </Pressable>
            ))}
            <ActionButton label={t.notifications.seeAll} variant="secondary" onPress={openInbox} />
          </View>
        )
      ) : null}
    </BlockCard>
  );

  return (
    <RoScreen title={t.title} onRefresh={refresh} wide>
      <View style={styles.page}>
        {offline ? (
          <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: p.surface2, borderColor: p.line }]}>
            <Icon name="offline" size={20} color={p.ink} />
            <Text style={[TEXT.bodyBold, { color: p.ink, flex: 1 }]}>{t.offline(vnClock(updated!))}</Text>
          </View>
        ) : updated != null ? (
          <Text style={[TEXT.detail, { color: p.ink }]}>{t.updatedAt(vnClock(updated))}</Text>
        ) : null}
        {tiles}
        {attentionCard}
        {wide ? (
          <>
            <Row>
              {medicalCard}
              {rolesCard}
            </Row>
            <Row>
              {sessionsCard}
              {weightCard}
            </Row>
          </>
        ) : (
          <>
            {medicalCard}
            {sessionsCard}
            {weightCard}
            {rolesCard}
          </>
        )}
        {notifCard}
      </View>
    </RoScreen>
  );
}

/** Nút viền gọn một dòng (≥ 48dp) cho hàng hai nút cạnh nhau. */
function OutlineButton({ label, onPress }: { label: string; onPress: () => void }) {
  const p = useFighterPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t.block.open}
      onPress={onPress}
      style={({ pressed }) => [styles.outline, { borderColor: p.ink, backgroundColor: pressed ? p.surface2 : "transparent" }]}
    >
      <Text style={[styles.outlineText, { color: p.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {label}
      </Text>
    </Pressable>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function ZeroLine({ text }: { text: string }) {
  const p = useFighterPalette();
  return <Text style={[TEXT.body, { color: p.ink }]}>{text}</Text>;
}

/** Khung thẻ + tiêu đề; thân: khung xương / lỗi "Thử lại" / nội dung. */
function BlockCard({
  title,
  load,
  skeletonHeight,
  children,
  grow,
}: {
  title: string;
  load: Load<unknown>;
  skeletonHeight: number;
  children: ReactNode;
  grow?: boolean;
}) {
  const p = useFighterPalette();
  const hasData = load.data != null;
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.line, borderWidth: 1 }, grow && styles.flex]}>
      <Text style={[TEXT.cardTitle, { color: p.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {hasData ? (
        children
      ) : load.error ? (
        <BlockError onRetry={() => void load.reload()} retrying={load.loading} />
      ) : (
        <View accessibilityRole="progressbar" accessibilityLabel="Đang tải">
          <Skeleton height={skeletonHeight} />
        </View>
      )}
    </View>
  );
}

function BlockError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const p = useFighterPalette();
  return (
    <View style={styles.errorBody}>
      <View style={styles.cardHead}>
        <Icon name="offline" size={24} color={p.ink} />
        <Text style={[TEXT.body, { color: p.ink, flex: 1 }]}>{t.block.error}</Text>
      </View>
      <ActionButton label={t.block.retry} variant="secondary" icon="retry" onPress={onRetry} loading={retrying} />
    </View>
  );
}

/** Ô số nhanh (cao 88): số lớn + nhãn; lỗi → "Thử lại"; 0 hiện "0". */
function StatTile({ icon, label, load, onPress, wide }: { icon: IconName; label: string; load: Load<number>; onPress?: () => void; wide: boolean }) {
  const p = useFighterPalette();
  const value = load.data;
  const content =
    value != null ? (
      <>
        <Text style={[styles.tileNum, { color: p.ink }]}>{num(value)}</Text>
        <Text style={[TEXT.detail, { color: p.ink }]} numberOfLines={2}>
          {label}
        </Text>
      </>
    ) : load.error ? (
      <>
        <Text style={[TEXT.detail, { color: p.ink }]} numberOfLines={2}>
          {label}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t.block.retry}: ${label}`} onPress={() => void load.reload()} style={styles.tileRetry}>
          <Icon name="retry" size={18} color={p.ink} />
          <Text style={[TEXT.bodyBold, { color: p.ink }]}>{t.block.retry}</Text>
        </Pressable>
      </>
    ) : (
      <View accessibilityRole="progressbar" accessibilityLabel="Đang tải" style={styles.tileSkel}>
        <Skeleton height={28} width="50%" />
        <Skeleton height={14} width="80%" />
      </View>
    );
  const style = [styles.tile, wide ? styles.tileWide : styles.tileHalf, { backgroundColor: p.surface, borderColor: p.line }];
  const head = (tap: boolean) => (
    <View style={styles.tileHead}>
      <Icon name={icon} size={20} color={p.ink} />
      {tap ? <Icon name="chevron" size={20} color={p.ink} /> : null}
    </View>
  );
  if (!onPress || value == null) {
    return (
      <View style={style} accessible={value != null} accessibilityLabel={value != null ? `${label}: ${num(value)}` : undefined}>
        {head(false)}
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${num(value)}`}
      accessibilityHint={t.block.open}
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && { backgroundColor: p.surface2, borderColor: p.accent }]}
    >
      {head(true)}
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  failedLine: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  page: { gap: SPEC.gap },
  flex: { flex: 1 },
  gap12: { gap: 12 },
  row: { flexDirection: "row", gap: SPEC.gap, alignItems: "stretch" },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tilesWide: { flexWrap: "nowrap", gap: SPEC.gap },
  tile: { minHeight: 88, borderRadius: SPEC.radius, borderWidth: 1, padding: 12, gap: 2 },
  tileHalf: { flexBasis: "47%", flexGrow: 1 },
  tileWide: { flex: 1 },
  tileHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  tileNum: { fontSize: 32, lineHeight: 38, fontWeight: "700", fontVariant: ["tabular-nums"] },
  tileSkel: { gap: 8 },
  tileRetry: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48 },
  card: { borderRadius: SPEC.radius, padding: SPEC.card, gap: 12, alignSelf: "stretch" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameWide: { flexShrink: 1, maxWidth: "60%" },
  chipCenter: { justifyContent: "center" },
  btnRow: { flexDirection: "row", gap: 12 },
  outline: { flex: 1, minHeight: 48, borderWidth: 2, borderRadius: SPEC.radius, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  outlineText: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
  legendGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
  legendCell: { flexBasis: "45%", flexGrow: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  donutRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  lockedBtn: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 48, paddingHorizontal: 8, borderRadius: 8 },
  notifRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  unreadDot: { width: 10, height: 10, borderRadius: 5 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: SPEC.radius, padding: 12, minHeight: 48 },
  errorBody: { gap: 12 },
});
